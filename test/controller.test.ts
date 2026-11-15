import { describe, it, expect } from 'vitest';
import request from 'supertest';
import $ from '../src/index.js';
import { appWith } from './helpers.js';

describe('$(handler)', () => {
    it('returns an Express middleware usable without a terminating call', async () => {
        const res = await request(appWith($(() => ({ ok: 1 })))).get('/test');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: 1 });
        expect(res.headers['content-type']).toMatch(/json/);
    });

    it('supports async handlers', async () => {
        const handler = $(async () => {
            await new Promise((r) => setTimeout(r, 5));
            return [1, 2, 3];
        });
        const res = await request(appWith(handler)).get('/test');
        expect(res.body).toEqual([1, 2, 3]);
    });

    it('passes the request to the handler', async () => {
        const res = await request(appWith($((req) => ({ q: req.query.q })))).get('/test?q=hi');
        expect(res.body).toEqual({ q: 'hi' });
    });

    it('passes a context object as second argument', async () => {
        const res = await request(appWith($((_req, ctx) => ({ type: typeof ctx })))).get('/test');
        expect(res.body).toEqual({ type: 'object' });
    });

    it('sends strings as text', async () => {
        const res = await request(appWith($(() => 'hello'))).get('/test');
        expect(res.text).toBe('hello');
        expect(res.headers['content-type']).toMatch(/text\/html/);
    });

    it('sends an empty body when the handler returns undefined', async () => {
        const res = await request(appWith($(() => undefined))).get('/test');
        expect(res.status).toBe(200);
        expect(res.text).toBe('');
    });

    it('sends null as JSON', async () => {
        const res = await request(appWith($(() => null))).get('/test');
        expect(res.text).toBe('null');
    });

    it('forwards thrown errors to next(err)', async () => {
        const res = await request(appWith($(() => { throw new Error('boom'); }))).get('/test');
        expect(res.status).toBe(599);
        expect(res.body).toEqual({ forwarded: 'boom' });
    });

    it('forwards rejected promises to next(err)', async () => {
        const res = await request(appWith($(async () => { throw new Error('async boom'); }))).get('/test');
        expect(res.body).toEqual({ forwarded: 'async boom' });
    });

    it('rejects a non-function handler', () => {
        // @ts-expect-error: invalid on purpose
        expect(() => $('nope')).toThrow(TypeError);
    });

    it('isolates calls: each request runs the handler again', async () => {
        let count = 0;
        const app = appWith($(() => ({ count: ++count })));
        await request(app).get('/test');
        const res = await request(app).get('/test');
        expect(res.body).toEqual({ count: 2 });
    });
});
