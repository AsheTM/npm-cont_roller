// ES module consumer: default and named imports, exported types.
import $, { $ as named, type Controller } from '@ashetm/cont_roller';

const c: Controller<{ ok: number }> = $(async () => ({ ok: 1 })).noContent();
named(() => 'x').imATeapot()._404().status(201);
// @ts-expect-error: handler must be a function
$('nope');

export default c;
