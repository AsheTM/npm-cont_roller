import type { CookieOptions, Response } from 'express';
import type { AnyStatusCode, ContentType, Context } from './types.js';
import { addCookie, setHeaders, type HeaderValue, type Headers, type ResponseParts } from './response.js';
import { assertStatusCode } from './status.js';

/** Contexts whose `ctx.res` was read by the handler. */
const resUsed = new WeakSet<Context>();

/** True when the handler read `ctx.res`. */
export function usedResponse(ctx: Context): boolean {
    return resUsed.has(ctx);
}

/**
 * Creates the per-request context writing into `parts` (a per-request copy).
 * `res` is the Express response; without it (`.run()`), reading `ctx.res` throws.
 */
export function createContext(parts: ResponseParts, res?: Response): Context {
    const ctx: Context = {
        header(nameOrHeaders: string | Headers, value?: HeaderValue) {
            setHeaders(parts, nameOrHeaders, value);
            return ctx;
        },
        cookie(name: string, value: unknown, options?: CookieOptions) {
            addCookie(parts, name, value, options);
            return ctx;
        },
        clearCookie(name: string, options?: CookieOptions) {
            if (typeof name !== 'string' || name === '')
                throw new TypeError('cookie name must be a non-empty string');
            parts.cookies.push(options === undefined ? { name, clear: true } : { name, options, clear: true });
            return ctx;
        },
        type(type: ContentType) {
            if (typeof type !== 'string' || type === '')
                throw new TypeError('type must be a non-empty string');
            parts.type = type;
            return ctx;
        },
        status(code: AnyStatusCode) {
            assertStatusCode(code);
            parts.status = code;
            return ctx;
        }
    } as Context;
    Object.defineProperty(ctx, 'res', {
        enumerable: false,
        get(): Response {
            if (res === undefined)
                throw new Error('ctx.res is not available in .run(): test this controller over HTTP (supertest)');
            resUsed.add(ctx);
            return res;
        }
    });
    return ctx;
}
