import { describe, it, expect } from 'vitest';
import request from 'supertest';
import $ from '../src/index.js';
import { appWith } from './helpers.js';

const get = async (handler: Parameters<typeof appWith>[0], path = '/test') => request(appWith(handler)).get(path);

describe('ctx', () => {
    it('sets headers, cookies, type and status for the response', async () => {
        const res = await get($((_req, ctx) => {
            ctx.header('X-Source', 'db').header({ 'X-B': '2' }).cookie('seen', '1', { httpOnly: true }).type('text').status(201);
            return 'done';
        }));
        expect(res.status).toBe(201);
        expect(res.headers['x-source']).toBe('db');
        expect(res.headers['x-b']).toBe('2');
        expect(res.headers['set-cookie']![0]).toMatch(/^seen=1.*HttpOnly/);
        expect(res.headers['content-type']).toMatch(/text\/plain/);
        expect(res.text).toBe('done');
    });

    it('is chainable', async () => {
        await get($((_req, ctx) => {
            expect(ctx.header('A', '1')).toBe(ctx);
            expect(ctx.cookie('a', '1')).toBe(ctx);
            expect(ctx.clearCookie('a')).toBe(ctx);
            expect(ctx.type('json')).toBe(ctx);
            expect(ctx.status(200)).toBe(ctx);
            return null;
        }));
    });

    it('clears cookies', async () => {
        const res = await get($((_req, ctx) => {
            ctx.clearCookie('session', { path: '/' });
            return null;
        }));
        expect(res.headers['set-cookie']![0]).toMatch(/^session=;.*Expires=Thu, 01 Jan 1970/);
    });

    it('overrides the builder defaults for this response only', async () => {
        const app = appWith($((req, ctx) => {
            if (req.query.override)
                ctx.header('X-A', 'request').status(202);
            return 'x';
        }).header('X-A', 'default').created());

        const overridden = await request(app).get('/test?override=1');
        expect(overridden.status).toBe(202);
        expect(overridden.headers['x-a']).toBe('request');

        const normal = await request(app).get('/test');
        expect(normal.status).toBe(201);
        expect(normal.headers['x-a']).toBe('default');
    });

    it('keeps builder default cookies and appends request cookies', async () => {
        const res = await get($((_req, ctx) => {
            ctx.cookie('b', '2');
            return 'x';
        }).cookie('a', '1'));
        const cookies = res.headers['set-cookie'] as unknown as string[];
        expect(cookies.map((c) => c.split('=')[0])).toEqual(['a', 'b']);
    });

    it('never leaks between requests', async () => {
        const app = appWith($((req, ctx) => {
            ctx.cookie('user', String(req.query.u)).header('X-User', String(req.query.u));
            return 'x';
        }));
        await request(app).get('/test?u=alice');
        const res = await request(app).get('/test?u=bob');
        expect(res.headers['set-cookie']).toHaveLength(1);
        expect(res.headers['set-cookie']![0]).toMatch(/^user=bob/);
        expect(res.headers['x-user']).toBe('bob');
    });

    it('validates input', async () => {
        const res = await get($((_req, ctx) => {
            const errors: string[] = [];
            for (const fn of [() => ctx.status(42), () => ctx.type(''), () => ctx.cookie('', 'x'), () => ctx.clearCookie(''), () => ctx.header('', 'x')]) {
                try { fn(); } catch (error) { errors.push((error as Error).name); }
            }
            return errors;
        }));
        expect(res.body).toEqual(['RangeError', 'TypeError', 'TypeError', 'TypeError', 'TypeError']);
    });
});
