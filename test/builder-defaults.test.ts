import { describe, it, expect } from 'vitest';
import request from 'supertest';
import $ from '../src/index.js';
import { appWith } from './helpers.js';

const get = async (handler: Parameters<typeof appWith>[0]) => request(appWith(handler)).get('/test');

describe('builder defaults', () => {
    describe('.header()', () => {
        it('sets a header by name and value', async () => {
            const res = await get($(() => 'x').header('Cache-Control', 'no-store'));
            expect(res.headers['cache-control']).toBe('no-store');
        });

        it('sets headers from an object', async () => {
            const res = await get($(() => 'x').header({ 'X-A': '1', 'X-B': 2 }));
            expect(res.headers['x-a']).toBe('1');
            expect(res.headers['x-b']).toBe('2');
        });

        it('treats names case-insensitively, last write wins', async () => {
            const res = await get($(() => 'x').header('X-A', '1').header('x-a', '2'));
            expect(res.headers['x-a']).toBe('2');
        });

        it('supports multi-value headers', async () => {
            const res = await get($(() => 'x').header('Vary', ['Accept', 'Origin']));
            expect(res.headers['vary']).toBe('Accept, Origin');
        });

        it('rejects invalid input', () => {
            expect(() => $(() => 1).header('', 'x')).toThrow(TypeError);
            // @ts-expect-error: value missing
            expect(() => $(() => 1).header('X-A')).toThrow(TypeError);
        });
    });

    describe('.cookie()', () => {
        it('sets cookies with options', async () => {
            const res = await get($(() => 'x').cookie('a', '1').cookie('b', '2', { httpOnly: true }));
            const cookies = res.headers['set-cookie'] as unknown as string[];
            expect(cookies).toHaveLength(2);
            expect(cookies[0]).toMatch(/^a=1/);
            expect(cookies[1]).toMatch(/^b=2.*HttpOnly/);
        });

        it('rejects an empty name', () => {
            expect(() => $(() => 1).cookie('', 'x')).toThrow(TypeError);
        });
    });

    describe('.type()', () => {
        it('sets the content type', async () => {
            const res = await get($(() => 'a,b').type('text/csv'));
            expect(res.headers['content-type']).toMatch(/text\/csv/);
            expect(res.text).toBe('a,b');
        });

        it('sends JSON objects with a JSON type', async () => {
            const res = await get($(() => ({ a: 1 })).type('application/vnd.api+json'));
            expect(res.headers['content-type']).toMatch(/application\/vnd\.api\+json/);
            expect(JSON.parse(res.text)).toEqual({ a: 1 });
        });

        it('rejects an empty type', () => {
            expect(() => $(() => 1).type('')).toThrow(TypeError);
        });
    });

    it('chains with status setters and returns the controller', () => {
        const c = $(() => 1);
        expect(c.header('X', '1').cookie('a', 'b').type('json').created()).toBe(c);
    });

    it('applies defaults on every request', async () => {
        const app = appWith($(() => 'x').header('X-A', '1').cookie('a', '1'));
        for (let i = 0; i < 2; i++) {
            const res = await request(app).get('/test');
            expect(res.headers['x-a']).toBe('1');
            expect(res.headers['set-cookie']).toHaveLength(1);
        }
    });
});
