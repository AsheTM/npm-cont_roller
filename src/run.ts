import type { Request } from 'express';
import type { ControllerState, Handler } from './types.js';
import type { CookieEntry, HeaderValue } from './response.js';
import { NO_BODY_STATUSES } from './response.js';
import { execute } from './pipeline.js';

/** A request for `controller.run()`: only the fields the controller uses (`params`, `query`, `body`, `headers`, `user`...). */
export type RunRequest = Partial<Omit<Request, 'headers'>> & {
    /** Header names are case-insensitive, like in Express. */
    headers?: Record<string, string | string[] | undefined>;
    [key: string]: unknown;
};

/** The response produced by `controller.run()`, as a plain object. */
export interface RunResult<B = unknown> {
    status:     number;
    /** The raw value (not serialized); `undefined` for 204, 205 and 304. */
    body:       B;
    /** Response headers, with lowercase names. */
    headers:    Record<string, HeaderValue>;
    /** Cookies set (or cleared, with `clear: true`), in order. */
    cookies:    CookieEntry[];
    /** Content type set by the builder, ctx or result, if any. */
    type:       string | undefined;
}

/** Builds a minimal Express-like request from a plain object; missing fields get empty defaults. */
export function createRequest(input: RunRequest = {}): Request {
    const headers: Record<string, string | string[] | undefined> = {};
    for (const [name, value] of Object.entries(input.headers ?? {}))
        headers[name.toLowerCase()] = value;
    const req = {
        method:         'GET',
        url:            '/',
        path:           '/',
        params:         {},
        query:          {},
        body:           undefined,
        cookies:        {},
        signedCookies:  {},
        ...input,
        headers
    } as unknown as Request;
    const get = (name: string) => headers[name.toLowerCase()];
    Object.assign(req, { get, header: get });
    return req;
}

export async function run<B, T>(state: ControllerState, handler: Handler<T>, input?: RunRequest): Promise<RunResult<B>> {
    const { parts, body } = await execute(state, handler, createRequest(input));
    const status = parts.status ?? 200;
    const headers: Record<string, HeaderValue> = {};
    for (const [key, { value }] of parts.headers)
        headers[key] = value;
    return {
        status,
        body:       (NO_BODY_STATUSES.has(status) ? undefined : body) as B,
        headers,
        cookies:    parts.cookies.map((cookie) => ({ ...cookie })),
        type:       parts.type
    };
}
