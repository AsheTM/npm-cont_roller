import { describe, it, expect } from 'vitest';
import { STATUS_CODES } from 'node:http';
import { STATUSES } from '../src/index.js';
// @ts-expect-error: plain ESM script without types
import { toCamelCase } from '../scripts/generate-status.mjs';

describe('status table', () => {
    it('covers every Node.js status code', () => {
        expect(STATUSES.map((s) => String(s.code))).toEqual(Object.keys(STATUS_CODES));
    });

    it.each([
        ['OK', 'ok'],
        ['No Content', 'noContent'],
        ["I'm a Teapot", 'imATeapot'],
        ['Non-Authoritative Information', 'nonAuthoritativeInformation'],
        ['HTTP Version Not Supported', 'httpVersionNotSupported']
    ])('names %s as %s', (text, name) => {
        expect(toCamelCase(text)).toBe(name);
    });

    it('has unique names', () => {
        const names = STATUSES.map((s) => s.name);
        expect(new Set(names).size).toBe(names.length);
    });
});
