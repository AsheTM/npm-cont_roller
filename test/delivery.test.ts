import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { readFile } from 'node:fs';
import { fileURLToPath } from 'node:url';
import $ from '../src/index.js';
import { resetConfig } from '../src/config.js';

const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));
const HELLO = `${FIXTURES}hello.txt`;

/** App with a tiny `{{name}}` view engine and an error middleware reporting forwarded errors. */
function app(handler: express.RequestHandler) {
    const a = express();
    a.engine('tpl', (path, locals, done) => readFile(path, 'utf8', (error, text) =>
        error ? done(error) : done(null, text.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => String((locals as Record<string, unknown>)[key])))));
    a.set('views', `${FIXTURES}views`);
    a.set('view engine', 'tpl');
    a.get('/x', handler);
    a.use(((err, _req, res, _next) => {
        res.status(599).json({ forwarded: (err as { status?: number }).status ?? 'none' });
    }) as express.ErrorRequestHandler);
    return a;
}
const get = (handler: express.RequestHandler) => request(app(handler)).get('/x');

describe('$.file() / $.sendFile()', () => {
    afterEach(() => resetConfig());

    it('sends the file', async () => {
        const res = await get($(() => $.file(HELLO)));
        expect(res.status).toBe(200);
        expect(res.text).toBe('hello file\n');
        expect(res.headers['content-type']).toMatch(/^text\/plain/);
    });

    it('$.sendFile is an alias', () => {
        expect($.sendFile).toBe($.file);
    });

    it('passes Express options (root, maxAge)', async () => {
        const res = await get($(() => $.file('hello.txt', { root: FIXTURES, maxAge: 60_000 })));
        expect(res.text).toBe('hello file\n');
        expect(res.headers['cache-control']).toBe('public, max-age=60');
    });

    it('keeps the builder status and headers, and the result headers, cookies and type', async () => {
        const res = await get($(() => $.file(HELLO, { headers: { 'X-B': '2' }, cookies: [{ name: 'c', value: '1' }], type: 'text/markdown' }))
            .accepted().header('X-A', '1'));
        expect(res.status).toBe(202);
        expect(res.headers['x-a']).toBe('1');
        expect(res.headers['x-b']).toBe('2');
        expect(res.headers['set-cookie']?.[0]).toMatch(/^c=1/);
        expect(res.headers['content-type']).toMatch(/^text\/markdown/);
    });

    it('can be a guard failure', async () => {
        const res = await get($(() => 'secret').guard(() => false, $.file(HELLO)));
        expect(res.text).toBe('hello file\n');
    });

    it('missing file: forwarded to next(err) with status 404 by default', async () => {
        const res = await get($(() => $.file(`${FIXTURES}missing.txt`)));
        expect(res.status).toBe(599);
        expect(res.body).toEqual({ forwarded: 404 });
    });

    it('missing file in respond mode: 404 without the path', async () => {
        $.config({ errors: 'respond' });
        const res = await get($(() => $.file(`${FIXTURES}missing.txt`)));
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Not Found' });
    });

    it('relative path without root: error handling as usual', async () => {
        expect((await get($(() => $.file('hello.txt')))).status).toBe(599);
        $.config({ errors: 'respond' });
        const res = await get($(() => $.file('hello.txt')));
        expect(res.status).toBe(500);
        expect(res.body.error).toMatch(/absolute/);
    });

    it('.run() describes the file without reading it', async () => {
        const res = await $(() => $.file('a.pdf', { root: '/data', headers: { 'X-A': '1' } })).run();
        expect(res).toMatchObject({ status: 200, body: { file: 'a.pdf', options: { root: '/data' } }, headers: { 'x-a': '1' } });
    });

    it.each([[''], [42]])('rejects path %j', (path) => {
        expect(() => $.file(path as never)).toThrow(TypeError);
    });
});

describe('$.download()', () => {
    it('sends an attachment with the given name', async () => {
        const res = await get($(() => $.download(HELLO, 'report.txt')));
        expect(res.status).toBe(200);
        expect(res.headers['content-disposition']).toMatch(/^attachment; filename="?report\.txt"?$/);
        expect(res.text).toBe('hello file\n');
    });

    it('defaults the name to the file name', async () => {
        expect((await get($(() => $.download(HELLO)))).headers['content-disposition']).toMatch(/^attachment; filename="?hello\.txt"?$/);
    });

    it('.run() describes the download', async () => {
        expect((await $(() => $.download('/d/a.csv', 'b.csv')).run()).body).toEqual({ download: '/d/a.csv', filename: 'b.csv', options: {} });
    });

    it('rejects an empty filename', () => {
        expect(() => $.download(HELLO, '')).toThrow(TypeError);
    });
});

describe('$.render()', () => {
    afterEach(() => resetConfig());

    it('renders the view with the locals and sends HTML', async () => {
        const res = await get($(() => $.render('hello', { name: 'Ada' })).created());
        expect(res.status).toBe(201);
        expect(res.text).toBe('<h1>Hello Ada</h1>');
        expect(res.headers['content-type']).toMatch(/^text\/html/);
    });

    it('missing view: next(err) by default, 500 in respond mode', async () => {
        expect((await get($(() => $.render('nope')))).status).toBe(599);
        $.config({ errors: 'respond' });
        expect((await get($(() => $.render('nope')))).status).toBe(500);
    });

    it('.run() describes the view without rendering it', async () => {
        expect((await $(() => $.render('profile', { id: 1 })).run()).body).toEqual({ render: 'profile', locals: { id: 1 } });
    });

    it('rejects invalid arguments', () => {
        expect(() => $.render('')).toThrow(TypeError);
        expect(() => $.render('v', 'x' as never)).toThrow(TypeError);
    });
});
