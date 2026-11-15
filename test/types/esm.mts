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

export default c;
export { id };
