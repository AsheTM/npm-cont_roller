import type { CookieOptions, Request } from 'express';
import type { BeforeCheck, ControllerState, GuardFailure, ValidationFailure, ValidationSchemas } from './types.js';
import { addCookie, cloneParts, emptyParts, setHeaders, type HeaderValue, type Headers } from './response.js';
import { STATUSES } from './status.generated.js';
import { assertStatusCode } from './status.js';
import { assertValidation } from './validation.js';

export function emptyState(): ControllerState {
    return { defaults: { ...emptyParts(), status: 200 }, before: [], after: [], validations: [] };
}

/** Independent copy: changing the copy never affects the original. */
export function copyState(state: ControllerState): ControllerState {
    return {
        defaults:       cloneParts(state.defaults),
        before:         [...state.before],
        after:          [...state.after],
        validations:    [...state.validations]
    };
}

export function assertCheck(check: unknown, method: string): void {
    if (typeof check !== 'function')
        throw new TypeError(`.${method}(check, result): check must be a function`);
}

/** Applies a change to a state and returns the chainable object (the same one, or a new one). */
export type Apply<Self> = (change: (state: ControllerState) => void) => Self;

/**
 * The settings shared by the controller `$(handler)` and the steps-first chain `$.guard()...`:
 * status setters, `.status()`, `.header()`, `.cookie()`, `.type()`, `.guard()` / `.checkBefore()`, `.validate()`.
 * Arguments are checked immediately, when the method is called.
 */
export function settingMethods<Self>(apply: Apply<Self>): Record<string, (...args: never[]) => Self> {
    const methods: Record<string, (...args: never[]) => Self> = {};
    for (const { code, name } of STATUSES) {
        const setter = (): Self => apply((state) => { state.defaults.status = code; });
        methods[name] = setter;
        methods[`_${code}`] = setter;
    }

    const before = (check: BeforeCheck, failure?: GuardFailure<[Request]>): Self => {
        assertCheck(check, 'guard');
        const step = failure === undefined ? { check } : { check, failure };
        return apply((state) => { state.before.push(step); });
    };

    return Object.assign(methods, {
        guard:          before,
        checkBefore:    before,
        validate(schemas: ValidationSchemas, failure?: ValidationFailure): Self {
            assertValidation(schemas, failure);
            const step = failure === undefined ? { schemas: { ...schemas } } : { schemas: { ...schemas }, failure };
            return apply((state) => { state.validations.push(step); });
        },
        status(code: number): Self {
            assertStatusCode(code);
            return apply((state) => { state.defaults.status = code; });
        },
        header(nameOrHeaders: string | Headers, value?: HeaderValue): Self {
            return apply((state) => setHeaders(state.defaults, nameOrHeaders, value));
        },
        cookie(name: string, value: unknown, options?: CookieOptions): Self {
            return apply((state) => addCookie(state.defaults, name, value, options));
        },
        type(type: string): Self {
            if (typeof type !== 'string' || type === '')
                throw new TypeError('type must be a non-empty string');
            return apply((state) => { state.defaults.type = type; });
        }
    });
}
