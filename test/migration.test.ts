// Checks the v2 snippets of MIGRATION.md.
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import $ from '../src/index.js';

const appWith = (handler: express.RequestHandler) => express().get('/test', handler);

describe('MIGRATION.md', () => {
    const cont = (items: string[]) => $((_req, ctx) => {
        ctx.header('X-Foo', 'bar').cookie('sid', 'abc', { httpOnly: true }).type('json');
        return { data: items };
    })._200().if((_req, data) => data.data.length > 0, $.notFound({ error: 'Nothing found' }));

    it('"at a glance" v2 example behaves like the v1 one', async () => {
        const ok = await request(appWith(cont(['...']))).get('/test');
        expect(ok.status).toBe(200);
        expect(ok.body).toEqual({ data: ['...'] });
        expect(ok.headers['x-foo']).toBe('bar');
        expect(ok.headers['set-cookie']![0]).toMatch(/^sid=abc.*HttpOnly/);

        const empty = await request(appWith(cont([]))).get('/test');
        expect(empty.status).toBe(404);
        expect(empty.body).toEqual({ error: 'Nothing found' });
    });

    it('.if(fn, $.error(404).result) sends { error: "Not Found" }', async () => {
        const res = await request(appWith($(() => 1).if(() => false, $.error(404).result))).get('/test');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Not Found' });
    });

    it('.if(fn, $.notFound()) sends an empty body', async () => {
        const res = await request(appWith($(() => 1).if(() => false, $.notFound()))).get('/test');
        expect(res.status).toBe(404);
        expect(res.text).toBe('');
    });

    it('explicit v1-style error bodies stay possible', async () => {
        const res = await request(appWith($(() => { throw $.error(404, { __error__: 'Not Found' }); }))).get('/test');
        expect(res.body).toEqual({ __error__: 'Not Found' });
    });
});
