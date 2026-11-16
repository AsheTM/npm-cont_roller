import type { CookieOptions } from 'express';
import type { AnyStatusCode, ContentType } from './types.js';
import { addCookie, emptyParts, setHeaders, type Headers, type ResponseParts } from './response.js';
import { assertStatusCode } from './status.js';

const RESULT_BRAND = Symbol.for('@ashetm/cont_roller/result');

/** Extra response settings for a result helper. */
export interface ResultOptions {
    headers?:   Headers;
    cookies?:   ReadonlyArray<{ name: string; value: unknown; options?: CookieOptions }>;
    type?:      ContentType;
}

/**
 * A complete response (status, body, headers, cookies, type) returned by the `$.*` helpers.
 * Return it from a handler, or pass it to a guard. Immutable: safe to reuse across requests.
 */
export interface Result<B = unknown> {
    readonly status:    number;
    readonly body:      B;
    /** @internal */
    readonly parts:     ResponseParts;
    /** @internal */
    readonly [RESULT_BRAND]: true;
}

export function createResult<B>(status: number, body: B, options?: ResultOptions): Result<B> {
    assertStatusCode(status);
    const parts = emptyParts();
    parts.status = status;
    if (options?.headers)
        setHeaders(parts, options.headers);
    for (const cookie of options?.cookies ?? [])
        addCookie(parts, cookie.name, cookie.value, cookie.options);
    if (options?.type !== undefined)
        parts.type = options.type;
    return Object.freeze({ status, body, parts, [RESULT_BRAND]: true as const });
}

/** True when `value` was created by a `$.*` helper (works across ESM/CJS copies). */
export function isResult(value: unknown): value is Result {
    return typeof value === 'object' && value !== null && (value as Record<symbol, unknown>)[RESULT_BRAND] === true;
}

/** `$.status(code, body?, options?)`: generic result helper. */
export function statusResult<B = undefined>(code: AnyStatusCode, body?: B, options?: ResultOptions): Result<B> {
    return createResult(code, body as B, options);
}

/** `$.redirect(url, code = 302)`: redirect result with a Location header. */
export function redirectResult(url: string, code: AnyStatusCode = 302, options?: ResultOptions): Result<undefined> {
    if (typeof url !== 'string' || url === '')
        throw new TypeError('$.redirect(url): url must be a non-empty string');
    if (code < 300 || code > 399)
        throw new RangeError(`$.redirect(): ${code} is not a 3xx status`);
    return createResult(code, undefined, { ...options, headers: { ...options?.headers, Location: url } });
}
