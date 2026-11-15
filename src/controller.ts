import type { NextFunction, Request, Response } from 'express';
import type { Context, Controller, ControllerState, Handler } from './types.js';
import { send } from './send.js';

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

    return Object.assign(middleware, {
        __state__:      state,
        __handler__:    handler
    });
}
