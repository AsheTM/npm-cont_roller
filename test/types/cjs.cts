// CommonJS consumer: resolved through the package "exports" map (self-reference).
import $ = require('@ashetm/cont_roller');

const c = $(async () => ({ ok: 1 })).created().status(418)._200();
c.status(299);
// @ts-expect-error: unknown method
c.doesNotExist();
// @ts-expect-error: v1 uppercase names are removed
c._OK();

const e = new $.HttpError(404);
void e.status;

export = c;
