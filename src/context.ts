import type { CookieOptions } from 'express';
import type { AnyStatusCode, ContentType, Context } from './types.js';
import { addCookie, setHeaders, type HeaderValue, type Headers, type ResponseParts } from './response.js';
import { assertStatusCode } from './status.js';

/** Creates the per-request context writing into `parts` (a per-request copy). */
export function createContext(parts: ResponseParts): Context {
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
    return ctx;
}
