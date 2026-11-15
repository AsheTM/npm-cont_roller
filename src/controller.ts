import type { CookieOptions, NextFunction, Request, Response } from 'express';
import type { Controller, ControllerState, Handler } from './types.js';
import { addCookie, cloneParts, emptyParts, mergeParts, send, setHeaders, type HeaderValue, type Headers } from './response.js';
import { STATUSES } from './status.generated.js';
import { assertStatusCode } from './status.js';
import { createContext } from './context.js';
import { isResult } from './result.js';
import { isHttpError } from './error.js';

/** Builder method names; generated status names must never collide with them. */
export const BUILDER_METHODS = ['status', 'header', 'cookie', 'type'] as const;


export function createController<T>(handler: Handler<T>): Controller<T> {
    if (typeof handler !== 'function')
        throw new TypeError('$(handler): handler must be a function');

    const state: ControllerState = { defaults: { ...emptyParts(), status: 200 } };

    const middleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const parts = cloneParts(state.defaults);
        try {
            const ctx = createContext(parts);
            const value = await handler(req, ctx);
            if (isResult(value))
                send(res, mergeParts(parts, value.parts), value.body);
            else
                send(res, parts, value);
        } catch (error) {
            // throw $.error(...) or throw $.notFound(...) become their response
            if (isHttpError(error))
                return send(res, mergeParts(parts, error.result.parts), error.result.body);
            if (isResult(error))
                return send(res, mergeParts(parts, error.parts), error.body);
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

    return Object.assign(controller, methods, {
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
