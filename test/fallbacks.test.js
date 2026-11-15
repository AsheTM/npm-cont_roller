import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { $, appWith } from './helpers.js';

describe('response fallbacks', () => {
    it('falls back to the default content type when options clears it', async () => {
        const handler = $((req, options) => {
            options.__contentType__ = null;
            return { ok: 1 };
        })._200().if()._500();
        const res = await request(appWith(handler)).get('/test');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/json/);
        expect(res.body).toEqual({ ok: 1 });
    });

    it('uses headers returned in data when options clears them', async () => {
        const handler = $((req, options) => {
            options.__headers__ = null;
            return { __headers__: { 'X-From-Data': '1' }, ok: 1 };
        })._200().if()._500();
        const res = await request(appWith(handler)).get('/test');
        expect(res.status).toBe(200);
        expect(res.headers['x-from-data']).toBe('1');
    });

    it('handles a null return value', async () => {
        const handler = $(() => null)._200().if()._500();
        const res = await request(appWith(handler)).get('/test');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({});
    });

    it('handles an undefined return value', async () => {
        const handler = $(() => undefined)._200().if()._500();
        const res = await request(appWith(handler)).get('/test');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({});
    });

    it('sends __payload__ when provided', async () => {
        const handler = $(() => ({ __payload__: { only: 'this' } }))._200().if()._500();
        const res = await request(appWith(handler)).get('/test');
        expect(res.body).toEqual({ only: 'this' });
    });
});
