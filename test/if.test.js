import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { $, appWith } from './helpers.js';

describe('.if() condition', () => {
    it('sends the success response when the check returns true', async () => {
        const handler = $(() => ({ ok: 1 }))._200().if(() => true)._500({ error: 'nope' });
        const res = await request(appWith(handler)).get('/test');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: 1 });
    });

    it('sends the error response when the check returns false', async () => {
        const handler = $(() => ({ ok: 1 }))._200().if(() => false)._500({ error: 'nope' });
        const res = await request(appWith(handler)).get('/test');
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'nope' });
    });

    it.each([
        ['_401', 401, 'Unauthorized'],
        ['_404', 404, 'Not Found'],
        ['_500', 500, 'Internal Error Server']
    ])('%s sends its status and default body', async (method, status, message) => {
        const handler = $(() => ({ ok: 1 }))._200().if(() => false)[method]();
        const res = await request(appWith(handler)).get('/test');
        expect(res.status).toBe(status);
        expect(res.body).toEqual({ __error__: message });
    });

    it('receives the request and the returned data', async () => {
        const handler = $(() => ({ role: 'admin' }))._200()
            .if((req, data) => req.query.token === 'ok' && data.role === 'admin')
            ._401();
        const app = appWith(handler);
        expect((await request(app).get('/test?token=ok')).status).toBe(200);
        expect((await request(app).get('/test?token=bad')).status).toBe(401);
    });

    it('always passes when no function is given', async () => {
        const handler = $(() => ({ ok: 1 }))._200().if('not a function')._500();
        const res = await request(appWith(handler)).get('/test');
        expect(res.status).toBe(200);
    });
});
