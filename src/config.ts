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
const config: Config = { ...DEFAULTS };

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
