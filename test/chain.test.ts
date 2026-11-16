import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import $ from '../src/index.js';
import { CHAIN_METHODS } from '../src/chain.js';
import { STATUSES } from '../src/status.generated.js';
import { coerceN, object, schema } from './schema.js';
import { appWith } from './helpers.js';

const authed = (req: express.Request) => req.headers.authorization === 'yes';

describe('steps-first chain: $.guard() / $.validate() ... .handle()', () => {
    it('$.guard().handle() runs the guard then the handler', async () => {
        const c = $.guard(authed, $.unauthorized()).handle(() => ({ ok: true }));
        expect((await request(appWith(c)).get('/test')).status).toBe(401);
        const res = await request(appWith(c)).get('/test').set('Authorization', 'yes');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
    });

    it('.do() is an alias of .handle()', async () => {
        const c = $.checkBefore(authed, $.unauthorized()).do(() => 'done');
        expect((await c.run({ headers: { authorization: 'yes' } })).body).toBe('done');
        expect((await c.run()).status).toBe(401);
    });

    it('$.validate().handle() validates before the handler', async () => {
        const c = $.validate({ query: coerceN }).handle((req) => req.query);
        expect(await c.run({ query: { n: '4' } })).toMatchObject({ status: 200, body: { n: 4 } });
        expect((await c.run({ query: { n: 'x' } })).status).toBe(400);
    });

    it('returns the normal controller: .if(), status, .run()', async () => {
        const c = $.guard(() => true)
            .handle((req) => (req.query.id === '1' ? { id: '1' } : null))
            .if((_req, doc) => !!doc, $.notFound())
            .created();
        expect(typeof c).toBe('function');
        expect(await c.run({ query: { id: '1' } })).toMatchObject({ status: 201, body: { id: '1' } });
        expect((await c.run({ query: { id: '2' } })).status).toBe(404);
    });

    it('keeps status, headers, cookies and type set before the handler', async () => {
        const c = $.guard(() => true).created().header('X-A', '1').cookie('v', '2').type('json').handle(() => ({ a: 1 }));
        const res = await c.run();
        expect(res).toMatchObject({ status: 201, headers: { 'x-a': '1' }, type: 'json' });
        expect(res.cookies).toEqual([{ name: 'v', value: '2' }]);
        expect((await $.guard(() => true)._202().handle(() => 1).run()).status).toBe(202);
        expect((await $.guard(() => true).status(203).handle(() => 1).run()).status).toBe(203);
    });

    it('runs guards before validation, whatever the declaration order', async () => {
        const order: string[] = [];
        const c = $.validate({ body: schema((v) => { order.push('validate'); return { value: v }; }) })
            .guard(() => { order.push('guard'); return true; })
            .handle(() => order.push('handler'))
            .if(() => { order.push('if'); return true; });
        await c.run();
        expect(order).toEqual(['guard', 'validate', 'handler', 'if']);
        expect((await $.validate({ body: object('a') }).guard(() => false, $.unauthorized()).handle(() => 1).run()).status).toBe(401);
    });

    it('is immutable: a chain can be shared between routes', async () => {
        const base = $.guard(authed, $.unauthorized());
        const withHeader = base.header('X-Admin', '1');
        const a = base.handle(() => 'a');
        const b = withHeader.handle(() => 'b');
        expect(base.header('X-B', '1')).not.toBe(base);
        expect((await a.run({ headers: { authorization: 'yes' } })).headers).toEqual({});
        expect((await b.run({ headers: { authorization: 'yes' } })).headers).toEqual({ 'x-admin': '1' });
        expect((await a.run()).status).toBe(401);
    });

    it('settings on the controller do not change the chain it came from', async () => {
        const base = $.guard(() => true);
        base.handle(() => 1).guard(() => false, $.forbidden()).header('X-A', '1');
        const res = await base.handle(() => 2).run();
        expect(res).toMatchObject({ status: 200, body: 2, headers: {} });
    });

    it('is not a middleware and not a thenable', async () => {
        const chain = $.guard(() => true);
        expect(typeof chain).toBe('object');
        expect('then' in chain).toBe(false);
        expect(await chain).toBe(chain);
        expect(() => express().get('/x', chain as never)).toThrow();
    });

    it('checks arguments when called', () => {
        expect(() => $.guard('nope' as never)).toThrow(TypeError);
        expect(() => $.validate({ nope: object('a') } as never)).toThrow(TypeError);
        expect(() => $.guard(() => true).handle('nope' as never)).toThrow('.handle(handler): handler must be a function');
        expect(() => $.guard(() => true).do(42 as never)).toThrow('.do(handler): handler must be a function');
        expect(() => $.guard(() => true).status(42)).toThrow(RangeError);
    });

    it('has every status setter, and none collides with a chain method', () => {
        const chain = $.guard(() => true) as unknown as Record<string, unknown>;
        const names = new Set<string>(STATUSES.map((s) => s.name));
        for (const { code, name } of STATUSES) {
            expect(typeof chain[name], name).toBe('function');
            expect(typeof chain[`_${code}`]).toBe('function');
        }
        for (const method of CHAIN_METHODS) {
            expect(names.has(method), method).toBe(false);
            expect(typeof chain[method], method).toBe('function');
        }
    });
});
