import type { Request } from 'express';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { ValidationFailure, ValidationIssue, ValidationSchemas, ValidationTarget } from './types.js';
import { createResult, isResult, type Result } from './result.js';

/** Request fields that can be validated, in the order they are checked. */
export const VALIDATION_TARGETS: readonly ValidationTarget[] = ['params', 'query', 'body'];

function isSchema(value: unknown): value is StandardSchemaV1 {
    const props = (value as { '~standard'?: { validate?: unknown } } | null | undefined)?.['~standard'];
    return typeof props?.validate === 'function';
}

/** Throws at declaration time when `.validate(schemas, failure)` receives something unusable. */
export function assertValidation(schemas: unknown, failure: unknown, method = '.validate'): asserts schemas is ValidationSchemas {
    if (typeof schemas !== 'object' || schemas === null || Array.isArray(schemas))
        throw new TypeError(`${method}(schemas): schemas must be an object like { body: schema }`);
    for (const [target, schema] of Object.entries(schemas)) {
        if (!VALIDATION_TARGETS.includes(target as ValidationTarget))
            throw new TypeError(`${method}(schemas): unknown target "${target}" (expected params, query or body)`);
        if (schema !== undefined && !isSchema(schema))
            throw new TypeError(`${method}(schemas): "${target}" is not a Standard Schema (zod, valibot, arktype...)`);
    }
    if (failure !== undefined && typeof failure !== 'function' && !isResult(failure))
        throw new TypeError(`${method}(schemas, failure): failure must be a $.* result (or a function returning one)`);
}

function formatPath(target: ValidationTarget, issue: StandardSchemaV1.Issue): string {
    const segments = (issue.path ?? []).map((segment) => String(typeof segment === 'object' ? segment.key : segment));
    return [target, ...segments].join('.');
}

/**
 * Validates the request against the schemas. On success, the validated values replace
 * `req.params` / `req.query` / `req.body` (own properties, so Express 5's `req.query` getter is shadowed
 * on this request only) and `undefined` is returned. On failure, the issues of every target are returned
 * and the request is left untouched.
 */
export async function validateRequest(schemas: ValidationSchemas, req: Request): Promise<ValidationIssue[] | undefined> {
    const issues: ValidationIssue[] = [];
    const values: Array<[ValidationTarget, unknown]> = [];
    for (const target of VALIDATION_TARGETS) {
        const schema = schemas[target];
        if (schema === undefined)
            continue;
        const result = await schema['~standard'].validate((req as unknown as Record<string, unknown>)[target]);
        if (result.issues)
            issues.push(...result.issues.map((issue) => ({ path: formatPath(target, issue), message: issue.message })));
        else
            values.push([target, result.value]);
    }
    if (issues.length > 0)
        return issues;
    for (const [target, value] of values)
        Object.defineProperty(req, target, { value, writable: true, configurable: true, enumerable: true });
    return undefined;
}

/** Response sent when validation fails: `400 { error: 'Bad Request', issues }` by default. */
export async function resolveValidationFailure(failure: ValidationFailure | undefined, issues: ValidationIssue[], req: Request): Promise<Result> {
    if (failure === undefined)
        return createResult(400, { error: 'Bad Request', issues });
    const result = typeof failure === 'function' ? await failure(issues, req) : failure;
    if (!isResult(result))
        throw new TypeError('validation failure must be a $.* result (or a function returning one)');
    return result;
}
