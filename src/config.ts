/** Global options, set with `$.config({ ... })`. */
export interface Config {
    /**
     * What happens to unexpected errors (anything but `$.error()` / thrown results):
     * - `'next'` (default): forwarded to Express with `next(err)`, for your error middleware
     * - `'respond'`: answered directly with `500 { error: message }` (never the stack trace)
     */
    errors: 'next' | 'respond';
}

const DEFAULTS: Config = { errors: 'next' };

/**
 * The options live on `globalThis` under a registered symbol, so every copy of the package shares them:
 * a project can load both the CommonJS and the ES module build (dual package), or several copies.
 */
const CONFIG_KEY = Symbol.for('@ashetm/cont_roller/config');
const store = globalThis as typeof globalThis & { [CONFIG_KEY]?: Config };
if (store[CONFIG_KEY] === undefined)
    Object.defineProperty(store, CONFIG_KEY, { value: { ...DEFAULTS }, enumerable: false, configurable: false, writable: false });
const config: Config = store[CONFIG_KEY]!;

export function getConfig(): Readonly<Config> {
    return { ...config };
}

export function setConfig(options: Partial<Config>): void {
    if (typeof options !== 'object' || options === null)
        throw new TypeError('$.config(options): options must be an object');
    if (options.errors !== undefined && options.errors !== 'next' && options.errors !== 'respond')
        throw new TypeError(`$.config(): errors must be 'next' or 'respond', got ${String(options.errors)}`);
    Object.assign(config, options);
}

/** Restores the defaults (mainly for tests). */
export function resetConfig(): void {
    Object.assign(config, DEFAULTS);
}

/** Reads the current error mode on each request, so config changes apply immediately. */
export function errorMode(): Config['errors'] {
    return config.errors;
}
