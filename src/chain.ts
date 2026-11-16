import type { ControllerChain, ControllerState, Handler } from './types.js';
import { createController } from './controller.js';
import { copyState, emptyState, settingMethods } from './settings.js';

/** Chain method names; generated status names must never collide with them. */
export const CHAIN_METHODS = ['status', 'header', 'cookie', 'type', 'guard', 'checkBefore', 'validate', 'handle', 'do'] as const;

/**
 * Steps-first chain: `$.guard(...).validate(...).handle(handler)`.
 * Immutable: every step returns a new chain, so a chain can be shared between routes.
 * Not a middleware: `.handle()` / `.do()` returns the controller.
 */
export function createChain(state: ControllerState = emptyState()): ControllerChain {
    const settings = settingMethods<ControllerChain>((change) => {
        const next = copyState(state);
        change(next);
        return createChain(next);
    });
    const handle = (method: string) => <T>(handler: Handler<T>) => createController(handler, state, `.${method}(handler)`);
    return Object.freeze(Object.assign({}, settings, {
        handle: handle('handle'),
        do:     handle('do')
    })) as unknown as ControllerChain;
}
