import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import $ from '../src/index.js';
import { BUILDER_METHODS } from '../src/controller.js';
import { STATUSES } from '../src/status.generated.js';
import { resetConfig } from '../src/config.js';
import { coerceN, object, schema } from './schema.js';

function app(handler: express.RequestHandler) {
    const a = express();
    a.use(express.json());
    a.post('/users/:id', handler);
    a.get('/users/:id', handler);
    a.use(((err, _req, res, _next) => { res.status(599).json({ forwarded: (err as Error).message }); }) as express.ErrorRequestHandler);
    return a;
}

describe('.validate()', () => {
    afterEach(() => resetConfig());

    it('passes valid requests to the handler', async () => {
        const c = $((req) => ({ body: req.body, params: req.params })).validate({ body: object('name'), params: object('id') });
        const res = await request(app(c)).post('/users/7').send({ name: 'Ada' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ body: { name: 'Ada' }, params: { id: '7' } });
    });

    it('answers 400 with the issues of every target, and does not run the handler', async () => {
        let ran = false;
        const c = $(() => { ran = true; return 1; }).validate({ body: object('name', 'email'), query: coerceN });
        const res = await request(app(c)).post('/users/7?n=x').send({ name: 'Ada' });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            error:  'Bad Request',
            issues: [
                { path: 'query.n', message: 'Expected number' },
                { path: 'body.email', message: 'Required' }
            ]
        });
        expect(ran).toBe(false);
    });

    it('replaces req.query with the validated value (Express 5 getter)', async () => {
        const c = $((req) => req.query).validate({ query: coerceN });
        const res = await request(app(c)).get('/users/1?n=42');
        expect(res.body).toEqual({ n: 42 });
    });

    it('supports async validators', async () => {
        const c = $((req) => req.body).validate({ body: schema((v) => ({ value: { wrapped: v } }), true) });
        expect((await request(app(c)).post('/users/1').send({ a: 1 })).body).toEqual({ wrapped: { a: 1 } });
    });

    it('runs after the before-guards, wherever it is declared', async () => {
        const order: string[] = [];
        const tracked = schema((v) => { order.push('validate'); return { value: v }; });
        const c = $(() => order.push('handler'))
            .validate({ body: tracked })
            .guard(() => { order.push('guard'); return true; })
            .if(() => { order.push('if'); return true; });
        await request(app(c)).post('/users/1').send({});
        expect(order).toEqual(['guard', 'validate', 'handler', 'if']);
    });

    it('a failing guard wins over invalid data (401, not 400)', async () => {
        const c = $(() => 1).validate({ body: object('name') }).guard(() => false, $.unauthorized());
        expect((await request(app(c)).post('/users/1').send({})).status).toBe(401);
    });

    it('accepts a custom failure result or function', async () => {
        const fixed = $(() => 1).validate({ body: object('name') }, $.unprocessableEntity({ invalid: true }));
        let res = await request(app(fixed)).post('/users/1').send({});
        expect(res.status).toBe(422);
        expect(res.body).toEqual({ invalid: true });

        const fn = $(() => 1).validate({ body: object('name') }, (issues, req) => $.badRequest({ count: issues.length, id: req.params.id }));
        res = await request(app(fn)).post('/users/9').send({});
        expect(res.body).toEqual({ count: 1, id: '9' });
    });

    it('runs several .validate() calls in order, the first failure wins', async () => {
        const c = $((req) => req.query)
            .validate({ query: coerceN })
            .validate({ query: schema((v) => ((v as { n: number }).n > 10 ? { value: v } : { issues: [{ message: 'Too small', path: ['n'] }] })) });
        expect((await request(app(c)).get('/users/1?n=x')).body.issues[0].message).toBe('Expected number');
        expect((await request(app(c)).get('/users/1?n=3')).body.issues).toEqual([{ path: 'query.n', message: 'Too small' }]);
        expect((await request(app(c)).get('/users/1?n=30')).body).toEqual({ n: 30 });
    });

    it('keeps the builder defaults on the failure response', async () => {
        const c = $(() => 1).header('X-A', '1').validate({ body: object('name') });
        const res = await request(app(c)).post('/users/1').send({});
        expect(res.status).toBe(400);
        expect(res.headers['x-a']).toBe('1');
    });

    it('forwards a validator that throws like any unexpected error', async () => {
        const c = $(() => 1).validate({ body: schema(() => { throw new Error('boom'); }) });
        expect((await request(app(c)).post('/users/1').send({})).body).toEqual({ forwarded: 'boom' });
    });

    it('works with .run()', async () => {
        const c = $((req) => req.query).validate({ query: coerceN });
        expect(await c.run({ query: { n: '5' } })).toMatchObject({ status: 200, body: { n: 5 } });
        expect(await c.run({ query: { n: 'x' } })).toMatchObject({ status: 400, body: { issues: [{ path: 'query.n' }] } });
    });

    it('is chainable and returns the controller itself', () => {
        const c = $(() => 1);
        expect(c.validate({ body: object('a') })).toBe(c);
    });

    it.each([
        ['null', null],
        ['an array', []],
        ['an unknown target', { headers: object('a') }],
        ['a non-schema', { body: { parse: () => 1 } }]
    ])('rejects %s at declaration time', (_label, schemas) => {
        expect(() => $(() => 1).validate(schemas as never)).toThrow(TypeError);
    });

    it('rejects an invalid failure at declaration time', () => {
        expect(() => $(() => 1).validate({ body: object('a') }, 42 as never)).toThrow(TypeError);
    });

    it('never collides with a status name', () => {
        const names = new Set<string>(STATUSES.map((s) => s.name));
        expect(BUILDER_METHODS).toContain('validate');
        expect(names.has('validate')).toBe(false);
    });
});
