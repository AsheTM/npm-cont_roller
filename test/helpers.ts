import express, { type RequestHandler } from 'express';

export function appWith(handler: RequestHandler, path = '/test') {
    const app = express();
    app.get(path, handler);
    // Surface errors forwarded with next(err) as a recognisable response
    app.use(((err, _req, res, _next) => {
        res.status(599).json({ forwarded: err instanceof Error ? err.message : String(err) });
    }) as express.ErrorRequestHandler);
    return app;
}
