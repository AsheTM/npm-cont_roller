import type { Response } from 'express';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { createResult, type Result, type ResultOptions } from './result.js';
import { isAborted } from './delivery.js';

/** A body sent by piping it: a Node readable stream or a web `ReadableStream`. */
export type StreamSource = Readable | NodeJS.ReadableStream | WebReadableStream | globalThis.ReadableStream;

function isNodeReadable(value: unknown): value is NodeJS.ReadableStream {
    const stream = value as { pipe?: unknown; on?: unknown; read?: unknown } | null;
    return typeof stream === 'object' && stream !== null
        && typeof stream.pipe === 'function' && typeof stream.on === 'function' && typeof stream.read === 'function';
}

function isWebReadable(value: unknown): value is WebReadableStream {
    return typeof value === 'object' && value !== null && typeof (value as { getReader?: unknown }).getReader === 'function';
}

export function isStream(value: unknown): value is StreamSource {
    return isNodeReadable(value) || isWebReadable(value);
}

function toNode(source: StreamSource): NodeJS.ReadableStream {
    return isWebReadable(source) ? Readable.fromWeb(source as WebReadableStream) : source as NodeJS.ReadableStream;
}

/** Releases a stream that will not be sent (204, 205, 304). */
export function discard(source: StreamSource): void {
    if (isWebReadable(source))
        void source.cancel().catch(() => undefined);
    else
        (source as Readable).destroy?.();
}

/**
 * Pipes the source to the response; resolves when it is sent or when the client went away
 * (the source is then destroyed). A source error rejects: before anything was sent the response is
 * still usable (error handling as usual); after, the connection is closed.
 */
export function pipeTo(res: Response, source: StreamSource): Promise<void> {
    const stream = toNode(source);
    return new Promise<void>((resolve, reject) => {
        stream.on('error', (error: Error) => {
            stream.unpipe(res);
            if (isAborted(error, res))
                return resolve();
            if (res.headersSent)
                res.destroy(error);
            reject(error);
        });
        res.on('finish', () => resolve());
        res.on('close', () => {
            if (!res.writableFinished)
                (stream as Readable).destroy?.();
            resolve();
        });
        stream.pipe(res);
    });
}

/** `$.stream(source, options?)` / `$.pipe()`: result with a stream body; the status comes from the builder or ctx. */
export function streamResult<S extends StreamSource>(source: S, options?: ResultOptions): Result<S> {
    if (!isStream(source))
        throw new TypeError('$.stream(source): source must be a readable stream (Node or web)');
    return createResult(undefined, source, options);
}
