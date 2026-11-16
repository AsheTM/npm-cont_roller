// Files, views, streams and ctx.res end to end, through the built package (CommonJS and ES module).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import type { Dollar } from '../src/index.js';

const require = createRequire(import.meta.url);
const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));

function app($: Dollar) {
    const a = express();
    a.engine('tpl', (path, locals, done) => readFile(path, 'utf8', (error, text) =>
        error ? done(error) : done(null, text.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => String((locals as Record<string, unknown>)[key])))));
    a.set('views', `${FIXTURES}views`);
    a.set('view engine', 'tpl');

    const loggedIn = $.guard((req) => req.headers.authorization === 'yes', $.unauthorized());
    // validated file name, then sent from a root directory
    a.get('/files/:name', loggedIn.validate({ params: z.object({ name: z.string().regex(/^[\w.]+$/) }) })
        .handle((req) => $.file(req.params.name, { root: FIXTURES, headers: { 'Cache-Control': 'no-store' } })));
    a.get('/download', $(() => $.download(`${FIXTURES}hello.txt`, 'export.txt')));
    a.get('/view', $((req) => $.render('hello', { name: req.query.name })));
    a.get('/node-stream', $(() => Readable.from(['n', 'o', 'd', 'e'])).type('text'));
    a.get('/web-stream', $(() => $.pipe(new Response('web body').body!, { type: 'text' })).accepted());
    a.get('/events', $(async (_req, ctx) => {
        ctx.res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        ctx.res.write('data: 1\n\n');
        ctx.res.end('data: 2\n\n');
    }));
    a.use(((err, _req, res, _next) => { res.status(599).json({ status: (err as { status?: number }).status }); }) as express.ErrorRequestHandler);
    return a;
}

async function scenario($: Dollar) {
    const a = app($);
    const file = await request(a).get('/files/hello.txt').set('Authorization', 'yes');
    expect(file.status).toBe(200);
    expect(file.text).toBe('hello file\n');
    expect(file.headers['cache-control']).toBe('no-store');
    expect((await request(a).get('/files/hello.txt')).status).toBe(401);
    expect((await request(a).get('/files/..%2Fsecret').set('Authorization', 'yes')).status).toBe(400);
    expect((await request(a).get('/files/missing.txt').set('Authorization', 'yes')).body).toEqual({ status: 404 });

    expect((await request(a).get('/download')).headers['content-disposition']).toMatch(/^attachment; filename="?export\.txt"?$/);
    expect((await request(a).get('/view?name=Ada')).text).toBe('<h1>Hello Ada</h1>');
    expect((await request(a).get('/node-stream')).text).toBe('node');
    const web = await request(a).get('/web-stream');
    expect(web.status).toBe(202);
    expect(web.text).toBe('web body');
    expect((await request(a).get('/events')).text).toBe('data: 1\n\ndata: 2\n\n');

    expect((await $(() => $.file('a.pdf', { root: '/data' })).run()).body).toEqual({ file: 'a.pdf', options: { root: '/data' } });
}

describe('built package: files, views, streams, ctx.res', () => {
    it('CommonJS', async () => {
        await scenario(require('../dist/index.cjs') as Dollar);
    });

    it('ES module', async () => {
        const entry = '../dist/index.js';
        await scenario((await import(entry) as { default: Dollar }).default);
    });
});
