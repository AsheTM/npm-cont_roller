# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[2.0.1]: https://github.com/AsheTM/npm-cont_roller/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/AsheTM/npm-cont_roller/compare/v1.0.2...v2.0.0
[1.0.2]: https://github.com/AsheTM/npm-cont_roller/compare/v1.0.1...v1.0.2
