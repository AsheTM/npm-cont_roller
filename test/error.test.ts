import { describe, it, expect } from 'vitest';
import request from 'supertest';
import $, { HttpError } from '../src/index.js';
import { appWith } from './helpers.js';

const get = async (handler: Parameters<typeof appWith>[0]) => request(appWith(handler)).get('/test');

describe('$.error()', () => {
    it('thrown in a handler, becomes its response', async () => {
        const res = await get($(() => { throw $.error(404, { error: 'User not found' }); }));
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'User not found' });
    });

    it('works from async handlers', async () => {
        const res = await get($(async () => { throw $.error(409, { error: 'Conflict!' }); }));
        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: 'Conflict!' });
    });

    it('defaults the body to the reason phrase', async () => {
        const res = await get($(() => { throw $.error(403); }));
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Forbidden' });
    });

    it('applies options and keeps ctx changes', async () => {
        const res = await get($((_req, ctx) => {
            ctx.header('X-Ctx', '1');
            throw $.error(401, { error: 'Login' }, { headers: { 'WWW-Authenticate': 'Bearer' } });
        }));
        expect(res.status).toBe(401);
        expect(res.headers['www-authenticate']).toBe('Bearer');
        expect(res.headers['x-ctx']).toBe('1');
    });

    it('is a real Error with status, body and message', () => {
        const error = $.error(404, { error: 'Missing' });
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(HttpError);
        expect(error).toBeInstanceOf($.HttpError);
        expect(error.name).toBe('HttpError');
        expect(error.status).toBe(404);
        expect(error.body).toEqual({ error: 'Missing' });
        expect(error.message).toBe('Missing');
        expect(error.stack).toBeDefined();
        expect($.isHttpError(error)).toBe(true);
        expect($.isHttpError(new Error('x'))).toBe(false);
    });

    it('uses the reason phrase as message for non-error bodies', () => {
        expect($.error(500, 'plain text').message).toBe('Internal Server Error');
    });

    it('rejects invalid status codes', () => {
        expect(() => $.error(42)).toThrow(RangeError);
    });

    it('a thrown result also becomes its response', async () => {
        const res = await get($(() => { throw $.notFound({ error: 'thrown result' }); }));
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'thrown result' });
    });

    it('other errors still go to next(err)', async () => {
        const res = await get($(() => { throw new Error('unexpected'); }));
        expect(res.status).toBe(599);
        expect(res.body).toEqual({ forwarded: 'unexpected' });
    });
});
