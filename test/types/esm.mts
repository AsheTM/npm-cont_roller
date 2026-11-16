// ES module consumer: default and named imports, exported types.
import $, { $ as named, type Controller } from '@ashetm/cont_roller';

const c: Controller<{ ok: number }> = $(async () => ({ ok: 1 })).noContent();
named(() => 'x').imATeapot()._404().status(201);
$(async (_req, ctx) => {
    ctx.header('X-A', '1').header({ 'X-B': 2 }).cookie('a', 'b', { httpOnly: true }).clearCookie('c').type('json').status(201);
    // @ts-expect-error: unknown ctx method
    ctx.nope();
    return null;
});
// @ts-expect-error: handler must be a function
$('nope');

$(async () => $.notFound({ error: 'x' }, { headers: { 'X-A': '1' } }));
$(() => $.status(418)).ok();
$(() => $.redirect('/login', 301));
const r = $.created({ id: 1 });
const id: number = r.body.id;
// @ts-expect-error: unknown helper
$.notAStatus();

import { HttpError } from '@ashetm/cont_roller';
const e1 = $.error(404);
const msg: string = e1.body.error;
const e2: HttpError<{ code: number }> = $.error(400, { code: 1 });
$(() => { throw e2; });

$(async () => ({ id: 1, active: true }))
    .guard((req) => !!req.headers.authorization, $.unauthorized())
    .checkBefore(async () => true)
    .if((_req, data) => data.active, $.forbidden())
    .checkAfter((_req, data) => data.id > 0, (_req, data) => $.notFound({ id: data.id }));
// @ts-expect-error: data has no 'missing' property
$(() => ({ id: 1 })).if((_req, data) => data.missing);

import type { RunResult } from '@ashetm/cont_roller';
const ran: Promise<RunResult<{ id: number }>> = $(async () => ({ id: 1 })).run<{ id: number }>({ params: { id: '1' }, headers: { authorization: 'x' }, user: { id: 1 } });
void $(() => 1).run();
// @ts-expect-error: params must be an object
void $(() => 1).run({ params: 42 });

// Validation and the steps-first chain (#67, #68)
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { ControllerChain, ValidationIssue } from '@ashetm/cont_roller';
declare const User: StandardSchemaV1<unknown, { name: string; age: number }>;
declare const Id: StandardSchemaV1<unknown, { id: string }>;

const created = $.guard((req) => !!req.headers.authorization, $.unauthorized())
    .validate({ body: User })
    .validate({ params: Id })
    .created()
    .header('X-A', '1')
    .handle(async (req) => {
        const name: string = req.body.name;
        const id: string = req.params.id;
        return { name, id, auth: req.headers.authorization };
    })
    .if((req, data) => req.body.age > 0 && data.name.length > 0, $.badRequest());
const chain: ControllerChain = $.checkBefore(() => true);
chain.do((req) => req.body);
$.validate({ query: Id }, (issues: ValidationIssue[], req) => $.badRequest({ issues, url: req.url }))
    .do((req) => req.query.id.toUpperCase());
// @ts-expect-error: not in the schema output
$.validate({ body: User }).handle((req) => req.body.missing);
// @ts-expect-error: unknown validation target
$.validate({ headers: User });
// @ts-expect-error: a chain is not a middleware
const notMiddleware: import('express').RequestHandler = $.guard(() => true);
// @ts-expect-error: no .if() before the handler
$.guard(() => true).if(() => true);
// Handler-first: runtime validation, after-checks see the validated request
$(async () => ({ ok: true }))
    .validate({ body: User })
    .if((req) => req.body.age > 18, $.forbidden());

// $(schemas, handler) (#69)
const overload = $({ body: User, params: Id }, async (req) => ({ name: req.body.name, id: req.params.id }))
    .created()
    .if((req, data) => req.body.age > 0 && data.id.length > 0);
// @ts-expect-error: not in the schema output
$({ body: User }, (req) => req.body.missing);

// Real libraries: req types inferred from zod, valibot and arktype schemas (#70)
import { z } from 'zod';
import * as v from 'valibot';
import { type } from 'arktype';
$({ body: z.object({ name: z.string(), age: z.coerce.number() }) }, (req) => req.body.name.length + req.body.age);
$.validate({ query: v.object({ page: v.pipe(v.string(), v.transform(Number)) }) }).handle((req) => req.query.page.toFixed());
$.guard(() => true).validate({ params: type({ id: 'string' }) }).do((req) => req.params.id.toUpperCase());
// @ts-expect-error: age is a number after coercion
$({ body: z.object({ age: z.coerce.number() }) }, (req) => req.body.age.toUpperCase());

export { created, notMiddleware, overload };
export default c;
export { ran };
export { msg };
export { id };
