import { defineConfig, type Options } from 'tsup';

const shared: Options = {
    dts: true,
    sourcemap: true,
    target: 'node20',
    platform: 'node',
    external: ['express']
};

export default defineConfig([
    { ...shared, entry: { index: 'src/index.ts' }, format: 'esm', clean: true },
    // Separate CJS entry so that module.exports === $
    { ...shared, entry: { index: 'src/cjs.ts' }, format: 'cjs', cjsInterop: true, splitting: true }
]);
