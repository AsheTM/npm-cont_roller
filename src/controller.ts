import type { NextFunction, Request, Response } from 'express';
import type { AfterCheck, Controller, ControllerState, GuardFailure, Handler } from './types.js';
import { cloneParts, send } from './response.js';
import { errorMode } from './config.js';
import { execute, respondWithError, respondWithSendError, type Outcome } from './pipeline.js';
import { run, type RunRequest } from './run.js';
import { assertCheck, copyState, emptyState, settingMethods } from './settings.js';

/** Builder method names; generated status names must never collide with them. */
export const BUILDER_METHODS = ['status', 'header', 'cookie', 'type', 'guard', 'checkBefore', 'if', 'checkAfter', 'validate', 'run'] as const;

/**
 * Creates the controller (the Express middleware with chainable methods).
 * `initial` (from the steps-first chain) is copied, so the chain can be reused.
 */
export function createController<T>(handler: Handler<T>, initial?: ControllerState, label = '$(handler)'): Controller<T> {
    if (typeof handler !== 'function')
        throw new TypeError(`${label}: handler must be a function`);

    const state: ControllerState = initial ? copyState(initial) : emptyState();

    const middleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Unexpected error from the pipeline, or while sending (missing file, view error...)
        const fail = async (error: unknown, sending: boolean): Promise<void> => {
            if (res.headersSent || errorMode() !== 'respond')
                return next(error);
            const parts = cloneParts(state.defaults);
            const outcome = sending ? respondWithSendError(parts, error) : respondWithError(parts, error);
            try {
                await send(res, outcome.parts, outcome.body);
            } catch (sendError) {
                next(sendError);
            }
        };

        let outcome: Outcome;
        try {
            outcome = await execute(state, handler, req, res);
        } catch (error) {
            return fail(error, false);
        }
        if (outcome.handled)
            return;
        try {
            await send(res, outcome.parts, outcome.body);
        } catch (error) {
            return fail(error, true);
        }
    };

    const controller = Object.assign(middleware, {
        __state__:      state,
        __handler__:    handler
    }) as unknown as Controller<T>;

    const after = (check: AfterCheck<T>, failure?: GuardFailure<[Request, T]>): Controller<T> => {
        assertCheck(check, 'if');
        state.after.push(failure === undefined ? { check: check as AfterCheck<unknown> } : { check: check as AfterCheck<unknown>, failure: failure as GuardFailure<[Request, unknown]> });
        return controller;
    };

    // The controller is mutable: every setting changes it and returns it
    const settings = settingMethods<Controller<T>>((change) => {
        change(state);
        return controller;
    });

    return Object.assign(controller, settings, {
        run:            <B = unknown>(req?: RunRequest) => run<B, T>(state, handler, req),
        if:             after,
        checkAfter:     after
    });
}
