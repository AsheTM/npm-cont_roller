export function assertStatusCode(code: unknown): asserts code is number {
    if (typeof code !== 'number' || !Number.isInteger(code) || code < 100 || code > 999)
        throw new RangeError(`Invalid HTTP status code: ${String(code)}`);
}
