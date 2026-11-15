import type { AnyStatusCode } from './types.js';
import { createResult, type Result, type ResultOptions } from './result.js';
import { STATUSES } from './status.generated.js';

const ERROR_BRAND = Symbol.for('@ashetm/cont_roller/http-error');

function reasonPhrase(status: number): string {
    return STATUSES.find((s) => s.code === status)?.text ?? 'Error';
}

/**
 * An error that becomes an HTTP response when thrown from a handler or a guard.
 * Create it with `$.error(status, body?, options?)`.
 */
export class HttpError<B = unknown> extends Error {
    override readonly name = 'HttpError';
    readonly status:    number;
    readonly body:      B;
    /** The response sent when this error is thrown. */
    readonly result:    Result<B>;
    /** @internal */
    readonly [ERROR_BRAND] = true as const;

    constructor(status: AnyStatusCode, body?: B, options?: ResultOptions) {
        const resolvedBody = (body === undefined ? { error: reasonPhrase(status) } : body) as B;
        const result = createResult(status, resolvedBody, options);
        super(typeof (resolvedBody as { error?: unknown })?.error === 'string'
            ? (resolvedBody as { error: string }).error
            : reasonPhrase(status));
        this.status = status;
        this.body = resolvedBody;
        this.result = result;
    }
}

/** True for an `HttpError` (works across ESM/CJS copies). */
export function isHttpError(value: unknown): value is HttpError {
    return typeof value === 'object' && value !== null && (value as Record<symbol, unknown>)[ERROR_BRAND] === true;
}

/** `$.error(status, body?, options?)`: creates a throwable `HttpError`. */
export function createHttpError<B = undefined>(status: AnyStatusCode, body?: B, options?: ResultOptions): HttpError<B extends undefined ? { error: string } : B> {
    return new HttpError(status, body, options) as HttpError<B extends undefined ? { error: string } : B>;
}
