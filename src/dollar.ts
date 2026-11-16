import type { Request } from 'express';
import type { AnyStatusCode, BeforeCheck, Controller, ControllerChain, GuardFailure, Handler, ValidatedRequest, ValidationFailure, ValidationSchemas } from './types.js';
import type { Status } from './status.generated.js';
import { createHttpError, HttpError, isHttpError } from './error.js';
import { getConfig, setConfig, type Config } from './config.js';
import { createResult, isResult, redirectResult, statusResult, type Result, type ResultOptions } from './result.js';
import { createController } from './controller.js';
import { createChain } from './chain.js';
import { downloadResult, fileResult, renderResult, type DownloadBody, type FileBody, type FileOptions, type RenderBody } from './delivery.js';
import { emptyState } from './settings.js';
import { assertValidation } from './validation.js';
import { STATUSES } from './status.generated.js';

/** The `$` entry point: `$(handler)` creates a controller; static helpers live on `$`. */
export interface Dollar {
    /** Creates a controller: the Express middleware with chainable methods. */
    <T>(handler: Handler<T>): Controller<T>;
    /**
     * Creates a controller that validates the request first; the handler's `req` is typed from the schemas.
     * Same as `$.validate(schemas).handle(handler)`.
     *
     * ```ts
     * $({ body: User }, async (req) => db.users.create(req.body)).created()
     * ```
     */
    <S extends ValidationSchemas, T>(schemas: S, handler: Handler<T, ValidatedRequest<S>>): Controller<T, ValidatedRequest<S>>;
    /** Alias of `$` itself, for `const { $ } = require(...)`. */
    readonly $: Dollar;
    /** Alias of `$` itself, for default-import interop. */
    readonly default: Dollar;
    /** Every HTTP status code with its camelCase name and reason phrase. */
    readonly STATUSES: typeof STATUSES;
    /** Generic result: `$.status(418, { error: 'teapot' })`. */
    status<B = undefined>(code: AnyStatusCode, body?: B, options?: ResultOptions): Result<B>;
    /** Redirect result with a Location header, 302 by default: `$.redirect('/login', 301)`. */
    redirect(url: string, code?: AnyStatusCode, options?: ResultOptions): Result<undefined>;
    /** True when the value was created by a `$.*` result helper. */
    isResult(value: unknown): value is Result;
    /**
     * Throwable error that becomes its response: `throw $.error(404, { error: 'Not found' })`.
     * Without body, sends `{ error: '<reason phrase>' }`.
     */
    error: typeof createHttpError;
    /** The error class created by `$.error()`. */
    readonly HttpError: typeof HttpError;
    /** True for an `HttpError` (works across ESM/CJS copies). */
    isHttpError(value: unknown): value is HttpError;
    /** Reads the global options. */
    config(): Readonly<Config>;
    /** Sets global options, chainable: `$.config({ errors: 'respond' })`. */
    config(options: Partial<Config>): Dollar;

    /**
     * Starts a steps-first chain with a check run before the handler; end it with `.handle(handler)`.
     *
     * ```ts
     * $.guard((req) => !!req.user, $.unauthorized()).handle(async (req) => db.docs.list())
     * ```
     */
    guard(check: BeforeCheck, failure?: GuardFailure<[Request]>): ControllerChain;
    /** Alias of `$.guard()`. */
    checkBefore(check: BeforeCheck, failure?: GuardFailure<[Request]>): ControllerChain;
    /**
     * Starts a steps-first chain with a validation step; the handler's `req` is typed from the schemas.
     *
     * ```ts
     * $.validate({ body: User }).handle(async (req) => db.users.create(req.body))
     * ```
     */
    validate<S extends ValidationSchemas>(schemas: S, failure?: ValidationFailure): ControllerChain<ValidatedRequest<S>>;

    /**
     * Sends a file with Express `res.sendFile()`. Same as `$.sendFile()`. The status comes from the builder or ctx.
     *
     * ```ts
     * $((req) => $.file(req.params.name, { root: '/data/public', maxAge: '1d' }))
     * ```
     */
    file(path: string, options?: FileOptions): Result<FileBody>;
    /** Alias of `$.file()`. */
    sendFile(path: string, options?: FileOptions): Result<FileBody>;
    /**
     * Sends a file as an attachment with Express `res.download()` (`Content-Disposition`).
     *
     * ```ts
     * $(() => $.download('/data/report.csv', 'report-2026.csv'))
     * ```
     */
    download(path: string, filename?: string, options?: FileOptions): Result<DownloadBody>;
    /**
     * Renders a view with Express `res.render()` (the app's view engine) and sends the HTML.
     *
     * ```ts
     * $((req) => $.render('profile', { user: req.user }))
     * ```
     */
    render(view: string, locals?: object, options?: ResultOptions): Result<RenderBody>;
}

/**
 * One result helper per status code: `$.ok(body)`, `$.created(body, { headers })`, `$.notFound(body)`...
 * Not to be confused with the builder setters `$(handler).ok()`, which set the default success status.
 */
export type ResultHelpers = {
    [S in Status as S['name']]: <B = undefined>(body?: B, options?: ResultOptions) => Result<B>;
};

export interface Dollar extends ResultHelpers {}

function create<T>(handlerOrSchemas: Handler<T> | ValidationSchemas, handler?: Handler<T>): Controller<T> {
    if (typeof handlerOrSchemas === 'function' || handler === undefined)
        return createController(handlerOrSchemas as Handler<T>);
    // $(schemas, handler): same as $.validate(schemas).handle(handler)
    assertValidation(handlerOrSchemas, undefined, '$');
    const state = emptyState();
    state.validations.push({ schemas: { ...handlerOrSchemas } });
    return createController(handler, state, '$(schemas, handler)');
}

export const $ = create as unknown as Dollar;

/** Static members of `$`; generated status names must never collide with them. */
export const DOLLAR_MEMBERS = ['$', 'default', 'STATUSES', 'status', 'redirect', 'isResult', 'error', 'HttpError', 'isHttpError', 'config', 'guard', 'checkBefore', 'validate', 'file', 'sendFile', 'download', 'render'] as const;

const helpers: Record<string, unknown> = {};
for (const { code, name } of STATUSES)
    helpers[name] = <B>(body?: B, options?: ResultOptions) => createResult(code, body as B, options);
function config(options?: Partial<Config>): Readonly<Config> | Dollar {
    if (options === undefined)
        return getConfig();
    setConfig(options);
    return $;
}

const start = createChain();

Object.assign($, helpers, {
    status:         statusResult,
    redirect:       redirectResult,
    isResult,
    error:          createHttpError,
    isHttpError,
    config,
    guard:          start.guard,
    checkBefore:    start.checkBefore,
    validate:       start.validate,
    file:           fileResult,
    sendFile:       fileResult,
    download:       downloadResult,
    render:         renderResult
});

Object.defineProperties($, {
    $:          { value: $, enumerable: true },
    default:    { value: $, enumerable: false },
    STATUSES:   { value: STATUSES, enumerable: true },
    HttpError:  { value: HttpError, enumerable: true }
});
