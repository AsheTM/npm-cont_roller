import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import $ from '../src/index.js';
import { resetConfig } from '../src/config.js';
import { STATUSES } from '../src/index.js';
import { BUILDER_METHODS } from '../src/controller.js';
import { appWith } from './helpers.js';

afterEach(() => resetConfig());

interface User { id: string; name: string; active: boolean }
const users: Record<string, User> = { '1': { id: '1', name: 'Ada', active: true }, '2': { id: '2', name: 'Bob', active: false } };

const getUser = $(async (req) => users[req.params.id as string] ?? null)
    .header('Cache-Control', 'no-store')
    .guard((req) => !!req.headers.authorization, $.unauthorized({ error: 'Login required' }))
    .if((_req, user) => user !== null, $.notFound({ error: 'User not found' }))
    .checkAfter((_req, user) => user!.active, (_req, user) => $.forbidden({ error: `${user!.name} is inactive` }));

describe('controller.run(req)', () => {
    it('resolves with the response as a plain object', async () => {
        const res = await getUser.run<User>({ params: { id: '1' }, headers: { authorization: 'Bearer x' } });
        expect(res).toEqual({
            status:     200,
            body:       { id: '1', name: 'Ada', active: true },
            headers:    { 'cache-control': 'no-store' },
            cookies:    [],
            type:       undefined
        });
        expect(res.body.name).toBe('Ada');                         // narrowed body type
    });

    it('runs before-guards (handler not called on failure)', async () => {
        const handler = vi.fn(() => 'secret');
        const res = await $(handler).guard(() => false, $.unauthorized({ error: 'Login required' })).run();
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: 'Login required' });
        expect(handler).not.toHaveBeenCalled();
    });

    it('runs after-guards with dynamic failures', async () => {
        const auth = { headers: { Authorization: 'Bearer x' } };   // header names are case-insensitive
        expect((await getUser.run({ ...auth, params: { id: '9' } })).body).toEqual({ error: 'User not found' });
        const inactive = await getUser.run({ ...auth, params: { id: '2' } });
        expect(inactive.status).toBe(403);
        expect(inactive.body).toEqual({ error: 'Bob is inactive' });
    });

    it('applies ctx, results and layering', async () => {
        const res = await $((_req, ctx) => {
            ctx.header('X-Ctx', '1').cookie('seen', '1', { httpOnly: true }).clearCookie('old');
            return $.created({ id: 7 }, { headers: { Location: '/items/7' }, type: 'json' });
        }).header('X-Default', '1').cookie('v', '2').run();
        expect(res.status).toBe(201);
        expect(res.body).toEqual({ id: 7 });
        expect(res.type).toBe('json');
        expect(res.headers).toEqual({ 'x-default': '1', 'x-ctx': '1', location: '/items/7' });
        expect(res.cookies).toEqual([
            { name: 'v', value: '2' },
            { name: 'seen', value: '1', options: { httpOnly: true } },
            { name: 'old', clear: true }
        ]);
    });

    it('sends $.error() and thrown results', async () => {
        expect(await $(() => { throw $.error(409); }).run()).toMatchObject({ status: 409, body: { error: 'Conflict' } });
        expect(await $(() => { throw $.tooManyRequests(); }).run()).toMatchObject({ status: 429, body: undefined });
    });

    it('drops the body for 204, 205 and 304', async () => {
        const res = await $(() => ({ ignored: true })).noContent().run();
        expect(res).toMatchObject({ status: 204, body: undefined });
    });

    it('keeps the raw body (not serialized)', async () => {
        const date = new Date(0);
        expect((await $(() => ({ date })).run()).body).toEqual({ date });
        expect((await $(() => 'text').run()).body).toBe('text');
        expect((await $(() => undefined).run()).body).toBeUndefined();
    });

    it('fills missing request fields with empty defaults', async () => {
        const res = await $((req) => ({
            params: req.params, query: req.query, headers: req.headers, cookies: req.cookies, method: req.method, getHeader: req.get('x-a') ?? null
        })).run();
        expect(res.body).toEqual({ params: {}, query: {}, headers: {}, cookies: {}, method: 'GET', getHeader: null });
    });

    it('passes custom request fields through (e.g. req.user)', async () => {
        const res = await $((req) => ({ user: (req as unknown as { user: unknown }).user, q: req.query.q, b: req.body }))
            .run({ user: { id: 'u1' }, query: { q: 'x' }, body: { a: 1 }, method: 'POST' });
        expect(res.body).toEqual({ user: { id: 'u1' }, q: 'x', b: { a: 1 } });
    });

    describe('unexpected errors follow $.config', () => {
        const crash = $(async () => { throw new Error('db down'); }).header('X-Api', 'v2');

        it('reject by default', async () => {
            await expect(crash.run()).rejects.toThrow('db down');
        });

        it("resolve with 500 in 'respond' mode", async () => {
            $.config({ errors: 'respond' });
            expect(await crash.run()).toMatchObject({ status: 500, body: { error: 'db down' }, headers: { 'x-api': 'v2' } });
        });
    });

    it('is independent between calls', async () => {
        const c = $((req, ctx) => { ctx.header('X-N', String(req.query.n)); return req.query.n; });
        const [a, b] = await Promise.all([c.run({ query: { n: '1' } }), c.run({ query: { n: '2' } })]);
        expect([a.body, a.headers['x-n'], b.body, b.headers['x-n']]).toEqual(['1', '1', '2', '2']);
    });

    it('does not change the controller (still a working middleware)', async () => {
        await getUser.run();
        const res = await request(appWith(getUser, '/users/:id')).get('/users/1').set('Authorization', 'Bearer x');
        expect(res.status).toBe(200);
    });

    it('gives the same status, body and headers as a real request', async () => {
        const app = appWith(getUser, '/users/:id');
        for (const [id, auth] of [['1', true], ['2', true], ['9', true], ['1', false]] as const) {
            const viaRun = await getUser.run({ params: { id }, headers: auth ? { authorization: 'Bearer x' } : {} });
            const viaHttp = await (auth ? request(app).get(`/users/${id}`).set('Authorization', 'Bearer x') : request(app).get(`/users/${id}`));
            expect(viaRun.status, `user ${id}`).toBe(viaHttp.status);
            expect(viaRun.body, `user ${id}`).toEqual(viaHttp.body);
            expect(viaRun.headers['cache-control']).toBe(viaHttp.headers['cache-control']);
        }
    });

    it('run never collides with a status name', () => {
        expect(BUILDER_METHODS).toContain('run');
        expect(STATUSES.some((s) => (s.name as string) === 'run')).toBe(false);
    });
});
