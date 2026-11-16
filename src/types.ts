import type { CookieOptions, Request, RequestHandler } from 'express';
import type { LiteralUnion } from '@ashetm/types';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { HeaderValue, Headers, ResponseParts } from './response.js';
import type { Result } from './result.js';
import type { RunRequest, RunResult } from './run.js';
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

/** The user handler: returns the response body, sync or async. `Req` is typed by validation. */
export type Handler<T = unknown, Req = Request> = (req: Req, ctx: Context) => Awaitable<T>;

/** The data a handler resolves to, without explicit `$.*` results. */
export type Data<T> = Exclude<Awaited<T>, Result>;

/** Check run before the handler: return true to continue. */
export type BeforeCheck = (req: Request) => Awaitable<unknown>;

/** Check run after the handler with its data: return true to send the data. */
export type AfterCheck<T, Req = Request> = (req: Req, data: Data<T>) => Awaitable<unknown>;

/** Response sent when a check fails: a `$.*` result, or a function returning one. */
export type GuardFailure<Args extends unknown[]> = Result | ((...args: Args) => Awaitable<Result>);

/** Request fields that `.validate()` checks. */
export type ValidationTarget = 'params' | 'query' | 'body';

/**
 * Schemas for `.validate()`: any [Standard Schema](https://standardschema.dev) validator
 * (zod, valibot, arktype...) per request field.
 */
export type ValidationSchemas = { [K in ValidationTarget]?: StandardSchemaV1 };

/** One validation problem: `{ path: 'body.name', message: 'Required' }`. */
export interface ValidationIssue {
    /** The request field, then the path inside it, joined with dots: `body.items.0.name`. */
    path:       string;
    message:    string;
}

/**
 * Response sent when validation fails: a `$.*` result, or a function receiving the issues and the
 * (unvalidated) request. Default: `400 { error: 'Bad Request', issues }`.
 */
export type ValidationFailure = Result | ((issues: ValidationIssue[], req: Request) => Awaitable<Result>);

/** `Req` with `params` / `query` / `body` replaced by the output types of the schemas. */
export type ValidatedRequest<S extends ValidationSchemas, Req = Request> =
    & Omit<Req, keyof S & ValidationTarget>
    & { [K in keyof S & ValidationTarget]: StandardSchemaV1.InferOutput<NonNullable<S[K]>> };

/** Internal mutable configuration of a controller. */
export interface ControllerState {
    /** Response parts applied to every request, copied per request. */
    defaults: ResponseParts;
    /** Guards run before the handler, in order. */
    before: Array<{ check: BeforeCheck; failure?: GuardFailure<[Request]> }>;
    /** Guards run after the handler, in order. */
    after: Array<{ check: AfterCheck<unknown>; failure?: GuardFailure<[Request, unknown]> }>;
    /** Validation steps, run after the before-guards, in order. */
    validations: Array<{ schemas: ValidationSchemas; failure?: ValidationFailure }>;
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
export interface Controller<T = unknown, Req = Request> extends RequestHandler, StatusMethods<Controller<T, Req>> {
    /** Sets the success status: `.status(201)`. Same as `._201()` and `.created()`. */
    status(code: AnyStatusCode): Controller<T, Req>;
    /** Default header for every response: `.header('Cache-Control', 'no-store')`. */
    header(name: string, value: HeaderValue): Controller<T, Req>;
    /** Default headers for every response: `.header({ 'Cache-Control': 'no-store' })`. */
    header(headers: Headers): Controller<T, Req>;
    /** Default cookie for every response, same options as Express `res.cookie()`. */
    cookie(name: string, value: unknown, options?: CookieOptions): Controller<T, Req>;
    /** Default content type, same as Express `res.type()`: `'json'`, `'text'`, `'text/csv'`... */
    type(type: ContentType): Controller<T, Req>;

    /**
     * Check run **before** the handler; when it returns false, `failure` is sent and the handler
     * never runs. Same as `.checkBefore()`. Default failure: 500.
     *
     * ```ts
     * $(handler).guard((req) => !!req.user, $.unauthorized())
     * ```
     */
    guard(check: BeforeCheck, failure?: GuardFailure<[Request]>): Controller<T, Req>;
    /** Alias of `.guard()`. */
    checkBefore(check: BeforeCheck, failure?: GuardFailure<[Request]>): Controller<T, Req>;
    /**
     * Check run **after** the handler with its data; when it returns false, `failure` is sent
     * instead of the data. Same as `.checkAfter()`. Skipped when the handler returns a `$.*` result.
     *
     * ```ts
     * $(handler).if((req, user) => !!user, $.notFound())
     * ```
     */
    if(check: AfterCheck<T, Req>, failure?: GuardFailure<[Req, Data<T>]>): Controller<T, Req>;
    /** Alias of `.if()`. */
    checkAfter(check: AfterCheck<T, Req>, failure?: GuardFailure<[Req, Data<T>]>): Controller<T, Req>;

    /**
     * Validates `params`, `query` and/or `body` with Standard Schema validators (zod, valibot, arktype...).
     * Runs after the before-guards and before the handler, wherever it is in the chain; the validated
     * values replace the request fields. Default failure: `400 { error: 'Bad Request', issues }`.
     *
     * ```ts
     * $(handler).validate({ body: User, params: z.object({ id: z.string() }) })
     * ```
     *
     * The handler is already written, so its `req` is not typed by the schemas: use
     * `$.validate(schemas).handle(handler)` or `$(schemas, handler)` for that.
     */
    validate<S extends ValidationSchemas>(schemas: S, failure?: ValidationFailure): Controller<T, ValidatedRequest<S, Req>>;

    /**
     * Runs the controller **without HTTP** and resolves with the response as a plain object,
     * through the same pipeline as a real request. Meant for tests.
     *
     * ```ts
     * const res = await getUser.run({ params: { id: '1' } });
     * expect(res.status).toBe(200);
     * ```
     *
     * Unexpected errors follow `$.config`: the promise rejects by default, and resolves
     * with `500 { error: message }` in `respond` mode. Narrow the body type with `run<User>()`.
     */
    run<B = unknown>(req?: RunRequest): Promise<RunResult<B>>;
    /** @internal */
    readonly __state__: ControllerState;
    /** @internal */
    readonly __handler__: Handler<T, Req>;
}

/**
 * Steps-first chain, written in the order the steps run:
 * `$.guard(...)` / `$.checkBefore(...)` / `$.validate(...)`, then `.handle(handler)` (alias `.do()`).
 *
 * ```ts
 * $.guard((req) => !!req.user, $.unauthorized())
 *     .validate({ body: Doc })
 *     .handle(async (req) => db.docs.create(req.body))   // req.body typed from Doc
 *     .if((req, doc) => !!doc, $.notFound());
 * ```
 *
 * Immutable: every step returns a new chain, so a chain can be shared between routes.
 * It is not a middleware until `.handle()` / `.do()` is called.
 */
export interface ControllerChain<Req = Request> extends StatusMethods<ControllerChain<Req>> {
    /** Sets the success status: `.status(201)`. Same as `._201()` and `.created()`. */
    status(code: AnyStatusCode): ControllerChain<Req>;
    /** Default header for every response. */
    header(name: string, value: HeaderValue): ControllerChain<Req>;
    /** Default headers for every response. */
    header(headers: Headers): ControllerChain<Req>;
    /** Default cookie for every response, same options as Express `res.cookie()`. */
    cookie(name: string, value: unknown, options?: CookieOptions): ControllerChain<Req>;
    /** Default content type, same as Express `res.type()`. */
    type(type: ContentType): ControllerChain<Req>;
    /** Check run before the handler (and before validation); same as `.checkBefore()`. */
    guard(check: BeforeCheck, failure?: GuardFailure<[Request]>): ControllerChain<Req>;
    /** Alias of `.guard()`. */
    checkBefore(check: BeforeCheck, failure?: GuardFailure<[Request]>): ControllerChain<Req>;
    /** Validates `params`, `query` and/or `body`; the handler's `req` is typed from the schemas. */
    validate<S extends ValidationSchemas>(schemas: S, failure?: ValidationFailure): ControllerChain<ValidatedRequest<S, Req>>;
    /** Sets the handler and returns the controller (the Express middleware). Same as `.do()`. */
    handle<T>(handler: Handler<T, Req>): Controller<T, Req>;
    /** Alias of `.handle()`. */
    do<T>(handler: Handler<T, Req>): Controller<T, Req>;
}
