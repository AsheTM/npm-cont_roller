import type { CookieOptions, Request, RequestHandler } from 'express';
import type { LiteralUnion } from '@ashetm/types';
import type { HeaderValue, Headers, ResponseParts } from './response.js';
import type { Result } from './result.js';
import type { Status, StatusCode } from './status.generated.js';

/** A value or a promise of it. */
export type Awaitable<T> = T | Promise<T>;

/**
 * Per-request context, second argument of the handler. Every method is chainable and
 * only affects the current response, on top of the builder defaults.
 *
 * ```ts
 * $(async (req, ctx) => {
 *     ctx.header('X-Source', 'db').cookie('seen', '1').status(201);
 *     return data;
 * })
 * ```
 */
export interface Context {
    /** Sets a header for this response. */
    header(name: string, value: HeaderValue): Context;
    /** Sets headers for this response. */
    header(headers: Headers): Context;
    /** Sets a cookie for this response, same options as Express `res.cookie()`. */
    cookie(name: string, value: unknown, options?: CookieOptions): Context;
    /** Clears a cookie, same options as Express `res.clearCookie()`. */
    clearCookie(name: string, options?: CookieOptions): Context;
    /** Sets the content type for this response. */
    type(type: ContentType): Context;
    /** Sets the status for this response, overriding the builder's success status. */
    status(code: AnyStatusCode): Context;
}

/** The user handler: returns the response body, sync or async. */
export type Handler<T = unknown> = (req: Request, ctx: Context) => Awaitable<T>;

/** Internal mutable configuration of a controller. */
/** The data a handler resolves to, without explicit `$.*` results. */
export type Data<T> = Exclude<Awaited<T>, Result>;

/** Check run before the handler: return true to continue. */
export type BeforeCheck = (req: Request) => Awaitable<unknown>;

/** Check run after the handler with its data: return true to send the data. */
export type AfterCheck<T> = (req: Request, data: Data<T>) => Awaitable<unknown>;

/** Response sent when a check fails: a `$.*` result, or a function returning one. */
export type GuardFailure<Args extends unknown[]> = Result | ((...args: Args) => Awaitable<Result>);

export interface ControllerState {
    /** Response parts applied to every request, copied per request. */
    defaults: ResponseParts;
    /** Guards run before the handler, in order. */
    before: Array<{ check: BeforeCheck; failure?: GuardFailure<[Request]> }>;
    /** Guards run after the handler, in order. */
    after: Array<{ check: AfterCheck<unknown>; failure?: GuardFailure<[Request, unknown]> }>;
}

/** Common content types, autocompleted; any MIME type or extension is accepted. */
export type ContentType = LiteralUnion<'json' | 'html' | 'text' | 'xml' | 'application/json' | 'text/plain' | 'text/html'>;

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

    /**
     * Check run **before** the handler; when it returns false, `failure` is sent and the handler
     * never runs. Same as `.checkBefore()`. Default failure: 500.
     *
     * ```ts
     * $(handler).guard((req) => !!req.user, $.unauthorized())
     * ```
     */
    guard(check: BeforeCheck, failure?: GuardFailure<[Request]>): Controller<T>;
    /** Alias of `.guard()`. */
    checkBefore(check: BeforeCheck, failure?: GuardFailure<[Request]>): Controller<T>;
    /**
     * Check run **after** the handler with its data; when it returns false, `failure` is sent
     * instead of the data. Same as `.checkAfter()`. Skipped when the handler returns a `$.*` result.
     *
     * ```ts
     * $(handler).if((req, user) => !!user, $.notFound())
     * ```
     */
    if(check: AfterCheck<T>, failure?: GuardFailure<[Request, Data<T>]>): Controller<T>;
    /** Alias of `.if()`. */
    checkAfter(check: AfterCheck<T>, failure?: GuardFailure<[Request, Data<T>]>): Controller<T>;
    /** @internal */
    readonly __state__: ControllerState;
    /** @internal */
    readonly __handler__: Handler<T>;
}
