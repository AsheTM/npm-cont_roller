# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [2.3.1] - Unreleased

### Fixed
- `$.config()` is shared by every copy of the package: a project loading both the CommonJS and the ES module build no longer gets two separate configs (#91).

## [2.3.0] - 2026-11-16

### Added
- `$.file()` (alias `$.sendFile()`), `$.download()` and `$.render()`: results sent with Express `res.sendFile()`, `res.download()` and `res.render()`. They keep the builder / ctx status; in `.run()` the body describes what would be sent (#79).
- Returned Node and web streams are piped to the response; `$.stream()` (alias `$.pipe()`) (#80).
- `ctx.res`: the Express response. When the handler reads it and returns nothing, or when the response is already sent, cont_roller sends nothing (#81).
- Types `FileOptions`, `SendFileOptions`, `FileBody`, `DownloadBody`, `RenderBody`, `StreamSource` (#79, #80).

### Changed
- A returned stream was serialized as JSON; it is now piped (#80).
- Errors while sending (missing file, view error, stream error) follow `$.config`. In `respond` mode, a 4xx from Express is answered with its reason phrase, never the file path (#79).
- An error thrown after the response started goes to `next(err)` (#81).

### Pre-releases
- `2.3.0-beta.0`: tested from npm with Express 4 and 5, CommonJS and ESM, TypeScript 5.0 to 6.0 (files, missing files in both error modes, downloads, views, Node and web streams, client disconnects, Server-Sent Events).

## [2.2.0] - 2026-11-16

### Added
- `.validate({ params, query, body }, failure?)`: validation with any [Standard Schema](https://standardschema.dev) library (zod, valibot, arktype...), sync or async. Runs after the guards and before the handler; validated values replace `req.params`, `req.query` and `req.body`. Default failure: `400 { error: 'Bad Request', issues: [{ path, message }] }` (#67).
- Steps-first chain: `$.guard()`, `$.checkBefore()` or `$.validate()`, then `.handle(handler)` (alias `.do(handler)`), with the handler's `req` typed from the schemas. Each step returns a new chain, so chains can be shared between routes (#68).
- `$(schemas, handler)`: validation with a typed `req` in one call (#69).
- Types `ValidationSchemas`, `ValidationIssue`, `ValidationFailure`, `ValidationTarget`, `ValidatedRequest`, `ControllerChain`; `Controller<T, Req>` and `Handler<T, Req>` take the request type, which defaults to Express's `Request` (#67, #68).

### Changed
- Types-only dependency on `@standard-schema/spec` (no runtime code) (#67).

### Pre-releases
- `2.2.0-beta.0`: tested from npm with Express 4 and 5, CommonJS and ESM, zod, valibot and arktype, TypeScript 5.0 to 6.0.

## [2.1.0] - 2026-11-16

### Added
- `controller.run(req)`: run a controller without HTTP and get the response as a plain object (`status`, raw `body`, `headers`, `cookies`, `type`), through the same pipeline as a real request. Unexpected errors follow `$.config` (#60).
- Exported types `RunRequest`, `RunResult` and `CookieEntry` (#60).

### Changed
- Internal: the request pipeline is shared by the Express middleware and `.run()` (#59).

## [2.0.1] - 2026-11-16

### Changed
- `LiteralUnion` now comes from `@ashetm/types` (types-only dependency, no runtime code) instead of an inlined copy (#55).

## [2.0.0] - 2026-11-15

Rewrite in TypeScript. See [MIGRATION.md](MIGRATION.md) for every change and how to upgrade.

### Support
- **1.x is no longer supported** from 2.0.0 on (#36).

### Breaking changes
- `$(handler)` returns the Express middleware itself; the `.if(fn)._401()/_404()/_500()` terminating calls are removed (#27, #33).
- The handler's `options` argument (`__headers__`, `__cookies__`, `__contentType__`) is replaced by a chainable `ctx` (#30).
- `{ __payload__ }` is removed: the returned value is the body (#27).
- Uppercase status methods (`._OK()`, `._NOT_FOUND()`) are removed (#28).
- Unexpected errors are forwarded to `next(err)` instead of answering `500 { __error__ }` (#34).
- Requires Node.js 20+; package is now `"type": "module"` with an `exports` map (CommonJS still supported) (#26).

### Added
- Async handlers (#27).
- Success status in three forms for every code: `._201()`, `.created()`, `.status(201)` (#28).
- Builder defaults: `.header()`, `.cookie()`, `.type()` (#29).
- Per-request `ctx`: `header()`, `cookie()`, `clearCookie()`, `type()`, `status()` (#30).
- Result helpers for every status code (`$.ok()`, `$.notFound()`...), `$.status()`, `$.redirect()`, `$.isResult()` (#31).
- `throw $.error(status, body?)`, `HttpError`, `$.isHttpError()` (#32).
- Guards before the handler: `.guard()` / `.checkBefore()`; after: `.if()` / `.checkAfter()`, repeatable (#33).
- `$.config({ errors: 'respond' })` (#34).
- TypeScript declarations for ESM and CommonJS, including type imports from CommonJS (#26, #49); no runtime dependencies.

### Pre-releases
- `2.0.0-beta.0`, `2.0.0-beta.1` (CommonJS type exports fix, #49).

## [1.0.2] - 2026-11-15

### Fixed
- `require('@ashetm/cont_roller')` now returns the `$` function; `$.$` and `$.default` remain available (#7).
- Cookies from `options.__cookies__` are now set instead of failing with a 500 (#8).
- **Security:** headers and cookies no longer leak between requests (#9).
- No more `ReferenceError` when an option is cleared; `null`/`undefined` return values are handled (#10).
- Thrown errors are sent as `{ __error__: message }` instead of `{ __error__: {} }`, without the stack trace (#11).
- `.if()` now follows the documentation: `true` sends the success response, `false` sends the error response (#12).

### Changed
- `.if()` behaviour is inverted compared to 1.0.1 to match the README (#12).
- Source moved to `src/index.js`; the package only ships the built `index.js` (#13).
- Declared `express` (>=4) as a peer dependency and Node.js >=18 as the supported engine (#13).

### Added
- Test suite (vitest + supertest) and CI on Node 20/22/24 with Express 4 and 5 (#6).

### Security
- Dev dependencies updated; `npm audit` reports 0 vulnerabilities (#22).

## [1.0.1] - 2019-12-09

## [1.0.0] - 2019-12-09

- First release.

[2.3.1]: https://github.com/AsheTM/npm-cont_roller/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/AsheTM/npm-cont_roller/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/AsheTM/npm-cont_roller/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/AsheTM/npm-cont_roller/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/AsheTM/npm-cont_roller/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/AsheTM/npm-cont_roller/compare/v1.0.2...v2.0.0
[1.0.2]: https://github.com/AsheTM/npm-cont_roller/compare/v1.0.1...v1.0.2
