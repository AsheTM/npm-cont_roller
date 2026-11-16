// Runs the README examples against a fake in-memory database.
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Request } from 'express';
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

    it('$(handler).ok() vs $.ok(body)', () => {
        const controller = $(() => 1);
        expect(controller.ok()).toBe(controller);
        expect($.ok({ a: 1 }).status).toBe(200);
    });
});
