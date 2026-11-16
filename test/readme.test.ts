// Runs the README examples against a fake in-memory database.
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Request } from 'express';
import { z } from 'zod';
import $ from '../src/index.js';
import { resetConfig } from '../src/config.js';

interface Doc { id: string; owner: string }
const docs: Record<string, Doc> = { '1': { id: '1', owner: 'alice' }, '2': { id: '2', owner: 'bob' } };
const userOf = (req: Request) => (req.headers['x-user'] as string | undefined);

function app() {
    const a = express();
    a.use(express.json());

    a.get('/health', $(() => ({ status: 'up' })));

    a.post('/users', $(async (req, ctx) => {
        const user = { id: '42', ...req.body };
        ctx.header('Location', `/users/${user.id}`);
        return user;
    }).created());

    a.get('/docs/:id', $(async (req) => docs[req.params.id as string] ?? null)
        .guard((req) => !!userOf(req), $.unauthorized())
        .if((_req, doc) => !!doc, $.notFound({ error: 'No such doc' }))
        .checkAfter((req, doc) => doc!.owner === userOf(req),
            (_req, doc) => $.forbidden({ error: `Not your doc ${doc!.id}` })));

    a.get('/users/:id', $(async (req) => {
        const user = req.params.id === '1' ? { id: '1', active: req.query.active !== '0' } : null;
        if (!user) throw $.error(404, { error: 'User not found' });
        if (!user.active) throw $.error(403);
        return user;
    }));

    a.get('/old', $(() => $.redirect('/new', 301)));
    a.get('/crash', $(() => { throw new Error('db down'); }));
    a.use(((err, _req, res, _next) => { res.status(503).json({ handled: (err as Error).message }); }) as express.ErrorRequestHandler);
    return a;
}

describe('README examples', () => {
    afterEach(() => resetConfig());

    it('quick start', async () => {
        expect((await request(app()).get('/health')).body).toEqual({ status: 'up' });
        const res = await request(app()).post('/users').send({ name: 'Ada' });
        expect(res.status).toBe(201);
        expect(res.headers['location']).toBe('/users/42');
        expect(res.body).toEqual({ id: '42', name: 'Ada' });
    });

    it('guards', async () => {
        expect((await request(app()).get('/docs/1')).status).toBe(401);
        const missing = await request(app()).get('/docs/9').set('X-User', 'alice');
        expect(missing.status).toBe(404);
        expect(missing.body).toEqual({ error: 'No such doc' });
        const other = await request(app()).get('/docs/2').set('X-User', 'alice');
        expect(other.status).toBe(403);
        expect(other.body).toEqual({ error: 'Not your doc 2' });
        const mine = await request(app()).get('/docs/1').set('X-User', 'alice');
        expect(mine.status).toBe(200);
        expect(mine.body).toEqual({ id: '1', owner: 'alice' });
    });

    it('$.error', async () => {
        expect((await request(app()).get('/users/9')).body).toEqual({ error: 'User not found' });
        const inactive = await request(app()).get('/users/1?active=0');
        expect(inactive.status).toBe(403);
        expect(inactive.body).toEqual({ error: 'Forbidden' });
        expect((await request(app()).get('/users/1')).status).toBe(200);
    });

    it('$.redirect', async () => {
        const res = await request(app()).get('/old');
        expect(res.status).toBe(301);
        expect(res.headers['location']).toBe('/new');
    });

    it('unexpected errors: next(err) by default, 500 with errors: respond', async () => {
        expect((await request(app()).get('/crash')).body).toEqual({ handled: 'db down' });
        expect($.config({ errors: 'respond' })).toBe($);
        expect($.config()).toEqual({ errors: 'respond' });
        const res = await request(app()).get('/crash');
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'db down' });
    });

    it('strings are text/html by default, .type("text") makes them plain text', async () => {
        const html = await request(express().get('/s', $(() => '<b>x</b>'))).get('/s');
        expect(html.headers['content-type']).toMatch(/^text\/html/);
        const text = await request(express().get('/s', $(() => '<b>x</b>').type('text'))).get('/s');
        expect(text.headers['content-type']).toMatch(/^text\/plain/);
        const viaCtx = await request(express().get('/s', $((_req, ctx) => { ctx.type('text'); return '<b>x</b>'; }))).get('/s');
        expect(viaCtx.headers['content-type']).toMatch(/^text\/plain/);
    });

    it('testing with controller.run(req)', async () => {
        const db = { users: { find: async (id: unknown) => (id === '1' ? { id: '1', name: 'Ada' } : null) } };
        const getUser = $(async (req) => db.users.find(req.params.id))
            .header('Cache-Control', 'no-store')
            .guard((req) => !!req.headers.authorization, $.unauthorized())
            .if((_req, user) => !!user, $.notFound({ error: 'User not found' }));

        expect(await getUser.run({ params: { id: '1' }, headers: { authorization: 'Bearer x' } })).toEqual({
            status: 200, body: { id: '1', name: 'Ada' }, headers: { 'cache-control': 'no-store' }, cookies: [], type: undefined
        });
        expect((await getUser.run({ params: { id: '1' } })).status).toBe(401);
        expect((await getUser.run({ params: { id: '9' }, headers: { authorization: 'x' } })).body).toEqual({ error: 'User not found' });

        const crashing = $(async () => { throw new Error('db down'); });
        await expect(crashing.run()).rejects.toThrow('db down');
        $.config({ errors: 'respond' });
        expect(await crashing.run()).toMatchObject({ status: 500, body: { error: 'db down' } });
    });

    it('$(handler).ok() vs $.ok(body)', () => {
        const controller = $(() => 1);
        expect(controller.ok()).toBe(controller);
        expect($.ok({ a: 1 }).status).toBe(200);
    });

    describe('validation and steps first', () => {
        const User = z.object({ name: z.string().min(1), age: z.coerce.number() });
        const Doc = z.object({ title: z.string() });
        const userOf2 = (req: Request) => (req as Request & { user?: string }).user;
        const withUser = (req: Request, _res: unknown, next: () => void) => {
            if (req.headers['x-user'])
                (req as Request & { user?: string }).user = req.headers['x-user'] as string;
            next();
        };

        function validationApp() {
            const a = express();
            a.use(express.json(), withUser as express.RequestHandler);
            a.post('/users/:id', $(async (req) => ({ id: req.params.id, ...req.body }))
                .validate({ body: User, params: z.object({ id: z.uuid() }) }));
            a.post('/custom', $(() => 1)
                .validate({ body: User }, (issues) => $.unprocessableEntity({ invalid: issues.map((i) => i.path) })));
            a.post('/typed', $({ body: User }, async (req) => ({ age: req.body.age + 1 })).created());
            a.post('/chain', $.validate({ body: User }).handle(async (req) => req.body).created());
            a.post('/docs', $.guard((req) => !!userOf2(req), $.unauthorized())
                .validate({ body: Doc })
                .do(async (req) => ({ id: 'd1', ...req.body }))
                .if((_req, doc) => !!doc, $.notFound()));
            const loggedIn = $.guard((req) => !!userOf2(req), $.unauthorized());
            a.get('/me', loggedIn.handle((req) => ({ user: userOf2(req) })));
            a.post('/posts', loggedIn.validate({ body: Doc }).handle((req) => req.body).created());
            return a;
        }
        const ID = '8b3e7f1e-1c2d-4e5f-9a6b-7c8d9e0f1a2b';

        it('.validate() replaces req with the validated values', async () => {
            const res = await request(validationApp()).post(`/users/${ID}`).send({ name: 'Ada', age: '42' });
            expect(res.body).toEqual({ id: ID, name: 'Ada', age: 42 });
        });

        it('default failure lists the issues', async () => {
            const res = await request(validationApp()).post(`/users/${ID}`).send({ name: '', age: '1' });
            expect(res.status).toBe(400);
            expect(res.body).toEqual({ error: 'Bad Request', issues: [{ path: 'body.name', message: 'Too small: expected string to have >=1 characters' }] });
        });

        it('custom failure', async () => {
            const res = await request(validationApp()).post('/custom').send({});
            expect(res.status).toBe(422);
            expect(res.body).toEqual({ invalid: ['body.name', 'body.age'] });
        });

        it('typed req: $(schemas, handler) and $.validate().handle()', async () => {
            expect((await request(validationApp()).post('/typed').send({ name: 'A', age: '1' })).body).toEqual({ age: 2 });
            const res = await request(validationApp()).post('/chain').send({ name: 'A', age: '5' });
            expect(res.status).toBe(201);
            expect(res.body).toEqual({ name: 'A', age: 5 });
        });

        it('steps first, run order and shared chains', async () => {
            expect((await request(validationApp()).post('/docs').send({})).status).toBe(401);          // guard before validation
            expect((await request(validationApp()).post('/docs').set('X-User', 'a').send({})).status).toBe(400);
            expect((await request(validationApp()).post('/docs').set('X-User', 'a').send({ title: 't' })).body).toEqual({ id: 'd1', title: 't' });
            expect((await request(validationApp()).get('/me').set('X-User', 'a')).body).toEqual({ user: 'a' });
            expect((await request(validationApp()).post('/posts').send({ title: 't' })).status).toBe(401);
            expect((await request(validationApp()).post('/posts').set('X-User', 'a').send({ title: 't' })).status).toBe(201);
        });
    });
});
