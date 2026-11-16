import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { fileURLToPath } from 'node:url';
import $ from '../src/index.js';

const HELLO = fileURLToPath(new URL('./fixtures/hello.txt', import.meta.url));

function app(handler: express.RequestHandler, errors: unknown[] = []) {
    const a = express();
    a.get('/x', (_req, res, next) => { res.locals.marker = 'express-res'; next(); }, handler);
    a.use(((err, _req, res, next) => {
        errors.push(err);
        if (res.headersSent)
            return next(err);
        res.status(599).json({ forwarded: (err as Error).message });
    }) as express.ErrorRequestHandler);
    return a;
}

describe('ctx.res', () => {
    it('is the Express response', async () => {
        const res = await request(app($((_req, ctx) => ({ marker: ctx.res.locals.marker })))).get('/x');
        expect(res.body).toEqual({ marker: 'express-res' });
    });

    it('Server-Sent Events: the handler writes, cont_roller sends nothing', async () => {
        const errors: unknown[] = [];
        const sse = $(async (_req, ctx) => {
            ctx.res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            for (const event of ['a', 'b']) {
                ctx.res.write(`data: ${event}\n\n`);
                await new Promise((resolve) => setTimeout(resolve, 5));
            }
            ctx.res.end();
        });
        const res = await request(app(sse, errors)).get('/x');
        expect(res.headers['content-type']).toBe('text/event-stream');
        expect(res.text).toBe('data: a\n\ndata: b\n\n');
        expect(errors).toEqual([]);
    });

    it('an Express method not awaited (res.sendFile) is not answered twice', async () => {
        const errors: unknown[] = [];
        const res = await request(app($((_req, ctx) => { ctx.res.sendFile(HELLO); }), errors)).get('/x');
        expect(res.text).toBe('hello file\n');
        expect(errors).toEqual([]);
    });

    it('a response already sent is not sent again, even with a returned value', async () => {
        const errors: unknown[] = [];
        const res = await request(app($((_req, ctx) => { ctx.res.status(207).json({ raw: true }); return { ignored: true }; }), errors)).get('/x');
        expect(res.status).toBe(207);
        expect(res.body).toEqual({ raw: true });
        expect(errors).toEqual([]);
    });

    it('reading ctx.res and returning a value: cont_roller sends the value', async () => {
        const res = await request(app($((_req, ctx) => { ctx.res.setHeader('X-Raw', '1'); return { ok: true }; }).created())).get('/x');
        expect(res.status).toBe(201);
        expect(res.headers['x-raw']).toBe('1');
        expect(res.body).toEqual({ ok: true });
    });

    it('after-guards are skipped when the handler answered', async () => {
        const res = await request(app($((_req, ctx) => { ctx.res.send('mine'); }).if(() => false, $.notFound()))).get('/x');
        expect(res.status).toBe(200);
        expect(res.text).toBe('mine');
    });

    it('guards still run before the handler', async () => {
        let ran = false;
        const res = await request(app($((_req, ctx) => { ran = true; ctx.res.end(); }).guard(() => false, $.unauthorized()))).get('/x');
        expect(res.status).toBe(401);
        expect(ran).toBe(false);
    });

    it('an error thrown after the response started goes to next(err)', async () => {
        const errors: unknown[] = [];
        const c = $((_req, ctx) => {
            ctx.res.write('partial');
            throw $.error(404);
        });
        await request(app(c, errors)).get('/x').catch(() => undefined);
        expect(errors).toHaveLength(1);
        expect((errors[0] as { status?: number }).status).toBe(404);
    });

    it('is not available in .run()', async () => {
        await expect($((_req, ctx) => ctx.res.end()).run()).rejects.toThrow('ctx.res is not available in .run()');
    });

    it('is not enumerable on ctx', () => {
        let keys: string[] = [];
        void $((_req, ctx) => { keys = Object.keys(ctx); }).run();
        expect(keys).not.toContain('res');
    });
});
