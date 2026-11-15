import type { NextFunction, Request, Response } from 'express';
import type { Context, Controller, ControllerState, Handler } from './types.js';
import { send } from './send.js';
import { STATUSES } from './status.generated.js';

/** Builder method names; generated status names must never collide with them. */
export const BUILDER_METHODS = ['status'] as const;

export function assertStatusCode(code: unknown): asserts code is number {
    if (typeof code !== 'number' || !Number.isInteger(code) || code < 100 || code > 999)
        throw new RangeError(`Invalid HTTP status code: ${String(code)}`);
}

export function createController<T>(handler: Handler<T>): Controller<T> {
    if (typeof handler !== 'function')
        throw new TypeError('$(handler): handler must be a function');

    const state: ControllerState = { status: 200 };

    const middleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const ctx: Context = {};
            const value = await handler(req, ctx);
            send(res, state.status, value);
        } catch (error) {
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
            state.status = code;
            return controller;
        };
        methods[name] = setter;
        methods[`_${code}`] = setter;
    }

    return Object.assign(controller, methods, {
        status(code: number): Controller<T> {
            assertStatusCode(code);
            state.status = code;
            return controller;
        }
    });
}
