import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

describe('build output', () => {
    it('ships CJS, ESM and type declarations', () => {
        for (const file of ['dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'dist/index.d.cts'])
            expect(existsSync(new URL(`../${file}`, import.meta.url)), file).toBe(true);
    });

    it('require() returns the $ function with its aliases', () => {
        const $ = require('../dist/index.cjs');
        expect(typeof $).toBe('function');
        expect($.$).toBe($);
        expect($.default).toBe($);
        expect($.STATUSES.length).toBeGreaterThan(50);
    });

    it('import() exposes $ as default and named export', async () => {
        const entry = '../dist/index.js'; // variable path: dist may not exist at typecheck time
        const mod = await import(entry);
        expect(typeof mod.default).toBe('function');
        expect(mod.$).toBe(mod.default);
        expect(mod.STATUSES.length).toBeGreaterThan(50);
    });

    it('CJS declarations use export =', async () => {
        const { readFileSync } = await import('node:fs');
        const dts = readFileSync(new URL('../dist/index.d.cts', import.meta.url), 'utf8');
        expect(dts).toMatch(/export = \$;/);
    });

    it('exports map points at the built files', () => {
        expect(pkg.exports['.'].require.default).toBe('./dist/index.cjs');
        expect(pkg.exports['.'].import.default).toBe('./dist/index.js');
    });
});
