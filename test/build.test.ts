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

    it('loads through require()', () => {
        const mod = require('../dist/index.cjs');
        expect(mod.STATUSES.length).toBeGreaterThan(50);
    });

    it('loads through import()', async () => {
        const entry = '../dist/index.js'; // variable path: dist may not exist at typecheck time
        const mod = await import(entry);
        expect(mod.STATUSES.length).toBeGreaterThan(50);
    });

    it('exports map points at the built files', () => {
        expect(pkg.exports['.'].require.default).toBe('./dist/index.cjs');
        expect(pkg.exports['.'].import.default).toBe('./dist/index.js');
    });
});
