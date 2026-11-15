import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('module exports', () => {
    it('require() returns the $ function', () => {
        const $ = require('../index.js');
        expect(typeof $).toBe('function');
    });

    it('keeps $ and default aliases', () => {
        const $ = require('../index.js');
        expect($.$).toBe($);
        expect($.default).toBe($);
    });

    it('works with ESM default and named imports', async () => {
        const mod = await import('../index.js');
        expect(typeof mod.default).toBe('function');
        expect(mod.$).toBe(mod.default);
    });
});
