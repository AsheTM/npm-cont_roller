# Migrating from v1 to v2

Version 2 is a rewrite in TypeScript. The `$` entry point and the chaining style stay, but most of the
v1 API changed. There is no compatibility layer: each v1 handler needs a small rewrite, shown below.

> **Version 1.x is no longer supported** since 2.0.0: it receives no fixes, including security fixes.

## Requirements

| | v1 | v2 |
| --- | --- | --- |
| Node.js | >= 18 | **>= 20** |
| Express | 4 or 5 | 4 or 5 |
| Runtime dependencies | `lodash`, `statuses` | none |

## At a glance

v1:

```js
const $ = require('@ashetm/cont_roller');

const cont = $((req, options) => {
    options.__headers__     = { 'X-Foo': 'bar' };
    options.__cookies__     = [{ name: 'sid', value: 'abc', options: { httpOnly: true } }];
    options.__contentType__ = 'json';
    return { data: ['...'] };
})._200().if((req, data) => data.data.length > 0)._404({ error: 'Nothing found' });

router.get('/test', cont);
```

v2:

```js
const $ = require('@ashetm/cont_roller');

const cont = $((req, ctx) => {
    ctx.header('X-Foo', 'bar').cookie('sid', 'abc', { httpOnly: true }).type('json');
    return { data: ['...'] };
})._200().if((req, data) => data.data.length > 0, $.notFound({ error: 'Nothing found' }));

router.get('/test', cont);
```

## Every change

### The handler's second argument: `options` → `ctx`

| v1 | v2 |
| --- | --- |
| `options.__headers__ = { 'X-A': '1' }` | `ctx.header('X-A', '1')` or `ctx.header({ 'X-A': '1' })` |
| `options.__cookies__ = [{ name, value, options }]` | `ctx.cookie(name, value, options)` (once per cookie) |
| `options.__contentType__ = 'json'` | `ctx.type('json')` |
| (not available) | `ctx.status(201)`, `ctx.clearCookie(name)` |

`ctx` methods are chainable and only affect the current response.
For headers, cookies or a type shared by **every** response, set them on the builder instead:
`$(handler).header(...).cookie(...).type(...)`.

### The returned value

| v1 | v2 |
| --- | --- |
| `return { __payload__: value }` | `return value` |
| `return { __headers__: ..., data }` | `ctx.header(...)` then `return data`, or `return $.ok(data, { headers })` |
| returning a `Promise` sent `{}` | `async` handlers are supported |

### Checks: `.if(fn)._404(body)` → `.if(fn, $.notFound(body))`

In v1, `.if()` returned an object with `_401()`, `_404()` and `_500()`, and that call ended the chain.
In v2, the failure response is the second argument of `.if()`, and `$(handler)` is already the middleware.

| v1 | v2 |
| --- | --- |
| `.if(fn)._401(body)` | `.if(fn, $.unauthorized(body))` |
| `.if(fn)._404(body)` | `.if(fn, $.notFound(body))` |
| `.if(fn)._500(body)` | `.if(fn, $.internalServerError(body))` or `.if(fn)` (default failure: 500) |
| `.if(fn)._404()` (default body `{ __error__: 'Not Found' }`) | `.if(fn, $.notFound())` sends an empty body, use `.if(fn, $.error(404).result)` for `{ error: 'Not Found' }` |
| one `.if()` only | several checks, in order |

The meaning of the check is unchanged: `true` sends the data, `false` sends the failure.

New in v2: checks that run **before** the handler, so it does not run at all when they fail
(for example to skip a database query for logged-out users):

```js
$(handler)
    .guard((req) => !!req.user, $.unauthorized())   // before (alias: .checkBefore)
    .if((req, data) => !!data, $.notFound());       // after  (alias: .checkAfter)
```

### Status methods

| v1 | v2 |
| --- | --- |
| `._200()`, `._404()`... | unchanged |
| `._OK()`, `._NOT_FOUND()`, `._CREATED()`... (uppercase names) | **removed**: use `.ok()`, `.notFound()`, `.created()`... or the numeric form |
| `._I'M_A_TEAPOT()` (bracket access only) | `.imATeapot()` |
| (not available) | `.status(201)` |

> `$(handler).ok()` sets the success status; `$.ok(body)` creates a result. See the README.

### Errors

| | v1 | v2 |
| --- | --- | --- |
| Error thrown in the handler | `500 { __error__: message }` | forwarded to Express with `next(err)` |
| Answer with an HTTP error | (not available) | `throw $.error(404, { error: 'Not found' })` |
| Keep answering 500 directly | default | `$.config({ errors: 'respond' })`, sends `500 { error: message }` |

The error key also changed from `__error__` to `error`. If your clients read `__error__`, pass explicit
bodies: `$.error(404, { __error__: 'Not Found' })`.

### Imports

`require('@ashetm/cont_roller')` still returns `$`. ES modules can use `import $ from` or `import { $ } from`.
TypeScript CommonJS projects: `import $ = require('@ashetm/cont_roller')`.

## Checklist

1. Upgrade Node.js to 20 or later.
2. `npm install @ashetm/cont_roller@2`
3. Replace `options.__headers__` / `__cookies__` / `__contentType__` with `ctx.header()` / `ctx.cookie()` / `ctx.type()`.
4. Replace `{ __payload__: value }` with `value`.
5. Replace `.if(fn)._404(body)` (and `_401` / `_500`) with `.if(fn, $.notFound(body))`.
6. Replace uppercase status methods (`._OK()`) with `.ok()` or `._200()`.
7. Add an Express error middleware, or call `$.config({ errors: 'respond' })` once at startup.
8. Update clients reading `__error__`.
