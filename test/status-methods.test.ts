import { describe, it, expect } from 'vitest';
import request from 'supertest';
import $, { STATUSES } from '../src/index.js';
import { BUILDER_METHODS } from '../src/controller.js';
import { appWith } from './helpers.js';

const get = async (handler: Parameters<typeof appWith>[0]) => request(appWith(handler)).get('/test');

describe('success status', () => {
    it('defaults to 200', async () => {
        expect((await get($(() => ({ ok: 1 })))).status).toBe(200);
    });

    it.each([
        ['_201()',          $(() => ({ a: 1 }))._201()],
        ['.created()',      $(() => ({ a: 1 })).created()],
        ['.status(201)',    $(() => ({ a: 1 })).status(201)]
    ])('%s sets 201', async (_label, handler) => {
        const res = await get(handler);
        expect(res.status).toBe(201);
        expect(res.body).toEqual({ a: 1 });
    });

    it('is chainable and the last call wins', async () => {
        expect((await get($(() => 'x').created().accepted()._200().status(202))).status).toBe(202);
    });

    it('each method returns the controller itself', () => {
        const c = $(() => 1);
        expect(c.ok()).toBe(c);
        expect(c._404()).toBe(c);
        expect(c.status(500)).toBe(c);
    });

    it('sends no body for 204', async () => {
        const res = await get($(() => ({ ignored: true })).noContent());
        expect(res.status).toBe(204);
        expect(res.text).toBe('');
    });

    it('accepts custom numeric codes', async () => {
        expect((await get($(() => 'x').status(299))).status).toBe(299);
    });

    it.each([0, 99, 1000, 200.5, NaN])('rejects invalid code %s', (code) => {
        expect(() => $(() => 1).status(code)).toThrow(RangeError);
    });

    it('generates both forms for every status code', () => {
        const c = $(() => 1) as unknown as Record<string, unknown>;
        for (const { code, name } of STATUSES) {
            expect(typeof c[name], name).toBe('function');
            expect(typeof c[`_${code}`], `_${code}`).toBe('function');
        }
    });

    it('does not keep the v1 uppercase names', () => {
        const c = $(() => 1) as unknown as Record<string, unknown>;
        expect(c._OK).toBeUndefined();
        expect(c._NOT_FOUND).toBeUndefined();
    });

    it('status names never collide with builder methods', () => {
        const names = new Set<string>(STATUSES.map((s) => s.name));
        for (const method of BUILDER_METHODS)
            expect(names.has(method), method).toBe(false);
    });
});
