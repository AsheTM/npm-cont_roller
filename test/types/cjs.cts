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

$.config({ errors: 'respond' }).config({ errors: 'next' });
const mode: 'next' | 'respond' = $.config().errors;
void mode;

import type { StandardSchemaV1 } from '@standard-schema/spec';
declare const Body: StandardSchemaV1<unknown, { title: string }>;
const chained: $.Controller<{ title: string }, $.ValidatedRequest<{ body: typeof Body }>> = $.guard(() => true)
    .validate({ body: Body })
    .do((req) => ({ title: req.body.title }));
// @ts-expect-error: not in the schema output
$.validate({ body: Body }).handle((req) => req.body.nope);
void chained;

export = c;
