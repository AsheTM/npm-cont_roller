import { describe, it, expect } from 'vitest';
import request from 'supertest';
import $, { STATUSES } from '../src/index.js';
import { DOLLAR_MEMBERS } from '../src/dollar.js';
import { appWith } from './helpers.js';

const get = async (handler: Parameters<typeof appWith>[0]) => request(appWith(handler)).get('/test');

describe('$.* result helpers', () => {
    it('$.notFound(body) sends 404 with the body', async () => {
        const res = await get($(() => $.notFound({ error: 'User not found' })));
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'User not found' });
    });

    it('$.created(body, options) sets headers, cookies and type', async () => {
        const res = await get($(() => $.created({ id: 1 }, {
            headers: { Location: '/users/1' },
            cookies: [{ name: 'last', value: '1', options: { httpOnly: true } }],
            type: 'application/vnd.api+json'
        })));
        expect(res.status).toBe(201);
        expect(res.headers['location']).toBe('/users/1');
        expect(res.headers['set-cookie']![0]).toMatch(/^last=1.*HttpOnly/);
        expect(res.headers['content-type']).toMatch(/vnd\.api\+json/);
        expect(JSON.parse(res.text)).toEqual({ id: 1 });
    });

    it('$.status(code, body) is the generic form', async () => {
        const res = await get($(() => $.status(418, { tea: true })));
        expect(res.status).toBe(418);
        expect(res.body).toEqual({ tea: true });
    });

    it('$.noContent() sends no body', async () => {
        const res = await get($(() => $.noContent()));
        expect(res.status).toBe(204);
        expect(res.text).toBe('');
    });

    it('a result without body sends an empty response', async () => {
        const res = await get($(() => $.accepted()));
        expect(res.status).toBe(202);
        expect(res.text).toBe('');
    });

    describe('$.redirect()', () => {
        it('redirects with 302 by default', async () => {
            const res = await get($(() => $.redirect('/login')));
            expect(res.status).toBe(302);
            expect(res.headers['location']).toBe('/login');
        });

        it('accepts another 3xx code', async () => {
            const res = await get($(() => $.redirect('/new', 301)));
            expect(res.status).toBe(301);
        });

        it('rejects invalid input', () => {
            expect(() => $.redirect('')).toThrow(TypeError);
            expect(() => $.redirect('/x', 200)).toThrow(RangeError);
        });
    });

    it('result overrides the builder defaults and ctx, keeps the rest', async () => {
        const res = await get($((_req, ctx) => {
            ctx.header('X-Ctx', '1').header('X-Both', 'ctx').cookie('ctx', '1');
            return $.notFound('nope', { headers: { 'X-Both': 'result' }, cookies: [{ name: 'result', value: '1' }] });
        }).header('X-Default', '1').cookie('default', '1').created());
        expect(res.status).toBe(404);
        expect(res.headers['x-default']).toBe('1');
        expect(res.headers['x-ctx']).toBe('1');
        expect(res.headers['x-both']).toBe('result');
        expect((res.headers['set-cookie'] as unknown as string[]).map((c) => c.split('=')[0])).toEqual(['default', 'ctx', 'result']);
    });

    it('a shared result instance is never mutated', async () => {
        const shared = $.notFound({ error: 'x' });
        const app = appWith($((req, ctx) => {
            ctx.header('X-N', String(req.query.n));
            return shared;
        }));
        await request(app).get('/test?n=1');
        const res = await request(app).get('/test?n=2');
        expect(res.headers['x-n']).toBe('2');
        expect(shared.parts.headers.size).toBe(0);
        expect(Object.isFrozen(shared)).toBe(true);
    });

    it('$.isResult() recognises results only', () => {
        expect($.isResult($.ok())).toBe(true);
        expect($.isResult({ status: 200, body: 1 })).toBe(false);
        expect($.isResult(null)).toBe(false);
    });

    it('exposes status and body', () => {
        const result = $.badRequest({ error: 'x' });
        expect(result.status).toBe(400);
        expect(result.body).toEqual({ error: 'x' });
    });

    it('generates one helper per status code', () => {
        const dollar = $ as unknown as Record<string, unknown>;
        for (const { name, code } of STATUSES) {
            expect(typeof dollar[name], name).toBe('function');
            expect((dollar[name] as () => { status: number })().status).toBe(code);
        }
    });

    it('status names never collide with static members of $', () => {
        const names = new Set<string>(STATUSES.map((s) => s.name));
        for (const member of DOLLAR_MEMBERS)
            expect(names.has(member), member).toBe(false);
    });

    it('$(handler).ok() and $.ok(body) are different things', () => {
        const controller = $(() => 1);
        expect(controller.ok()).toBe(controller);           // builder: sets the success status
        expect($.ok({ a: 1 }).body).toEqual({ a: 1 });      // static: creates a result
    });
});
