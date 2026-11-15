import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { $, appWith } from './helpers.js';

describe('thrown errors', () => {
    it('sends the error message with a 500', async () => {
        const handler = $(() => { throw new Error('Boom'); })._200().if()._500();
        const res = await request(appWith(handler)).get('/test');
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ __error__: 'Boom' });
    });

    it('does not leak the stack trace', async () => {
        const handler = $(() => { throw new Error('Boom'); })._200().if()._500();
        const res = await request(appWith(handler)).get('/test');
        expect(res.text).not.toMatch(/at .*\.js/);
    });

    it('handles thrown non-Error values', async () => {
        const handler = $(() => { throw 'plain'; })._200().if()._500();
        const res = await request(appWith(handler)).get('/test');
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ __error__: 'plain' });
    });
});
