import type { Request } from 'express';
import type { ControllerState, GuardFailure, Handler } from './types.js';
import { cloneParts, mergeParts, type ResponseParts } from './response.js';
import { createContext } from './context.js';
import { isResult, type Result } from './result.js';
import { createHttpError, isHttpError } from './error.js';
import { errorMode } from './config.js';

/** What a request resolves to, before it is written anywhere (Express response or `.run()`). */
export interface Outcome {
    parts:  ResponseParts;
    body:   unknown;
}

/** Default failure of a guard without explicit result. */
const DEFAULT_FAILURE = createHttpError(500).result;

async function resolveFailure(failure: GuardFailure<never[]> | undefined, args: unknown[]): Promise<Result> {
    if (failure === undefined)
        return DEFAULT_FAILURE;
    const result = typeof failure === 'function' ? await (failure as (...a: unknown[]) => unknown)(...args) : failure;
    if (!isResult(result))
        throw new TypeError('guard failure must be a $.* result (or a function returning one)');
    return result;
}

const withResult = (parts: ResponseParts, result: Result): Outcome => ({ parts: mergeParts(parts, result.parts), body: result.body });

/** The `respond` error mode answer: `500 { error: message }`, never the stack trace. */
export function respondWithError(parts: ResponseParts, error: unknown): Outcome {
    return { parts: { ...parts, status: 500 }, body: { error: error instanceof Error ? error.message : String(error) } };
}

/**
 * Runs a request through the controller:
 * before-guards → handler → after-guards, with `$.*` results and `$.error()` applied,
 * layered as builder defaults → ctx → result.
 *
 * Unexpected errors resolve to a 500 outcome in `respond` mode, and are re-thrown otherwise.
 */
export async function execute<T>(state: ControllerState, handler: Handler<T>, req: Request): Promise<Outcome> {
    const parts = cloneParts(state.defaults);
    try {
        // 1. guards before the handler: on failure the handler never runs
        for (const { check, failure } of state.before) {
            if (!await check(req))
                return withResult(parts, await resolveFailure(failure as GuardFailure<never[]> | undefined, [req]));
        }

        const ctx = createContext(parts);
        const value = await handler(req, ctx);

        // An explicit $.* result is the handler's final decision: after-guards are skipped
        if (isResult(value))
            return withResult(parts, value);

        // 2. guards after the handler, receiving its data
        for (const { check, failure } of state.after) {
            if (!await check(req, value as never))
                return withResult(parts, await resolveFailure(failure as GuardFailure<never[]> | undefined, [req, value]));
        }

        return { parts, body: value };
    } catch (error) {
        // throw $.error(...) or throw $.notFound(...) become their response
        if (isHttpError(error))
            return withResult(parts, error.result);
        if (isResult(error))
            return withResult(parts, error);
        if (errorMode() === 'respond')
            return respondWithError(parts, error);
        throw error;
    }
}
