// CommonJS consumer: exported types must be reachable (issue #49).
import $ = require('@ashetm/cont_roller');
import type { Controller, Result, Context, Handler, ResultOptions, Config, HttpError, StatusCode, RunResult, RunRequest } from '@ashetm/cont_roller';

const c: Controller<{ id: number }> = $(async () => ({ id: 1 }));
const viaNamespace: $.Controller<{ id: number }> = c;
const r: Result<{ error: string }> = $.notFound({ error: 'x' });
const h: Handler<number> = (_req, ctx: Context) => { ctx.status(200); return 1; };
const o: ResultOptions = { headers: { 'X-A': '1' } };
const cfg: Readonly<Config> = $.config();
const e: HttpError = $.error(404);
const code: StatusCode = 404;
// @ts-expect-error: unknown export
import type { NotAType } from '@ashetm/cont_roller';

const rr: RunRequest = { params: { id: '1' } };
const run: Promise<RunResult> = c.run(rr);
export = { rr, run, c, viaNamespace, r, h, o, cfg, e, code };
