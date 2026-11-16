import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import $ from '../src/index.js';
import { resetConfig } from '../src/config.js';
import { appWith } from './helpers.js';

const get = async (handler: Parameters<typeof appWith>[0]) => request(appWith(handler)).get('/test');

afterEach(() => resetConfig());

describe('$.config() and unexpected errors', () => {
    it("defaults to errors: 'next'", async () => {
        expect($.config()).toEqual({ errors: 'next' });
        const res = await get($(() => { throw new Error('db down'); }));
        expect(res.status).toBe(599);
        expect(res.body).toEqual({ forwarded: 'db down' });
    });

    it("errors: 'respond' answers 500 with the message, without stack", async () => {
        $.config({ errors: 'respond' });
        const res = await get($(() => { throw new Error('db down'); }));
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'db down' });
        expect(res.text).not.toMatch(/at .*\.(ts|js)/);
    });

    it("errors: 'respond' keeps headers set before the error", async () => {
        $.config({ errors: 'respond' });
        const res = await get($((_req, ctx) => { ctx.header('X-Trace', 'abc').status(201); throw 'plain'; }).header('X-Api', 'v2'));
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'plain' });
        expect(res.headers['x-trace']).toBe('abc');
        expect(res.headers['x-api']).toBe('v2');
    });

    it('applies to errors thrown by guards', async () => {
        $.config({ errors: 'respond' });
        const res = await get($(() => 1).guard(() => { throw new Error('guard down'); }));
        expect(res.body).toEqual({ error: 'guard down' });
    });

    it('never changes $.error() handling', async () => {
        $.config({ errors: 'respond' });
        expect((await get($(() => { throw $.error(404); }))).status).toBe(404);
        resetConfig();
        expect((await get($(() => { throw $.error(404); }))).status).toBe(404);
    });

    it('is chainable and returns a copy when read', () => {
        expect($.config({ errors: 'respond' })).toBe($);
        const read = $.config() as { errors: string };
        read.errors = 'tampered';
        expect($.config()).toEqual({ errors: 'respond' });
    });

    it('validates options', () => {
        // @ts-expect-error: invalid mode
        expect(() => $.config({ errors: 'ignore' })).toThrow(TypeError);
        // @ts-expect-error: options must be an object
        expect(() => $.config(null)).toThrow(TypeError);
    });

    it('works with the default Express error handler', async () => {
        const app = express().get('/test', $(() => { throw new Error('hidden'); }));
        const res = await request(app).get('/test');
        expect(res.status).toBe(500);
    });
});
