import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import $ from '../src/index.js';
import { resetConfig } from '../src/config.js';

const HELLO = fileURLToPath(new URL('./fixtures/hello.txt', import.meta.url));

function app(handler: express.RequestHandler, errors: unknown[] = []) {
    const a = express();
    a.get('/x', handler);
    a.use(((err, _req, res, next) => {
        errors.push(err);
        if (res.headersSent)
            return next(err);
        res.status(599).json({ forwarded: (err as Error).message });
    }) as express.ErrorRequestHandler);
    return a;
}
const get = (handler: express.RequestHandler) => request(app(handler)).get('/x');

const web = (...chunks: string[]) => new ReadableStream<Uint8Array>({
    start(controller) {
        for (const chunk of chunks)
            controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
    }
});
const failing = (before: string[] = []) => new Readable({
    read() {
        const chunk = before.shift();
        if (chunk !== undefined)
            this.push(chunk);
        else
            setImmediate(() => this.destroy(new Error('source failed')));
    }
});

describe('returned streams', () => {
    afterEach(() => resetConfig());

    it('pipes a returned Node stream', async () => {
        const res = await get($(() => Readable.from(['a', 'b', 'c'])).type('text'));
        expect(res.status).toBe(200);
        expect(res.text).toBe('abc');
    });

    it('pipes a file stream', async () => {
        expect((await get($(() => createReadStream(HELLO)).type('text'))).text).toBe('hello file\n');
    });

    it('pipes a returned web ReadableStream', async () => {
        expect((await get($(() => web('we', 'b')).type('text'))).text).toBe('web');
    });

    it('keeps the builder status and headers', async () => {
        const res = await get($(() => Readable.from(['x'])).created().header('X-A', '1').type('text/csv'));
        expect(res.status).toBe(201);
        expect(res.headers['x-a']).toBe('1');
        expect(res.headers['content-type']).toMatch(/^text\/csv/);
    });

    it('a result can carry a stream: $.ok(stream)', async () => {
        expect((await get($(() => $.accepted(Readable.from(['ok']), { type: 'text' })))).text).toBe('ok');
    });

    it('source error before any data: next(err) by default, 500 in respond mode', async () => {
        expect((await get($(() => failing()))).body).toEqual({ forwarded: 'source failed' });
        $.config({ errors: 'respond' });
        const res = await get($(() => failing()));
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'source failed' });
    });

    it('source error after data: the connection is closed and the error forwarded', async () => {
        const errors: unknown[] = [];
        await expect(request(app($(() => failing(['partial'])).type('text'), errors)).get('/x')).rejects.toThrow();
        expect(errors).toHaveLength(1);
        expect((errors[0] as Error).message).toBe('source failed');
    });

    it('client disconnect destroys the source, without error', async () => {
        const errors: unknown[] = [];
        let destroyed!: () => void;
        const closed = new Promise<void>((resolve) => { destroyed = resolve; });
        const endless = new Readable({
            read() { setTimeout(() => this.push('tick\n'), 5); },
            destroy(error, callback) { destroyed(); callback(error); }
        });
        const server = app($(() => endless).type('text'), errors).listen(0);
        try {
            const { port } = server.address() as AddressInfo;
            await new Promise<void>((resolve) => {
                const req = http.get({ port, path: '/x' }, (res) => res.once('data', () => { req.destroy(); resolve(); }));
                req.on('error', () => undefined);
            });
            await closed;
            expect(errors).toEqual([]);
        } finally {
            server.close();
        }
    });

    it('no body for 204: the stream is released', async () => {
        const source = Readable.from(['never']);
        const res = await get($(() => source).noContent());
        expect(res.status).toBe(204);
        expect(source.destroyed).toBe(true);
    });

    it('.run() returns the stream itself, not consumed', async () => {
        const source = Readable.from(['x']);
        const res = await $(() => $.stream(source, { type: 'text' })).run();
        expect(res.body).toBe(source);
        expect(res.type).toBe('text');
        expect(source.readableFlowing).toBe(null);
    });
});

describe('$.stream() / $.pipe()', () => {
    it('pipes the source with the result options, status from the builder', async () => {
        const res = await get($(() => $.stream(web('s'), { type: 'text', headers: { 'X-S': '1' } })).accepted());
        expect(res.status).toBe(202);
        expect(res.text).toBe('s');
        expect(res.headers['x-s']).toBe('1');
    });

    it('$.pipe is an alias', () => {
        expect($.pipe).toBe($.stream);
    });

    it.each([['a string', 'x'], ['an object', {}], ['null', null]])('rejects %s', (_label, source) => {
        expect(() => $.stream(source as never)).toThrow(TypeError);
    });
});
