import type { CookieOptions, Request, RequestHandler } from 'express';
import type { HeaderValue, Headers, ResponseParts } from './response.js';
import type { Status, StatusCode } from './status.generated.js';

/** A value or a promise of it. */
export type Awaitable<T> = T | Promise<T>;

/** Per-request context passed to the handler (extended in later releases). */
export interface Context {}

/** The user handler: returns the response body, sync or async. */
export type Handler<T = unknown> = (req: Request, ctx: Context) => Awaitable<T>;

/** Internal mutable configuration of a controller. */
export interface ControllerState {
    /** Response parts applied to every request, copied per request. */
    defaults: ResponseParts;
}

/** Common content types, autocompleted; any MIME type or extension is accepted. */
export type ContentType = LiteralUnion<'json' | 'html' | 'text' | 'xml' | 'application/json' | 'text/plain' | 'text/html'>;

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
    /** Default header for every response: `.header('Cache-Control', 'no-store')`. */
    header(name: string, value: HeaderValue): Controller<T>;
    /** Default headers for every response: `.header({ 'Cache-Control': 'no-store' })`. */
    header(headers: Headers): Controller<T>;
    /** Default cookie for every response, same options as Express `res.cookie()`. */
    cookie(name: string, value: unknown, options?: CookieOptions): Controller<T>;
    /** Default content type, same as Express `res.type()`: `'json'`, `'text'`, `'text/csv'`... */
    type(type: ContentType): Controller<T>;
    /** @internal */
    readonly __state__: ControllerState;
    /** @internal */
    readonly __handler__: Handler<T>;
}
