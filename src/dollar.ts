import type { AnyStatusCode, Controller, Handler } from './types.js';
import type { Status } from './status.generated.js';
import { createHttpError, HttpError, isHttpError } from './error.js';
import { createResult, isResult, redirectResult, statusResult, type Result, type ResultOptions } from './result.js';
import { createController } from './controller.js';
import { STATUSES } from './status.generated.js';

/** The `$` entry point: `$(handler)` creates a controller; static helpers live on `$`. */
export interface Dollar {
    <T>(handler: Handler<T>): Controller<T>;
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
}

/**
 * One result helper per status code: `$.ok(body)`, `$.created(body, { headers })`, `$.notFound(body)`...
 * Not to be confused with the builder setters `$(handler).ok()`, which set the default success status.
 */
export type ResultHelpers = {
    [S in Status as S['name']]: <B = undefined>(body?: B, options?: ResultOptions) => Result<B>;
};

export interface Dollar extends ResultHelpers {}

function create<T>(handler: Handler<T>): Controller<T> {
    return createController(handler);
}

export const $ = create as unknown as Dollar;

/** Static members of `$`; generated status names must never collide with them. */
export const DOLLAR_MEMBERS = ['$', 'default', 'STATUSES', 'status', 'redirect', 'isResult', 'error', 'HttpError', 'isHttpError', 'config'] as const;

const helpers: Record<string, unknown> = {};
for (const { code, name } of STATUSES)
    helpers[name] = <B>(body?: B, options?: ResultOptions) => createResult(code, body as B, options);
Object.assign($, helpers, { status: statusResult, redirect: redirectResult, isResult, error: createHttpError, isHttpError });

Object.defineProperties($, {
    $:          { value: $, enumerable: true },
    default:    { value: $, enumerable: false },
    STATUSES:   { value: STATUSES, enumerable: true },
    HttpError:  { value: HttpError, enumerable: true }
});
