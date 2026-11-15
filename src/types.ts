import type { Request, RequestHandler } from 'express';

/** A value or a promise of it. */
export type Awaitable<T> = T | Promise<T>;

/** Per-request context passed to the handler (extended in later releases). */
export interface Context {}

/** The user handler: returns the response body, sync or async. */
export type Handler<T = unknown> = (req: Request, ctx: Context) => Awaitable<T>;

/** Internal mutable configuration of a controller. */
export interface ControllerState {
    status: number;
}

/**
 * The value returned by `$(handler)`: an Express middleware with chainable methods attached,
 * like a jQuery object. No terminating call is needed.
 */
export interface Controller<T = unknown> extends RequestHandler {
    /** @internal */
    readonly __state__: ControllerState;
    /** @internal */
    readonly __handler__: Handler<T>;
}
