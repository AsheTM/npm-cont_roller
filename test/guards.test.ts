import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import $ from '../src/index.js';
import { appWith } from './helpers.js';

const get = async (handler: Parameters<typeof appWith>[0], path = '/test') => request(appWith(handler)).get(path);

describe('guards', () => {
    describe.each(['guard', 'checkBefore'] as const)('.%s() runs before the handler', (method) => {
        it('continues when the check passes', async () => {
            const res = await get($(() => ({ ok: 1 }))[method](() => true, $.unauthorized()));
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ ok: 1 });
        });

        it('sends the failure and never runs the handler when the check fails', async () => {
            const handler = vi.fn(() => ({ ok: 1 }));
            const res = await get($(handler)[method](() => false, $.unauthorized({ error: 'Login first' })));
            expect(res.status).toBe(401);
            expect(res.body).toEqual({ error: 'Login first' });
            expect(handler).not.toHaveBeenCalled();
        });

        it('receives the request', async () => {
            const c = $(() => 'in')[method]((req) => req.query.token === 'ok', $.unauthorized());
            expect((await get(c, '/test?token=ok')).status).toBe(200);
            expect((await get(c, '/test?token=bad')).status).toBe(401);
        });
    });

    describe.each(['if', 'checkAfter'] as const)('.%s() runs after the handler', (method) => {
        it('sends the data when the check passes', async () => {
            const res = await get($(() => ({ active: true }))[method]((_req, data) => data.active, $.forbidden()));
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ active: true });
        });

        it('sends the failure when the check fails (README v1 semantics: false = error)', async () => {
            const res = await get($(() => ({ active: false }))[method]((_req, data) => data.active, $.forbidden({ error: 'Inactive' })));
            expect(res.status).toBe(403);
            expect(res.body).toEqual({ error: 'Inactive' });
        });

        it('receives the resolved data of an async handler', async () => {
            const res = await get($(async () => null)[method]((_req, user) => user !== null, $.notFound()));
            expect(res.status).toBe(404);
        });
    });

    it('aliases behave the same', () => {
        const c = $(() => 1);
        expect(c.guard(() => true)).toBe(c);
        expect(c.checkBefore(() => true)).toBe(c);
        expect(c.if(() => true)).toBe(c);
        expect(c.checkAfter(() => true)).toBe(c);
    });

    it('runs before-guards, handler, then after-guards in declaration order', async () => {
        const calls: string[] = [];
        await get($(() => { calls.push('handler'); return 1; })
            .if(() => { calls.push('after1'); return true; })
            .guard(() => { calls.push('before1'); return true; })
            .checkAfter(() => { calls.push('after2'); return true; })
            .checkBefore(() => { calls.push('before2'); return true; }));
        expect(calls).toEqual(['before1', 'before2', 'handler', 'after1', 'after2']);
    });

    it('stops at the first failing guard', async () => {
        const second = vi.fn(() => true);
        const res = await get($(() => 1).guard(() => false, $.unauthorized()).guard(second, $.forbidden()));
        expect(res.status).toBe(401);
        expect(second).not.toHaveBeenCalled();
    });

    it('supports async checks', async () => {
        const res = await get($(() => 1).guard(async () => { await new Promise((r) => setTimeout(r, 5)); return false; }, $.locked()));
        expect(res.status).toBe(423);
    });

    it('uses truthy/falsy values', async () => {
        expect((await get($(() => 1).guard(() => 'yes'))).status).toBe(200);
        expect((await get($(() => 1).guard(() => 0))).status).toBe(500);
    });

    it('defaults the failure to a 500', async () => {
        const res = await get($(() => 1).if(() => false));
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Internal Server Error' });
    });

    it('accepts a function building the failure', async () => {
        const res = await get($(() => ({ id: 7, owner: 'bob' }))
            .if((req, doc) => doc.owner === req.query.user, (req, doc) => $.forbidden({ error: `${String(req.query.user)} cannot read ${doc.id}` })), '/test?user=alice');
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'alice cannot read 7' });
    });

    it('skips after-guards when the handler returns a $.* result', async () => {
        const check = vi.fn(() => false);
        const res = await get($(() => $.created({ id: 1 })).if(check, $.forbidden()));
        expect(res.status).toBe(201);
        expect(check).not.toHaveBeenCalled();
    });

    it('keeps builder defaults on guard failures', async () => {
        const res = await get($(() => 1).header('X-Api', 'v2').guard(() => false, $.unauthorized()));
        expect(res.headers['x-api']).toBe('v2');
    });

    it('a check throwing $.error sends it, other errors go to next(err)', async () => {
        expect((await get($(() => 1).guard(() => { throw $.error(429); }))).status).toBe(429);
        const res = await get($(() => 1).guard(() => { throw new Error('db down'); }));
        expect(res.body).toEqual({ forwarded: 'db down' });
    });

    it('validates arguments', async () => {
        // @ts-expect-error: check must be a function
        expect(() => $(() => 1).guard('nope')).toThrow(TypeError);
        // @ts-expect-error: check must be a function
        expect(() => $(() => 1).if(true)).toThrow(TypeError);
        // @ts-expect-error: failure must be a result
        const res = await get($(() => 1).guard(() => false, { status: 401 }));
        expect(res.body).toEqual({ forwarded: 'guard failure must be a $.* result (or a function returning one)' });
    });

    it('guards are shared safely across requests', async () => {
        const failure = $.forbidden({ error: 'no' });
        const app = appWith($((_req, ctx) => { ctx.header('X-N', '1'); return 1; }).if((req) => req.query.ok === '1', failure));
        expect((await request(app).get('/test?ok=0')).status).toBe(403);
        expect((await request(app).get('/test?ok=1')).status).toBe(200);
        expect(failure.parts.headers.size).toBe(0);
    });
});
