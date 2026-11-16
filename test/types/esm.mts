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

export default c;
export { msg };
export { id };
