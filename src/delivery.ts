import type { Response } from 'express';
import { createResult, type Result, type ResultOptions } from './result.js';

const DELIVERY_BRAND = Symbol.for('@ashetm/cont_roller/delivery');

/** Express `res.sendFile()` options (`headers` is the result's own option). */
export interface SendFileOptions {
    /** Root directory for a relative `path`. */
    root?:          string;
    /** Cache-Control max-age, in milliseconds or a string like `'1d'`. */
    maxAge?:        number | string;
    lastModified?:  boolean;
    dotfiles?:      'allow' | 'deny' | 'ignore';
    acceptRanges?:  boolean;
    cacheControl?:  boolean;
    immutable?:     boolean;
}

/** Options of `$.file()` / `$.download()`: the Express options, plus the result's `headers`, `cookies` and `type`. */
export interface FileOptions extends SendFileOptions, ResultOptions {}

/** Body of `$.file()`, as `.run()` returns it: nothing is read. */
export interface FileBody {
    readonly file:      string;
    readonly options:   SendFileOptions;
}

/** Body of `$.download()`, as `.run()` returns it: nothing is read. */
export interface DownloadBody {
    readonly download:  string;
    readonly filename:  string | undefined;
    readonly options:   SendFileOptions;
}

/** Body of `$.render()`, as `.run()` returns it: nothing is rendered. */
export interface RenderBody {
    readonly render:    string;
    readonly locals:    object | undefined;
}

export type Delivery = FileBody | DownloadBody | RenderBody;

function brand<D extends Delivery>(body: D): D {
    Object.defineProperty(body, DELIVERY_BRAND, { value: true });
    return Object.freeze(body);
}

export function isDelivery(value: unknown): value is Delivery {
    return typeof value === 'object' && value !== null && (value as Record<symbol, unknown>)[DELIVERY_BRAND] === true;
}

function assertPath(path: unknown, helper: string): asserts path is string {
    if (typeof path !== 'string' || path === '')
        throw new TypeError(`$.${helper}(path): path must be a non-empty string`);
}

/** Splits the options between the result (`headers`, `cookies`, `type`) and Express. */
function split(options: FileOptions = {}): [ResultOptions, SendFileOptions] {
    const { headers, cookies, type, ...express } = options;
    const result: ResultOptions = {};
    if (headers !== undefined)
        result.headers = headers;
    if (cookies !== undefined)
        result.cookies = cookies;
    if (type !== undefined)
        result.type = type;
    return [result, express];
}

/** `$.file(path, options?)` / `$.sendFile()`: sends a file with `res.sendFile()`. */
export function fileResult(path: string, options?: FileOptions): Result<FileBody> {
    assertPath(path, 'file');
    const [result, express] = split(options);
    return createResult(undefined, brand({ file: path, options: express }), result);
}

/** `$.download(path, filename?, options?)`: sends a file as an attachment with `res.download()`. */
export function downloadResult(path: string, filename?: string, options?: FileOptions): Result<DownloadBody> {
    assertPath(path, 'download');
    if (filename !== undefined && (typeof filename !== 'string' || filename === ''))
        throw new TypeError('$.download(path, filename): filename must be a non-empty string');
    const [result, express] = split(options);
    return createResult(undefined, brand({ download: path, filename, options: express }), result);
}

/** `$.render(view, locals?, options?)`: renders a view with `res.render()` and sends the HTML. */
export function renderResult(view: string, locals?: object, options?: ResultOptions): Result<RenderBody> {
    if (typeof view !== 'string' || view === '')
        throw new TypeError('$.render(view): view must be a non-empty string');
    if (locals !== undefined && (typeof locals !== 'object' || locals === null))
        throw new TypeError('$.render(view, locals): locals must be an object');
    return createResult(undefined, brand({ render: view, locals }), options);
}

/** A client that went away is not an error worth reporting. */
export function isAborted(error: unknown, res: Response): boolean {
    const code = (error as { code?: unknown } | null)?.code;
    return code === 'ECONNABORTED' || code === 'ECONNRESET' || code === 'ERR_STREAM_PREMATURE_CLOSE' || (res.destroyed && !res.writableFinished);
}

/** Sends a delivery with Express; resolves when done, rejects with Express's error. */
export function deliver(res: Response, body: Delivery): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const done = (error?: unknown) => {
            if (error && !isAborted(error, res))
                reject(error);
            else
                resolve();
        };
        if ('file' in body)
            res.sendFile(body.file, body.options, done);
        else if ('download' in body)
            res.download(body.download, body.filename ?? basename(body.download), body.options, done);
        else
            res.render(body.render, body.locals ?? {}, (error: Error | null, html: string) => {
                if (error)
                    return done(error);
                res.send(html);
                resolve();
            });
    });
}

function basename(path: string): string {
    return path.split(/[\\/]/).pop() || path;
}
