// End-to-end validation with real Standard Schema libraries (dev dependencies only).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import * as v from 'valibot';
import { type } from 'arktype';
import $ from '../src/index.js';
import type { Dollar, ValidationSchemas } from '../src/index.js';

const require = createRequire(import.meta.url);

/** The same rules in each library: id digits, page coerced to a number, name non-empty, age coerced. */
const libraries: Array<[string, Required<ValidationSchemas>]> = [
    ['zod', {
        params: z.object({ id: z.string().regex(/^\d+$/) }),
        query:  z.object({ page: z.coerce.number() }),
        body:   z.object({ name: z.string().min(1), age: z.coerce.number() })
    }],
    ['valibot', {
        params: v.object({ id: v.pipe(v.string(), v.regex(/^\d+$/)) }),
        query:  v.object({ page: v.pipe(v.string(), v.transform(Number)) }),
        body:   v.object({ name: v.pipe(v.string(), v.minLength(1)), age: v.pipe(v.string(), v.transform(Number)) })
    }],
    ['arktype', {
        params: type({ id: /^\d+$/ }),
        query:  type({ page: 'string.numeric.parse' }),
        body:   type({ name: 'string > 0', age: 'string.numeric.parse' })
    }]
];

function app(controller: express.RequestHandler) {
    const a = express();
    a.use(express.json());
    a.post('/users/:id', controller);
    return a;
}

const handler = (req: express.Request) => ({ id: req.params.id, page: req.query.page, ...req.body });
const VALID = { name: 'Ada', age: '42' };
const EXPECTED = { id: '7', page: 2, name: 'Ada', age: 42 };

function styles($$: Dollar, schemas: Required<ValidationSchemas>) {
    return {
        'handler-first':    $$(handler).validate(schemas).created(),
        'steps-first':      $$.guard(() => true).validate(schemas).created().handle(handler as never),
        '$(schemas, h)':    $$(schemas, handler as never).created()
    };
}

describe.each(libraries)('%s', (_name, schemas) => {
    describe.each(Object.entries(styles($, schemas)))('%s', (_style, controller) => {
        it('validates and coerces through Express', async () => {
            const res = await request(app(controller)).post('/users/7?page=2').send(VALID);
            expect(res.status).toBe(201);
            expect(res.body).toEqual(EXPECTED);
        });

        it('answers 400 with the issues of every field', async () => {
            const res = await request(app(controller)).post('/users/x?page=2').send({ name: '', age: '1' });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Bad Request');
            expect(res.body.issues.map((i: { path: string }) => i.path)).toEqual(['params.id', 'body.name']);
            for (const issue of res.body.issues)
                expect(typeof issue.message).toBe('string');
        });

        it('works with .run()', async () => {
            const res = await (controller as ReturnType<typeof $>).run({ params: { id: '7' }, query: { page: '2' }, body: VALID });
            expect(res).toMatchObject({ status: 201, body: EXPECTED });
        });
    });
});

describe('built package', () => {
    const zodSchemas = libraries[0]![1];

    it('CommonJS', async () => {
        const $cjs = require('../dist/index.cjs') as Dollar;
        for (const controller of Object.values(styles($cjs, zodSchemas)))
            expect((await request(app(controller)).post('/users/7?page=2').send(VALID)).body).toEqual(EXPECTED);
    });

    it('ES module', async () => {
        const entry = '../dist/index.js';
        const { default: $esm } = await import(entry) as { default: Dollar };
        for (const controller of Object.values(styles($esm, zodSchemas)))
            expect((await request(app(controller)).post('/users/x?page=2').send(VALID)).status).toBe(400);
    });
});
