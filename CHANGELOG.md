# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

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

[1.0.2]: https://github.com/AsheTM/npm-cont_roller/compare/v1.0.1...v1.0.2
