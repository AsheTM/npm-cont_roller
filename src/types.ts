import type { Request, RequestHandler } from 'express';
import type { Status, StatusCode } from './status.generated.js';

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
 * `T` with autocompletion, still accepting any other `Base`.
 * Same as `LiteralUnion` from `@ashetm/types`, inlined because that package only ships
 * ESM declarations, which CommonJS consumers (`moduleResolution: node16`) cannot import.
 */
export type LiteralUnion<T extends Base, Base = string> = T | (Base & Record<never, never>);

/** A known status code (autocompleted) or any other numeric code. */
export type AnyStatusCode = LiteralUnion<StatusCode, number>;

/**
 * Success-status setters generated for every status code, in two forms:
 * `._200()` (by number) and `.ok()` (camelCase name).
 */
export type StatusMethods<Self> =
    & { [S in Status as S['name']]: () => Self }
    & { [S in Status as `_${S['code']}`]: () => Self };

/**
 * The value returned by `$(handler)`: an Express middleware with chainable methods attached,
 * like a jQuery object. No terminating call is needed.
 */
export interface Controller<T = unknown> extends RequestHandler, StatusMethods<Controller<T>> {
    /** Sets the success status: `.status(201)`. Same as `._201()` and `.created()`. */
    status(code: AnyStatusCode): Controller<T>;
    /** @internal */
    readonly __state__: ControllerState;
    /** @internal */
    readonly __handler__: Handler<T>;
}
