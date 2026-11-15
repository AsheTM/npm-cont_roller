import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { $, appWith } from './helpers.js';

describe('request isolation', () => {
    it('does not carry cookies pushed in one request into the next', async () => {
        const handler = $((req, options) => {
            options.__cookies__.push({ name: 'user', value: req.query.u });
            return { ok: 1 };
        })._200().if()._500();
        const app = appWith(handler);
        await request(app).get('/test?u=alice');
        const res = await request(app).get('/test?u=bob');
        expect(res.headers['set-cookie']).toHaveLength(1);
        expect(res.headers['set-cookie'][0]).toMatch(/^user=bob/);
    });

    it('does not carry headers mutated in one request into the next', async () => {
        const handler = $((req, options) => {
            if(req.query.secret)
                options.__headers__['X-Secret'] = req.query.secret;
            return { ok: 1 };
        })._200().if()._500();
        const app = appWith(handler);
        await request(app).get('/test?secret=alice-token');
        const res = await request(app).get('/test');
        expect(res.headers['x-secret']).toBeUndefined();
    });
});
