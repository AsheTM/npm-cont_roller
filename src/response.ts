import type { CookieOptions, Response } from 'express';
import { deliver, isDelivery } from './delivery.js';
import { discard, isStream, pipeTo } from './stream.js';

/** A header value accepted by Express. */
export type HeaderValue = string | number | readonly string[];

/** Headers as an object: `{ 'Cache-Control': 'no-store' }`. */
export type Headers = Record<string, HeaderValue>;

/** A cookie to set, or to clear when `clear` is true. */
export interface CookieEntry {
    name:       string;
    value?:     unknown;
    options?:   CookieOptions;
    clear?:     boolean;
}

/**
 * Everything about a response except its body. Layered in this order:
 * builder defaults, then per-request `ctx`, then a returned result.
 */
export interface ResponseParts {
    status?:    number;
    headers:    Map<string, { name: string; value: HeaderValue }>;
    cookies:    CookieEntry[];
    type?:      string;
}

export function emptyParts(): ResponseParts {
    return { headers: new Map(), cookies: [] };
}

/** Deep enough copy so per-request changes never touch the source (see v1 #9). */
export function cloneParts(parts: ResponseParts): ResponseParts {
    const copy: ResponseParts = {
        headers: new Map(parts.headers),
        cookies: parts.cookies.map((cookie) => ({ ...cookie }))
    };
    if (parts.status !== undefined)
        copy.status = parts.status;
    if (parts.type !== undefined)
        copy.type = parts.type;
    return copy;
}

/** Sets a header; names are case-insensitive, the last write wins. */
export function setHeader(parts: ResponseParts, name: string, value: HeaderValue): void {
    if (typeof name !== 'string' || name === '')
        throw new TypeError('header name must be a non-empty string');
    parts.headers.set(name.toLowerCase(), { name, value });
}

export function setHeaders(parts: ResponseParts, nameOrHeaders: string | Headers, value?: HeaderValue): void {
    if (typeof nameOrHeaders === 'string') {
        if (value === undefined)
            throw new TypeError(`header "${nameOrHeaders}" needs a value`);
        setHeader(parts, nameOrHeaders, value);
        return;
    }
    for (const [name, headerValue] of Object.entries(nameOrHeaders))
        setHeader(parts, name, headerValue);
}

export function addCookie(parts: ResponseParts, name: string, value: unknown, options?: CookieOptions): void {
    if (typeof name !== 'string' || name === '')
        throw new TypeError('cookie name must be a non-empty string');
    const entry: CookieEntry = { name, value };
    if (options !== undefined)
        entry.options = options;
    parts.cookies.push(entry);
}

/** Merges `top` over `base` into a new object. */
export function mergeParts(base: ResponseParts, top: ResponseParts): ResponseParts {
    const merged = cloneParts(base);
    for (const [key, header] of top.headers)
        merged.headers.set(key, header);
    merged.cookies.push(...top.cookies.map((cookie) => ({ ...cookie })));
    if (top.status !== undefined)
        merged.status = top.status;
    if (top.type !== undefined)
        merged.type = top.type;
    return merged;
}

export const NO_BODY_STATUSES = new Set([204, 205, 304]);

/**
 * Writes the parts and `body` to the Express response. Resolves when a file, a download, a view or
 * a stream is sent, and rejects with Express's or the stream's error.
 */
export async function send(res: Response, parts: ResponseParts, body: unknown): Promise<void> {
    res.status(parts.status ?? 200);
    for (const { name, value } of parts.headers.values())
        res.setHeader(name, typeof value === 'number' ? String(value) : value as string | string[]);
    for (const cookie of parts.cookies) {
        if (cookie.clear)
            res.clearCookie(cookie.name, cookie.options);
        else
            res.cookie(cookie.name, cookie.value, cookie.options ?? {});
    }
    if (parts.type !== undefined)
        res.type(parts.type);

    if (body === undefined || NO_BODY_STATUSES.has(parts.status ?? 200)) {
        if (isStream(body))
            discard(body);
        res.end();
        return;
    }
    if (isDelivery(body))
        return deliver(res, body);
    if (isStream(body))
        return pipeTo(res, body);
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
        res.send(body);
        return;
    }
    if (parts.type !== undefined && !/json/i.test(parts.type)) {
        res.send(body);
        return;
    }
    res.json(body);
}
