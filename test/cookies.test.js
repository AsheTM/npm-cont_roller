import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { $, appWith } from './helpers.js';

describe('cookies', () => {
    it('sets every cookie from options.__cookies__', async () => {
        const handler = $((req, options) => {
            options.__cookies__ = [
                { name: 'a', value: '1' },
                { name: 'b', value: '2', options: { httpOnly: true } }
            ];
            return { ok: 1 };
        })._200().if()._500();
        const res = await request(appWith(handler)).get('/test');
        expect(res.status).toBe(200);
        const cookies = res.headers['set-cookie'];
        expect(cookies).toHaveLength(2);
        expect(cookies[0]).toMatch(/^a=1/);
        expect(cookies[1]).toMatch(/^b=2/);
        expect(cookies[1]).toMatch(/HttpOnly/);
    });

    it('sends no cookie by default', async () => {
        const handler = $(() => ({ ok: 1 }))._200().if()._500();
        const res = await request(appWith(handler)).get('/test');
        expect(res.headers['set-cookie']).toBeUndefined();
    });
});
