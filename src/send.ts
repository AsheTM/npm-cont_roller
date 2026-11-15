import type { Response } from 'express';

const NO_BODY_STATUSES = new Set([204, 205, 304]);

/** Writes `value` to the Express response with `status`. */
export function send(res: Response, status: number, value: unknown): void {
    res.status(status);
    if (value === undefined || NO_BODY_STATUSES.has(status)) {
        res.end();
        return;
    }
    if (typeof value === 'string' || Buffer.isBuffer(value)) {
        res.send(value);
        return;
    }
    res.json(value);
}
