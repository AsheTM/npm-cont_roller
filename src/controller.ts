import type { CookieOptions, NextFunction, Request, Response } from 'express';
import type { AfterCheck, BeforeCheck, Controller, ControllerState, GuardFailure, Handler } from './types.js';
import { addCookie, cloneParts, emptyParts, send, setHeaders, type HeaderValue, type Headers } from './response.js';
import { STATUSES } from './status.generated.js';
import { assertStatusCode } from './status.js';
import { errorMode } from './config.js';
import { execute, respondWithError } from './pipeline.js';

/** Builder method names; generated status names must never collide with them. */
export const BUILDER_METHODS = ['status', 'header', 'cookie', 'type', 'guard', 'checkBefore', 'if', 'checkAfter'] as const;

function assertCheck(check: unknown, method: string): void {
    if (typeof check !== 'function')
        throw new TypeError(`.${method}(check, result): check must be a function`);
}

export function createController<T>(handler: Handler<T>): Controller<T> {
    if (typeof handler !== 'function')
        throw new TypeError('$(handler): handler must be a function');

    const state: ControllerState = { defaults: { ...emptyParts(), status: 200 }, before: [], after: [] };

    const middleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { parts, body } = await execute(state, handler, req);
            send(res, parts, body);
        } catch (error) {
            // Unexpected error from the pipeline, or while writing the response
            if (res.headersSent || errorMode() !== 'respond')
                return next(error);
            const { parts, body } = respondWithError(cloneParts(state.defaults), error);
            send(res, parts, body);
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
