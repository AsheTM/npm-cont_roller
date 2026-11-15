import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { $, appWith } from './helpers.js';

describe('basic responses', () => {
    it('sends the returned data with the success status', async () => {
        const handler = $(() => ({ data: ['a'] }))._200().if()._500();
        const res = await request(appWith(handler)).get('/test');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ data: ['a'] });
        expect(res.headers['content-type']).toMatch(/json/);
    });

    it('supports named status methods', async () => {
        const handler = $(() => ({ ok: 1 }))._CREATED().if()._500();
        const res = await request(appWith(handler)).get('/test');
        expect(res.status).toBe(201);
    });

    it('sends custom headers set through options', async () => {
        const handler = $((req, options) => {
            options.__headers__ = { 'X-Test': 'yes' };
            return { ok: 1 };
        })._200().if()._500();
        const res = await request(appWith(handler)).get('/test');
        expect(res.headers['x-test']).toBe('yes');
    });

    it('passes the request to the main callback', async () => {
        const handler = $((req) => ({ q: req.query.q }))._200().if()._500();
        const res = await request(appWith(handler)).get('/test?q=hello');
        expect(res.body).toEqual({ q: 'hello' });
    });
});
