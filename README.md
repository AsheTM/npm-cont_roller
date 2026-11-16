# Cont Roller

[![npm version](https://img.shields.io/npm/v/@ashetm/cont_roller.svg)](https://www.npmjs.com/package/@ashetm/cont_roller)
[![CI](https://github.com/AsheTM/npm-cont_roller/actions/workflows/ci.yml/badge.svg)](https://github.com/AsheTM/npm-cont_roller/actions/workflows/ci.yml)

jQuery-style controllers for Express: **return your data, chain the status, guard before and after.**
Async, fully typed, validation with zod, valibot or arktype, zero runtime dependencies.

```ts
import $ from '@ashetm/cont_roller';

router.get('/users/:id', $(async (req) => db.users.find(req.params.id))
    .guard((req) => !!req.user, $.unauthorized())   // before the handler
    .if((req, user) => !!user, $.notFound())         // after the handler
);
```

> **Upgrading from v1?** See [MIGRATION.md](MIGRATION.md). Version 1.x is no longer supported.

## Installation

```bash
npm install @ashetm/cont_roller
```

Requires Node.js 20+ and Express 4 or 5. Works with `import` and `require`:

```ts
import $ from '@ashetm/cont_roller';           // or: import { $ } from '...'
const $ = require('@ashetm/cont_roller');       // require() returns $ itself
```

## Quick start

```ts
import express from 'express';
import $ from '@ashetm/cont_roller';

const app = express();

// The value returned by $(...) IS the Express middleware: no terminating call needed.
app.get('/health', $(() => ({ status: 'up' })));

app.post('/users', $(async (req, ctx) => {
    const user = await db.users.create(req.body);
    ctx.header('Location', `/users/${user.id}`);
    return user;
}).created());                                     // 201
```

The handler `(req, ctx) => value` may be sync or `async`. Its return value is the response body:

| Returned value                  | Response                                  |
|---------------------------------|-------------------------------------------|
| object, array, `null`, number   | JSON                                      |
| string, `Buffer`                | sent as-is (`res.send`)                   |
| a stream (Node or web)          | piped                                     |
| `undefined`                     | empty body                                |
| a `$.*` result                  | that result (status, body, headers...)    |

Statuses 204, 205 and 304 never carry a body.

> **Strings are sent as `text/html`** (Express's default for `res.send`). When a string may contain
> user input, set a non-HTML type to avoid XSS: `$(handler).type('text')` or `ctx.type('text')`.

## The builder: `$(handler)`

Every builder method is chainable and returns the controller (the middleware) itself.

### Success status: three equivalent forms

```ts
$(handler)._201()        // by number
$(handler).created()     // by camelCase name
$(handler).status(201)   // generic (any code from 100 to 999)
```

Both forms exist for **every** status code: `._204()` / `.noContent()`, `._418()` / `.imATeapot()`... Default: `200`.

### Defaults for every response

```ts
$(handler)
    .header('Cache-Control', 'no-store')            // or .header({ 'Cache-Control': 'no-store' })
    .cookie('v', '2', { httpOnly: true })           // same options as res.cookie()
    .type('json');                                  // same values as res.type()
```

Header names are case-insensitive (the last write wins). A non-JSON `.type()` sends the body as-is.

### Guards: before and after the handler

| Runs | Methods (aliases) | `check` receives |
| --- | --- | --- |
| **before** the handler | `.guard(check, failure)` = `.checkBefore(check, failure)` | `(req)` |
| **after** the handler | `.if(check, failure)` = `.checkAfter(check, failure)` | `(req, data)` |

```ts
$(async (req) => db.docs.find(req.params.id))
    .guard((req) => !!req.user, $.unauthorized())                 // no DB query when logged out
    .if((req, doc) => !!doc, $.notFound({ error: 'No such doc' }))
    .checkAfter((req, doc) => doc.owner === req.user.id,
        (req, doc) => $.forbidden({ error: `Not your doc ${doc.id}` }));
```

- `check` may be async; a truthy value passes, a falsy value sends `failure`.
- `failure` is a `$.*` result, or a function returning one. Default: `500 { error: 'Internal Server Error' }`.
- Guards run in declaration order, the first failure wins. When a before-guard fails, the handler never runs.
- After-guards are skipped when the handler returns a `$.*` result: the handler already decided.

## Validation: `.validate(schemas)`

Validate `params`, `query` and `body` with any [Standard Schema](https://standardschema.dev) library:
[zod](https://zod.dev), [valibot](https://valibot.dev), [arktype](https://arktype.io)... Install the one you like;
cont_roller does not depend on any of them.

```ts
import { z } from 'zod';

const User = z.object({ name: z.string().min(1), age: z.coerce.number() });

router.post('/users/:id', $(async (req) => db.users.update(req.params.id, req.body))
    .validate({ body: User, params: z.object({ id: z.uuid() }) })
);
```

- The validated values **replace** `req.params`, `req.query` and `req.body`, so coercions and defaults apply
  (`age: '42'` becomes `42`).
- Validators may be async. Several `.validate()` calls run in order; the first failure wins.
- On invalid data the handler does not run, and the response lists the problems of every field:

```text
400 { "error": "Bad Request", "issues": [{ "path": "body.name", "message": "Too small: expected string to have >=1 characters" }] }
```

To answer something else, pass a failure, like for guards: a `$.*` result, or a function receiving the issues.

```ts
$(handler).validate({ body: User }, (issues, req) => $.unprocessableEntity({ invalid: issues.map((i) => i.path) }))
```

### Typed `req`: `$(schemas, handler)` or `$.validate(schemas).handle(handler)`

With `$(handler).validate(...)`, the handler is written before the schemas, so TypeScript cannot type its `req`
from them (the validation still runs). To get `req.body` typed from the schema, give the schemas **first**:

```ts
router.post('/users', $({ body: User }, async (req) => {
    req.body.age;                                   // number, from the schema
    return db.users.create(req.body);
}).created());

// or, as a chain (see "Steps first" below)
router.post('/users', $.validate({ body: User }).handle(async (req) => db.users.create(req.body)).created());
```

## Steps first: `$.guard(...)...handle(handler)`

The same controller can be written in the order its steps run, with the handler in the middle.
`.handle()` has an alias, `.do()`.

```ts
// handler first
$(async (req) => db.docs.create(req.body))
    .guard((req) => !!req.user, $.unauthorized())
    .validate({ body: Doc })
    .if((req, doc) => !!doc, $.notFound());

// steps first: same controller, and req.body is typed from Doc
$.guard((req) => !!req.user, $.unauthorized())
    .validate({ body: Doc })
    .handle(async (req) => db.docs.create(req.body))      // or .do(...)
    .if((req, doc) => !!doc, $.notFound());
```

- Start with `$.guard()`, `$.checkBefore()` or `$.validate()`. Before the handler you can also set the status
  (`.created()`, `._201()`, `.status(201)`), `.header()`, `.cookie()` and `.type()`.
- `.handle(handler)` returns the normal controller: `.if()`, `.run()`, and every other method work as usual.
- The chain is not a middleware until `.handle()` is called (Express and TypeScript reject it).
- Each step returns a **new** chain, so a chain can be shared between routes:

```ts
const loggedIn = $.guard((req) => !!req.user, $.unauthorized());

router.get('/me', loggedIn.handle((req) => req.user));
router.post('/posts', loggedIn.validate({ body: Post }).handle((req) => db.posts.create(req.body)).created());
```

### Run order

Whatever the style and the order of the calls, a request always goes through:

**guards** (`.guard`, `.checkBefore`) → **validation** (`.validate`) → **handler** → **after-checks** (`.if`, `.checkAfter`)

So a logged-out user always gets the guard's 401, never a 400 about their data, and a guard's `req` is the raw request.

## Per-request context: `ctx`

The handler's second argument changes **this response only**, on top of the builder defaults. Chainable.

```ts
$(async (req, ctx) => {
    ctx.header('X-Source', 'cache')
       .cookie('seen', '1', { maxAge: 60_000 })
       .clearCookie('legacy')
       .type('json')
       .status(202);                                // overrides the builder status
    return data;
})
```

## Files, views and streams

```ts
$((req) => $.file(req.params.name, { root: '/data/public', maxAge: '1d' }))   // res.sendFile, alias $.sendFile
$(() => $.download('/data/report.csv', 'report-2026.csv'))                    // res.download (attachment)
$((req) => $.render('profile', { user: req.user }))                           // res.render (the app's view engine)
$(() => $.stream(fs.createReadStream('/data/big.csv'), { type: 'text/csv' })) // pipes a stream, alias $.pipe
$(() => fs.createReadStream('/data/big.csv')).type('text/csv')                // same: returned streams are piped
```

- These helpers return results, like `$.ok()`: return them from a handler, or use them as a guard failure.
  They have **no status of their own**: the builder or `ctx` status applies (200 by default).
- Their last argument also takes `headers`, `cookies` and `type`; `$.file()` and `$.download()` also take Express's
  `sendFile` options (`root`, `maxAge`, `dotfiles`, `lastModified`...).
- `$.file()` sends any path it receives: with user input, use `root` and validate the name
  (`.validate({ params: z.object({ name: z.string().regex(/^[\w.-]+$/) }) })`).
- Streams can be Node readable streams or web `ReadableStream`s (`fetch(...).body`).

Errors while sending follow `$.config`. By default they go to `next(err)`, and Express answers 404 for a missing file.
With `errors: 'respond'`, a missing file is answered `404 { error: 'Not Found' }` (never the path), and other errors 500.
If a stream fails after it started, the connection is closed and the error goes to `next(err)`.
If the client goes away, the stream is stopped, and nothing is reported.

### Anything else: `ctx.res`

`ctx.res` is the Express response, for what the helpers do not cover: Server-Sent Events, custom writes, other libraries.

```ts
$(async (req, ctx) => {
    ctx.res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for await (const event of events)
        ctx.res.write(`data: ${JSON.stringify(event)}\n\n`);
    ctx.res.end();
})
```

When the handler reads `ctx.res` and returns nothing (`undefined`), the handler is answering: cont_roller sends
nothing and skips the after-checks. It also sends nothing when the response was already sent.
If the handler returns a value, it is sent as usual.

> Prefer `ctx.header()`, `ctx.cookie()`, `ctx.status()` and the `$.*` helpers when they are enough: they can be tested
> with `.run()`, where `ctx.res` does not exist (reading it throws).

## Result helpers: `$.ok(body)`, `$.notFound(body)`, …

`$` has one static helper per status code. A helper returns a **result**: a complete response
(status, body, headers, cookies, type) to return from a handler or to use as a guard failure.

```ts
return $.notFound({ error: 'User not found' });
return $.created(user, {
    headers: { Location: `/users/${user.id}` },
    cookies: [{ name: 'last', value: user.id, options: { httpOnly: true } }],
    type:    'json'
});
return $.status(418, { tea: true });                // generic form
return $.redirect('/login');                        // 302 + Location; $.redirect('/new', 301)
```

Results are immutable, so one instance can be shared: `.guard(isAdmin, FORBIDDEN)`.
A result is layered last: **builder defaults → ctx → result** (headers override by name, cookies are appended).

### `$(handler).ok()` vs `$.ok(body)`

Same name, two different things, like jQuery's `$(el).each()` and `$.each()`:

| Call               | On           | Does                                                  |
|--------------------|--------------|-------------------------------------------------------|
| `$(handler).ok()`  | a controller | sets the **default success status** (chainable)       |
| `$.ok(body)`       | `$` itself   | **creates a result** to return or to use in a guard   |

## Errors

### `throw $.error(status, body?, options?)`

Throws an `HttpError` that becomes its response, from a handler or a guard:

```ts
$(async (req) => {
    const user = await db.users.find(req.params.id);
    if (!user) throw $.error(404, { error: 'User not found' });
    if (!user.active) throw $.error(403);           // body: { error: 'Forbidden' }
    return user;
})
```

`HttpError` is a real `Error` (`message`, `stack`) with `status`, `body` and `result`.
It is exported (`import { HttpError } from '@ashetm/cont_roller'`, or `$.HttpError`); use `$.isHttpError(value)` to check it.
Throwing a result (`throw $.notFound()`) works too.

### Unexpected errors

Any other error (or rejected promise) is forwarded to Express with `next(err)`, so your error middleware handles it.
To answer them directly instead:

```ts
$.config({ errors: 'respond' });   // unexpected errors → 500 { error: message } (never the stack)
$.config();                        // reads the current options
```

> With `'respond'`, `error.message` is sent to clients: make sure your messages are safe to expose.

If the response was already sent, errors always go to `next(err)`.

## Testing: `controller.run(req)`

Run a controller **without HTTP**: no Express app, no supertest, no port. `.run()` goes through the same
steps as a real request (guards, handler, results, `$.error()`) and resolves with the response as a plain object.

```ts
const getUser = $(async (req) => db.users.find(req.params.id))
    .header('Cache-Control', 'no-store')
    .guard((req) => !!req.headers.authorization, $.unauthorized())
    .if((req, user) => !!user, $.notFound({ error: 'User not found' }));

const res = await getUser.run({ params: { id: '1' }, headers: { authorization: 'Bearer x' } });
// {
//     status:  200,
//     body:    { id: '1', name: 'Ada' },
//     headers: { 'cache-control': 'no-store' },
//     cookies: [],
//     type:    undefined
// }

expect((await getUser.run({ params: { id: '1' } })).status).toBe(401);                       // guard failed
expect((await getUser.run({ params: { id: '9' }, headers: { authorization: 'x' } })).body)
    .toEqual({ error: 'User not found' });
```

The request is a plain object with only what the controller reads: `params`, `query`, `body`, `headers`,
`cookies`, `method`, or custom fields such as `user`. Missing fields default to empty values, and header names
are case-insensitive.

| Result field | Content |
| --- | --- |
| `status` | the status code |
| `body` | the raw value (not serialized to JSON); `undefined` for 204, 205 and 304 |
| | files, downloads and views are not read or rendered: `{ file, options }`, `{ download, filename, options }`, `{ render, locals }`; a stream is returned as is |
| `headers` | response headers, with lowercase names |
| `cookies` | `{ name, value, options }` in order; cleared cookies have `clear: true` |
| `type` | the content type set by the builder, `ctx` or result, if any |

Unexpected errors follow `$.config`: by default the promise **rejects** with the error (the equivalent of
`next(err)`); with `$.config({ errors: 'respond' })` it resolves with `{ status: 500, body: { error: message } }`.

```ts
await expect(crashing.run()).rejects.toThrow('db down');
```

Controllers that read `ctx.res` cannot run without HTTP: test them with supertest.

In TypeScript, `body` is `unknown` (it can be the data or a failure body); narrow it with `run<User>()`.

> `.run()` tests the controller itself. Keep a few supertest tests for what happens around it
> (routing, body parsers, other middlewares).

## TypeScript

Everything is typed: status names and codes are autocompleted, the handler data flows into `.if()` checks,
`$.ok(body)` keeps the body type (`Result<B>`), and `req` is typed from the validation schemas
with `$(schemas, handler)` or `$.validate(schemas).handle(handler)`.

```ts
import $, { type Controller, type Result, HttpError } from '@ashetm/cont_roller';

const getUser: Controller<User | null> = $(async (req) => db.users.find(req.params.id))
    .if((req, user) => user !== null, $.notFound());   // user: User | null
```

CommonJS projects: `import $ = require('@ashetm/cont_roller')`.

## API summary

| Builder `$(handler)`                         | Static `$`                                   |
|----------------------------------------------|----------------------------------------------|
| `._200()`, `.ok()`, `.status(code)`          | `$.ok(body?, options?)`, ... one per status  |
| `.header(name, value)` / `.header(object)`   | `$.status(code, body?, options?)`            |
| `.cookie(name, value, options?)`             | `$.redirect(url, code = 302, options?)`      |
| `.type(type)`                                | `$.error(status, body?, options?)`           |
| `.guard(check, failure?)` / `.checkBefore()` | `$.HttpError`, `$.isHttpError(value)`        |
| `.validate(schemas, failure?)`               | `$.isResult(value)`                          |
| `.if(check, failure?)` / `.checkAfter()`     | `$.config(options?)`, `$.STATUSES`           |
| `.run(req?)` (testing, no HTTP)              | `$.file(path, options?)` / `$.sendFile()`    |
|                                              | `$.download(path, filename?, options?)`      |
|                                              | `$.render(view, locals?, options?)`          |
|                                              | `$.stream(source, options?)` / `$.pipe()`    |

| Other ways to start                                                       | Gives                                         |
|---------------------------------------------------------------------------|-----------------------------------------------|
| `$(schemas, handler)`                                                     | a controller, `req` typed from the schemas    |
| `$.guard()` / `$.checkBefore()` / `$.validate()` ... `.handle(handler)`   | a steps-first chain, then a controller        |
| `.do(handler)`                                                            | alias of `.handle(handler)`                   |

| `ctx` (handler 2nd argument)                                                       |
|------------------------------------------------------------------------------------|
| `.header()`, `.cookie()`, `.clearCookie(name, options?)`, `.type()`, `.status()`   |
| `.res`: the Express response (the handler answers itself when it returns nothing)  |

## Versions and support

| Version | Status |
| --- | --- |
| 2.x | Supported |
| 1.x | **Unsupported** since 2.0.0, see [MIGRATION.md](MIGRATION.md) |

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## License

ISC
