import type { CookieOptions, NextFunction, Request, Response } from 'express';
import type { AfterCheck, BeforeCheck, Controller, ControllerState, GuardFailure, Handler } from './types.js';
import { addCookie, cloneParts, emptyParts, mergeParts, send, setHeaders, type HeaderValue, type Headers } from './response.js';
import { STATUSES } from './status.generated.js';
import { assertStatusCode } from './status.js';
import { createContext } from './context.js';
import { isResult, type Result } from './result.js';
import { createHttpError, isHttpError } from './error.js';
import { errorMode } from './config.js';

/** Builder method names; generated status names must never collide with them. */
export const BUILDER_METHODS = ['status', 'header', 'cookie', 'type', 'guard', 'checkBefore', 'if', 'checkAfter'] as const;

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

function assertCheck(check: unknown, method: string): void {
    if (typeof check !== 'function')
        throw new TypeError(`.${method}(check, result): check must be a function`);
}


export function createController<T>(handler: Handler<T>): Controller<T> {
    if (typeof handler !== 'function')
        throw new TypeError('$(handler): handler must be a function');

    const state: ControllerState = { defaults: { ...emptyParts(), status: 200 }, before: [], after: [] };

    const middleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const parts = cloneParts(state.defaults);
        try {
            // 1. guards before the handler: on failure the handler never runs
            for (const { check, failure } of state.before) {
                if (!await check(req)) {
                    const result = await resolveFailure(failure as GuardFailure<never[]> | undefined, [req]);
                    return send(res, mergeParts(parts, result.parts), result.body);
                }
            }

            const ctx = createContext(parts);
            const value = await handler(req, ctx);

            // An explicit $.* result is the handler's final decision: after-guards are skipped
            if (isResult(value))
                return send(res, mergeParts(parts, value.parts), value.body);

            // 2. guards after the handler, receiving its data
            for (const { check, failure } of state.after) {
                if (!await check(req, value as never)) {
                    const result = await resolveFailure(failure as GuardFailure<never[]> | undefined, [req, value]);
                    return send(res, mergeParts(parts, result.parts), result.body);
                }
            }

            send(res, parts, value);
        } catch (error) {
            // Too late to answer: let Express deal with it
            if (res.headersSent)
                return next(error);
            // throw $.error(...) or throw $.notFound(...) become their response
            if (isHttpError(error))
                return send(res, mergeParts(parts, error.result.parts), error.result.body);
            if (isResult(error))
                return send(res, mergeParts(parts, error.parts), error.body);
            if (errorMode() === 'respond')
                return send(res, { ...parts, status: 500 }, { error: error instanceof Error ? error.message : String(error) });
            next(error);
        }
    };

    const controller = Object.assign(middleware, {
        __state__:      state,
        __handler__:    handler
    }) as unknown as Controller<T>;

    const methods: Record<string, () => Controller<T>> = {};
    for (const { code, name } of STATUSES) {
        const setter = (): Controller<T> => {
            state.defaults.status = code;
            return controller;
        };
        methods[name] = setter;
        methods[`_${code}`] = setter;
    }

    const before = (check: BeforeCheck, failure?: GuardFailure<[Request]>): Controller<T> => {
        assertCheck(check, 'guard');
        state.before.push(failure === undefined ? { check } : { check, failure });
        return controller;
    };
    const after = (check: AfterCheck<T>, failure?: GuardFailure<[Request, T]>): Controller<T> => {
        assertCheck(check, 'if');
        state.after.push(failure === undefined ? { check: check as AfterCheck<unknown> } : { check: check as AfterCheck<unknown>, failure: failure as GuardFailure<[Request, unknown]> });
        return controller;
    };

    return Object.assign(controller, methods, {
        guard:          before,
        checkBefore:    before,
        if:             after,
        checkAfter:     after,
        status(code: number): Controller<T> {
            assertStatusCode(code);
            state.defaults.status = code;
            return controller;
        },
        header(nameOrHeaders: string | Headers, value?: HeaderValue): Controller<T> {
            setHeaders(state.defaults, nameOrHeaders, value);
            return controller;
        },
        cookie(name: string, value: unknown, options?: CookieOptions): Controller<T> {
            addCookie(state.defaults, name, value, options);
            return controller;
        },
        type(type: string): Controller<T> {
            if (typeof type !== 'string' || type === '')
                throw new TypeError('type must be a non-empty string');
            state.defaults.type = type;
            return controller;
        }
    });
}
