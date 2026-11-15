import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import express from 'express';

const require = createRequire(import.meta.url);

// Mirrors the README "Usage" example.
function build(items) {
    const $ = require('../index.js');
    const router = express.Router();
    const cont = $((req, options) => {
        options.__headers__     = { 'X-Powered-By': 'cont_roller' };
        options.__cookies__     = [{ name: 'session', value: 'abc123', options: { httpOnly: true } }];
        options.__contentType__ = 'json';
        return { data: items };
    })._200().if((req, data) => {
        return data.data.length > 0;
    })._404({ error: 'Nothing found' });
    router.get('/test', cont);
    return express().use(router);
}

describe('README example', () => {
    it('sends the data, headers and cookies when the check passes', async () => {
        const res = await request(build(['...'])).get('/test');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ data: ['...'] });
        expect(res.headers['x-powered-by']).toBe('cont_roller');
        expect(res.headers['set-cookie'][0]).toMatch(/^session=abc123.*HttpOnly/);
    });

    it('sends the error response when the check fails', async () => {
        const res = await request(build([])).get('/test');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Nothing found' });
    });

    it('exposes status methods by name', async () => {
        const $ = require('../index.js');
        const app = express().get('/t', $(() => null)._NO_CONTENT().if()._500());
        expect((await request(app).get('/t')).status).toBe(204);
    });
});
