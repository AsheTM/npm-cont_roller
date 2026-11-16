# Cont Roller

[![npm version](https://img.shields.io/npm/v/@ashetm/cont_roller.svg)](https://www.npmjs.com/package/@ashetm/cont_roller)
[![CI](https://github.com/AsheTM/npm-cont_roller/actions/workflows/ci.yml/badge.svg)](https://github.com/AsheTM/npm-cont_roller/actions/workflows/ci.yml)

jQuery-style controllers for Express: **return your data, chain the status, guard before and after.**
Async, fully typed, zero runtime dependencies.

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

## TypeScript

Everything is typed: status names and codes are autocompleted, the handler data flows into `.if()` checks,
and `$.ok(body)` keeps the body type (`Result<B>`).

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
| `.if(check, failure?)` / `.checkAfter()`     | `$.isResult(value)`                          |
|                                              | `$.config(options?)`, `$.STATUSES`           |

| `ctx` (handler 2nd argument)                                                       |
|------------------------------------------------------------------------------------|
| `.header()`, `.cookie()`, `.clearCookie(name, options?)`, `.type()`, `.status()`   |

## Versions and support

| Version | Status |
| --- | --- |
| 2.x | Supported |
| 1.x | **Unsupported** since 2.0.0, see [MIGRATION.md](MIGRATION.md) |

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## License

ISC
