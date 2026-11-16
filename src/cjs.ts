// CommonJS entry: `require('@ashetm/cont_roller')` returns `$` itself.
// Everything is reachable as a property of `$` (`$.$`, `$.STATUSES`, ...).
// The type re-exports become a namespace merged into `$` in index.d.cts, so CommonJS
// TypeScript users can write `import type { Controller } from` or `$.Controller`.
import { $ } from './dollar.js';

export default $;

export type { Status, StatusCode, StatusName } from './status.generated.js';
export type { AfterCheck, AnyStatusCode, Awaitable, BeforeCheck, Data, GuardFailure, ContentType, Context, Controller, ControllerChain, Handler, StatusMethods } from './types.js';
export type { HeaderValue, Headers } from './response.js';
export type { Dollar, ResultHelpers } from './dollar.js';
export type { Result, ResultOptions } from './result.js';
export type { Config } from './config.js';
export type { RunRequest, RunResult } from './run.js';
export type { CookieEntry } from './response.js';
export type { DownloadBody, FileBody, FileOptions, RenderBody, SendFileOptions } from './delivery.js';
export type { StreamSource } from './stream.js';
export type { ValidatedRequest, ValidationFailure, ValidationIssue, ValidationSchemas, ValidationTarget } from './types.js';
export type { HttpError } from './error.js';
