"use strict";

var _lodash = _interopRequireDefault(require("lodash"));

var _statuses = _interopRequireDefault(require("statuses"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var Cont_Roller =
/*#__PURE__*/
function () {
  function Cont_Roller(mainCallback) {
    _classCallCheck(this, Cont_Roller);

    this._headers = {};
    this._cookies = [];
    this._contentType = 'json';
    this._payload = {};
    this._payloadError = {
      __error__: null
    };
    this._status = 200;
    this._statusError = 500; /////////////////////////
    ///// Experimentale /////
    /////////////////////////

    this._chain = [// {
      //     callback:   () => true, 
      //     code:       200
      // }
    ]; /////////////////////////
    /////////////////////////
    /////////////////////////

    this._conditionalCallback = function () {
      return true;
    };

    this._mainCallback = mainCallback;

    this._controller = function (cont_roller) {
      return function (req, res, next) {
        try {
          var options = Object.seal({
            // Fresh copies per request: mutations must never leak to other requests
            __headers__: _objectSpread({}, cont_roller._headers),
            // Headers
            __cookies__: _toConsumableArray(cont_roller._cookies),
            // Array contains { name, value, options }
            __contentType__: cont_roller._contentType // String

          }),
              data = cont_roller._mainCallback(req, options),
              ifGoesWrong = cont_roller._conditionalCallback(req, data),
              responseData = _objectSpread({}, data);

          if (ifGoesWrong) return res.status(cont_roller._statusError).send(cont_roller._payloadError);
          responseData.__status__ = cont_roller._status; // Fallbacks: options -> returned data -> instance defaults (data may be null or a primitive)

          var source = data !== null && _typeof(data) === 'object' ? data : {};
          responseData.__contentType__ = options.__contentType__ || source.__contentType__ || source.contentType || cont_roller._contentType;
          responseData.__headers__ = options.__headers__ || source.__headers__ || source.headers || cont_roller._headers;
          responseData.__cookies__ = options.__cookies__ || source.__cookies__ || source.cookies || cont_roller._cookies;
          responseData.__payload__ = source.__payload__ || data || cont_roller._payload || null;
          prepareRes(res, responseData);
          res.send(responseData.__payload__);
        } catch (error) {
          res.status(500).send({
            __error__: error
          });
        }
      };
    };
  }

  _createClass(Cont_Roller, [{
    key: "if",
    value: function _if(conditionalCallback) {
      var self = this;
      this._conditionalCallback = _lodash["default"].isFunction(conditionalCallback) ? conditionalCallback : function () {
        return false;
      };
      return {
        _401: function _401() {
          var errorResponse = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
            __error__: 'Unauthorized'
          };
          self._statusError = 401;
          self._payloadError = errorResponse;
          return self._controller(self);
        },
        _404: function _404() {
          var errorResponse = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
            __error__: 'Not Found'
          };
          self._statusError = 404;
          self._payloadError = errorResponse;
          return self._controller(self);
        },
        _500: function _500() {
          var errorResponse = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
            __error__: 'Internal Error Server'
          };
          self._statusError = 500;
          self._payloadError = errorResponse;
          return self._controller(self);
        }
      };
    }
  }], [{
    key: "of",
    value: function of(callback) {
      return new Cont_Roller(callback);
    }
  }]);

  return Cont_Roller;
}();

var _loop = function _loop(code) {
  var _code = '_' + code,
      _status = '_' + _statuses["default"].STATUS_CODES[code].replace(/\s+/g, '_').toUpperCase();

  Cont_Roller.prototype[_code] = Cont_Roller.prototype[_status] = function () {
    this._status = +code;
    return this;
  };
};

for (var code in _statuses["default"].STATUS_CODES) {
  _loop(code);
}

function $() {
  var callback = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function (req, options) {
    return '';
  };
  return Cont_Roller.of(callback);
} // CommonJS entry: `require()` returns `$` itself.
// `$.$` and `$.default` keep `{ $ }` and default imports working.


module.exports = $;
module.exports.$ = $;
module.exports["default"] = $;

function prepareRes(res, data) {
  prepareResStatus(res, data.__status__);
  prepareResHeaders(res, data.__headers__);
  prepareResContentType(res, data.__contentType__);
  prepareResCookies(res, data.__cookies__);
}

function prepareResHeaders(res, headers) {
  for (var header in headers) {
    res.header(header, headers[header]);
  }
}

function prepareResStatus(res, status) {
  res.status(status);
}

function prepareResContentType(res, contentType) {
  res.type(contentType);
}

function prepareResCookies(res, cookies) {
  if (!Array.isArray(cookies)) return;
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = cookies[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var cookie = _step.value;
      if (cookie && cookie.name) res.cookie(cookie.name, cookie.value, cookie.options || {});
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator["return"] != null) {
        _iterator["return"]();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }
}
