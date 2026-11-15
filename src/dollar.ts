import type { Controller, Handler } from './types.js';
import { createController } from './controller.js';
import { STATUSES } from './status.generated.js';

/** The `$` entry point: `$(handler)` creates a controller; static helpers live on `$`. */
export interface Dollar {
    <T>(handler: Handler<T>): Controller<T>;
    /** Alias of `$` itself, for `const { $ } = require(...)`. */
    readonly $: Dollar;
    /** Alias of `$` itself, for default-import interop. */
    readonly default: Dollar;
    /** Every HTTP status code with its camelCase name and reason phrase. */
    readonly STATUSES: typeof STATUSES;
}

function create<T>(handler: Handler<T>): Controller<T> {
    return createController(handler);
}

export const $ = create as unknown as Dollar;
Object.defineProperties($, {
    $:          { value: $, enumerable: true },
    default:    { value: $, enumerable: false },
    STATUSES:   { value: STATUSES, enumerable: true }
});
