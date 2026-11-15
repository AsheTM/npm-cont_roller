Cont Roller
===========

A jQuery-style, chainable controller builder for ExpressJS.
Return your data, chain the status, guard it with `.if()`, and get an Express handler back.



Installation
------------

```bash
$ npm install --save @ashetm/cont_roller
```

Requires Node.js 18+ and Express 4 or 5.



Usage
-----

```javascript
const express = require('express');
const $ = require('@ashetm/cont_roller');

const router = express.Router();

const cont = $((req, options) => {
    // Optional: response headers, cookies and content type
    options.__headers__     = { 'X-Powered-By': 'cont_roller' };
    options.__cookies__     = [
        {
            name:       'session',
            value:      'abc123',
            options:    { httpOnly: true }   // Same options as res.cookie()
        }
    ];
    options.__contentType__ = 'json';          // Only 'json' is supported

    // Return the data to send, like res.send(...) / res.json(...)
    return { data: ['...'] };
})._200().if((req, data) => {
    // `data` is the value returned above: { data: ['...'] }
    return data.data.length > 0;   // true: send the data, false: send the error response
})._404({
    error: 'Nothing found'
});

router.get('/test', cont);
```

ES modules work too:

```javascript
import $ from '@ashetm/cont_roller';
// or
import { $ } from '@ashetm/cont_roller';
```



API
---

### `$(callback)`

Creates a controller. `callback(req, options)` returns the data to send.

`options` is a fresh object for every request:

| Property          | Default | Description                                  |
|-------------------|---------|----------------------------------------------|
| `__headers__`     | `{}`    | Response headers                             |
| `__cookies__`     | `[]`    | Array of `{ name, value, options }`          |
| `__contentType__` | `'json'`| Response content type                        |

Return `{ __payload__: value }` to send `value` alone.

### Success status: `._200()`, `._201()`, `._OK()`, `._CREATED()`, ...

One method per HTTP status code, by number (`._204()`) or by name in upper snake case (`._NO_CONTENT()`). Defaults to `200`. Chainable.

### `.if(check)`

`check(req, data)` returns `true` to send the success response, `false` to send the error response.
If `check` is not a function, the check always passes.

### Error response: `._401(body)`, `._404(body)`, `._500(body)`

Called after `.if()`; sets the status and body sent when the check returns `false`, and **returns the Express handler**.

| Method   | Default body                             |
|----------|------------------------------------------|
| `_401()` | `{ __error__: 'Unauthorized' }`          |
| `_404()` | `{ __error__: 'Not Found' }`             |
| `_500()` | `{ __error__: 'Internal Error Server' }` |

### Thrown errors

If `callback` or `check` throws, the handler responds `500` with `{ __error__: error.message }`. The stack trace is never sent.



License
-------

ISC
