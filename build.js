import _        from 'lodash';
import status   from 'statuses';


class Cont_Roller{

    constructor(mainCallback) {
        this._headers               = {};
        this._cookies               = [];
        this._contentType           = 'json';
        this._payload               = {};
        this._payloadError          = { __error__: null };
        this._status                = 200;
        this._statusError           = 500;
        /////////////////////////
        ///// Experimentale /////
        /////////////////////////
        this._chain                 = [
            // {
            //     callback:   () => true, 
            //     code:       200
            // }
        ];
        /////////////////////////
        /////////////////////////
        /////////////////////////
        this._conditionalCallback   = () => true;
        this._mainCallback          = mainCallback;
        this._controller            = function(cont_roller) {
            return function(req, res, next) {
                try {
                    let 
                        options         = Object.seal({
                            // Fresh copies per request: mutations must never leak to other requests
                            __headers__ :       { ...cont_roller._headers },  // Headers
                            __cookies__:        [ ...cont_roller._cookies ],  // Array contains { name, value, options }
                            __contentType__:    cont_roller._contentType  // String
                        }), 
                        data            = cont_roller._mainCallback(req, options), 
                        ifGoesWrong     = cont_roller._conditionalCallback(req, data), 
                        responseData    = { ...data };
                    
                    if(ifGoesWrong)
                        return res.status(cont_roller._statusError).send(cont_roller._payloadError);
                    
                    responseData.__status__         = cont_roller._status;
                    // Fallbacks: options -> returned data -> instance defaults (data may be null or a primitive)
                    const source = data !== null && typeof data === 'object' ? data : {};
                    responseData.__contentType__    = options.__contentType__   ||  source.__contentType__  ||  source.contentType  ||  cont_roller._contentType;
                    responseData.__headers__        = options.__headers__       ||  source.__headers__      ||  source.headers      ||  cont_roller._headers;
                    responseData.__cookies__        = options.__cookies__       ||  source.__cookies__      ||  source.cookies      ||  cont_roller._cookies;
                    responseData.__payload__        = source.__payload__        ||  data                    ||  cont_roller._payload    ||  null;
                    
                    prepareRes(res, responseData);
                    res.send(responseData.__payload__);
                } catch(error) {
                    res.status(500).send({ __error__:  error });
                }
            };
        };
    }

    static of(callback) {
        return new Cont_Roller(callback);
    }

    if(conditionalCallback) {
        let self = this;
        this._conditionalCallback   = _.isFunction(conditionalCallback) ? conditionalCallback : () => false;
        return {
            _401:   function(errorResponse = { __error__:  'Unauthorized' }) {
                self._statusError   = 401;
                self._payloadError  = errorResponse;
                return self._controller(self);
            }, 
            _404:   function(errorResponse = { __error__:  'Not Found' }) {
                self._statusError   = 404;
                self._payloadError  = errorResponse;
                return self._controller(self);
            }, 
            _500:   function(errorResponse = { __error__:  'Internal Error Server' }) {
                self._statusError   = 500;
                self._payloadError  = errorResponse;
                return self._controller(self);
            }
        };
    }
    
}

for(let code in status.STATUS_CODES) {
    let 
        _code   = '_' + code, 
        _status = '_' + status.STATUS_CODES[code].replace(/\s+/g, '_').toUpperCase();
    Cont_Roller.prototype[_code] = Cont_Roller.prototype[_status] = function() {
        this._status    = +code;
        return this;
    };
}


function $(callback = (req, options) => '') {
    return Cont_Roller.of(callback);
}

// CommonJS entry: `require()` returns `$` itself.
// `$.$` and `$.default` keep `{ $ }` and default imports working.
module.exports          = $;
module.exports.$        = $;
module.exports.default  = $;


function prepareRes(res, data) {
    prepareResStatus(res, data.__status__);
    prepareResHeaders(res, data.__headers__);
    prepareResContentType(res, data.__contentType__);
    prepareResCookies(res, data.__cookies__);
}

function prepareResHeaders(res, headers) {
    for(let header in headers)
        res.header(header, headers[header]);
}

function prepareResStatus(res, status) {
    res.status(status);
}

function prepareResContentType(res, contentType) {
    res.type(contentType);
}

function prepareResCookies(res, cookies) {
    if(!Array.isArray(cookies))
        return;
    for(const cookie of cookies)
        if(cookie && cookie.name)
            res.cookie(cookie.name, cookie.value, cookie.options || {});
}
