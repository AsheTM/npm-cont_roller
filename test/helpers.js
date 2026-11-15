import { createRequire } from 'node:module';
import express from 'express';

const require = createRequire(import.meta.url);

// Load the built CommonJS entry exactly as consumers do.
export const lib = require('../index.js');
export const $ = typeof lib === 'function' ? lib : lib.default;

export function appWith(handler, path = '/test') {
    const app = express();
    app.get(path, handler);
    return app;
}
