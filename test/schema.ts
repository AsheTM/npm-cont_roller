// Minimal Standard Schema validators for tests, without depending on a validation library.
import type { StandardSchemaV1 } from '@standard-schema/spec';

type Check<O> = (value: unknown) => { value: O } | { issues: StandardSchemaV1.Issue[] };

export function schema<O>(check: Check<O>, async = false): StandardSchemaV1<unknown, O> {
    return {
        '~standard': {
            version:    1,
            vendor:     'test',
            validate:   (value) => {
                const result = check(value) as StandardSchemaV1.Result<O>;
                return async ? Promise.resolve(result) : result;
            }
        }
    };
}

/** `{ [key]: string }` with a non-empty string, as an object schema. */
export const object = <K extends string>(...keys: K[]) => schema<Record<K, string>>((value) => {
    const record = (value ?? {}) as Record<string, unknown>;
    const issues = keys
        .filter((key) => typeof record[key] !== 'string' || record[key] === '')
        .map((key) => ({ message: 'Required', path: [key] }));
    return issues.length ? { issues } : { value: record as Record<K, string> };
});

/** Coerces `value.n` to a number. */
export const coerceN = schema<{ n: number }>((value) => {
    const n = Number((value as { n?: unknown } | undefined)?.n);
    return Number.isNaN(n) ? { issues: [{ message: 'Expected number', path: [{ key: 'n' }] }] } : { value: { n } };
});
