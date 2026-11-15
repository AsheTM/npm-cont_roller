"use strict";

var _lodash = _interopRequireDefault(require("lodash"));
var _statuses = _interopRequireDefault(require("statuses"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, e) { if ("object" != _typeof(t) || !t) return t; var r; if ("undefined" != typeof Symbol && void 0 !== (r = t[Symbol.toPrimitive])) { var i = r.call(t, e || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === e ? String : Number)(t); }
var Cont_Roller = /*#__PURE__*/function () {
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
    this._statusError = 500;
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
            // true = pass, false = send the error response (as documented)
            passed = cont_roller._conditionalCallback(req, data),
            responseData = _objectSpread({}, data);
          if (!passed) return res.status(cont_roller._statusError).send(cont_roller._payloadError);
          responseData.__status__ = cont_roller._status;
          // Fallbacks: options -> returned data -> instance defaults (data may be null or a primitive)
          var source = data !== null && _typeof(data) === 'object' ? data : {};
          responseData.__contentType__ = options.__contentType__ || source.__contentType__ || source.contentType || cont_roller._contentType;
          responseData.__headers__ = options.__headers__ || source.__headers__ || source.headers || cont_roller._headers;
          responseData.__cookies__ = options.__cookies__ || source.__cookies__ || source.cookies || cont_roller._cookies;
          responseData.__payload__ = source.__payload__ || data || cont_roller._payload || null;
          prepareRes(res, responseData);
          res.send(responseData.__payload__);
        } catch (error) {
          // Error instances serialize to {} in JSON: send the message only (never the stack)
          res.status(500).send({
            __error__: error instanceof Error ? error.message : String(error)
          });
        }
      };
    };
  }
  return _createClass(Cont_Roller, [{
    key: "if",
    value: function _if(conditionalCallback) {
      var self = this;
      this._conditionalCallback = _lodash["default"].isFunction(conditionalCallback) ? conditionalCallback : function () {
        return true;
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
}

// CommonJS entry: `require()` returns `$` itself.
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
  for (var header in headers) res.header(header, headers[header]);
}
function prepareResStatus(res, status) {
  res.status(status);
}
function prepareResContentType(res, contentType) {
  res.type(contentType);
}
function prepareResCookies(res, cookies) {
  if (!Array.isArray(cookies)) return;
  var _iterator = _createForOfIteratorHelper(cookies),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var cookie = _step.value;
      if (cookie && cookie.name) res.cookie(cookie.name, cookie.value, cookie.options || {});
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
}
