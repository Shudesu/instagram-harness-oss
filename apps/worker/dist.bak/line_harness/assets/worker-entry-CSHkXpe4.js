var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index2 = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index2) {
        throw new Error("next() called multiple times");
      }
      index2 = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
};
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index2) => {
    if (index2 === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index2) => {
    const mark = `@${index2}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
};
var tryDecodeURI = (str) => tryDecode(str, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var _decodeURI = (value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
};
var _getQueryParam = (url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;
var tryDecodeURIComponent = (str) => tryDecode(str, decodeURIComponent_);
var HonoRequest = class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return this.bodyCache.parsedBody ??= await parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};
var HtmlEscapedCallbackPhase = {
  Stringify: 1
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c2) => c2({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  {
    return resStr;
  }
};
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";
var notFoundHandler = (c2) => {
  return c2.text("404 Not Found", 404);
};
var errorHandler = (err, c2) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c2.newResponse(res.body, res);
  }
  console.error(err);
  return c2.text("Internal Server Error", 500);
};
var Hono$1 = class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = async (c2, next) => (await compose([], app2.errorHandler)(c2, () => r.handler(c2, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request) => request;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c2) => {
      const options2 = optionHandler(c2);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c2) => {
      let executionContext = void 0;
      try {
        executionContext = c2.executionCtx;
      } catch {
      }
      return [c2.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = async (c2, next) => {
      const res = await applicationHandler(replaceRequest(c2.req.raw), ...getOptions(c2));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c2) {
    if (err instanceof Error) {
      return this.errorHandler(err, c2);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c2 = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c2, async () => {
          c2.res = await this.#notFoundHandler(c2);
        });
      } catch (err) {
        return this.#handleError(err, c2);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c2.finalized ? c2.res : this.#notFoundHandler(c2))
      ).catch((err) => this.#handleError(err, c2)) : res ?? this.#notFoundHandler(c2);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c2);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c2);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = ((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index2 = match3.indexOf("", 1);
    return [matcher[1][index2], match3];
  });
  this.match = match2;
  return match2(method, path);
}
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node$1 = class _Node {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index2, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index2;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index2, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c2 = this.#children[k];
      return (typeof c2.#varIndex === "number" ? `(${k})@${c2.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c2.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node$1();
  insert(path, index2, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index2, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = (children) => {
  for (const _ in children) {
    return true;
  }
  return false;
};
var Node = class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};
var TrieRouter = class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};
var Hono = class extends Hono$1 {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};
var cors = (options) => {
  const defaults = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: []
  };
  const opts = {
    ...defaults,
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return async function cors2(c2, next) {
    function set(key, value) {
      c2.res.headers.set(key, value);
    }
    const allowOrigin = await findAllowOrigin(c2.req.header("origin") || "", c2);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c2.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c2.req.header("origin") || "", c2);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c2.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c2.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c2.res.headers.delete("Content-Length");
      c2.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c2.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c2.header("Vary", "Origin", { append: true });
    }
  };
};
const LINE_API_BASE = "https://api.line.me";
class LineClient {
  channelAccessToken;
  constructor(channelAccessToken) {
    this.channelAccessToken = channelAccessToken;
  }
  // ─── Core request helper ──────────────────────────────────────────────────
  async request(method, path, body) {
    const url = `${LINE_API_BASE}${path}`;
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.channelAccessToken}`
      }
    };
    if (method !== "GET" && method !== "DELETE" && body !== void 0) {
      options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`LINE API error: ${res.status} ${res.statusText} — ${text}`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    let data;
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = void 0;
    }
    return { data, headers: res.headers };
  }
  // ─── Profile ──────────────────────────────────────────────────────────────
  async getProfile(userId) {
    const { data } = await this.request("GET", `/v2/bot/profile/${encodeURIComponent(userId)}`);
    return data;
  }
  // ─── Messaging ───────────────────────────────────────────────────────────
  async pushMessage(to, messages) {
    const body = { to, messages };
    const { data } = await this.request("POST", "/v2/bot/message/push", body);
    return data;
  }
  async multicast(to, messages, customAggregationUnits) {
    const body = { to, messages };
    if (customAggregationUnits) {
      body.customAggregationUnits = customAggregationUnits;
    }
    const { data, headers } = await this.request("POST", "/v2/bot/message/multicast", body);
    return { data, requestId: headers.get("x-line-request-id") };
  }
  async broadcast(messages) {
    const body = { messages };
    const { data, headers } = await this.request("POST", "/v2/bot/message/broadcast", body);
    return { data, requestId: headers.get("x-line-request-id") };
  }
  async replyMessage(replyToken, messages) {
    const body = { replyToken, messages };
    const { data } = await this.request("POST", "/v2/bot/message/reply", body);
    return data;
  }
  // ─── Rich Menu ────────────────────────────────────────────────────────────
  async getRichMenuList() {
    const { data } = await this.request("GET", "/v2/bot/richmenu/list");
    return data;
  }
  async createRichMenu(menu) {
    const { data } = await this.request("POST", "/v2/bot/richmenu", menu);
    return data;
  }
  async deleteRichMenu(richMenuId) {
    const { data } = await this.request("DELETE", `/v2/bot/richmenu/${encodeURIComponent(richMenuId)}`);
    return data;
  }
  async setDefaultRichMenu(richMenuId) {
    const { data } = await this.request("POST", `/v2/bot/user/all/richmenu/${encodeURIComponent(richMenuId)}`);
    return data;
  }
  async linkRichMenuToUser(userId, richMenuId) {
    const { data } = await this.request("POST", `/v2/bot/user/${encodeURIComponent(userId)}/richmenu/${encodeURIComponent(richMenuId)}`);
    return data;
  }
  async unlinkRichMenuFromUser(userId) {
    const { data } = await this.request("DELETE", `/v2/bot/user/${encodeURIComponent(userId)}/richmenu`);
    return data;
  }
  async getRichMenuIdOfUser(userId) {
    const { data } = await this.request("GET", `/v2/bot/user/${encodeURIComponent(userId)}/richmenu`);
    return data;
  }
  // ─── Helpers ──────────────────────────────────────────────────────────────
  async pushTextMessage(to, text) {
    return this.pushMessage(to, [{ type: "text", text }]);
  }
  async pushFlexMessage(to, altText, contents) {
    return this.pushMessage(to, [{ type: "flex", altText, contents }]);
  }
  // ─── Rich Menu Image Upload ─────────────────────────────────────────────
  /** Upload image to a rich menu. Accepts PNG/JPEG binary (ArrayBuffer or Uint8Array). */
  async uploadRichMenuImage(richMenuId, imageData, contentType = "image/png") {
    const url = `https://api-data.line.me/v2/bot/richmenu/${encodeURIComponent(richMenuId)}/content`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        Authorization: `Bearer ${this.channelAccessToken}`
      },
      body: imageData
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`LINE API error: ${res.status} ${res.statusText} — ${text}`);
    }
  }
  // ─── Insight API ─────────────────────────────────────────────────────────
  /**
   * Get user interaction statistics for a broadcast message.
   * Data becomes available ~3 days after sending.
   * GET only — no messages are sent.
   */
  async getMessageEventInsight(requestId) {
    const { data } = await this.request("GET", `/v2/bot/insight/message/event?requestId=${encodeURIComponent(requestId)}`);
    return data;
  }
  /**
   * Get statistics per unit for multicast messages.
   * GET only — no messages are sent.
   */
  async getUnitInsight(customAggregationUnit, from, to) {
    const params = new URLSearchParams({ customAggregationUnit, from, to });
    const { data } = await this.request("GET", `/v2/bot/insight/message/event/aggregation?${params.toString()}`);
    return data;
  }
}
async function verifySignature(channelSecret, body, signature) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(channelSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const bytes = new Uint8Array(signatureBytes);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const computedBase64 = btoa(binary);
  return computedBase64 === signature;
}
const JST_OFFSET_MS$1 = 9 * 60 * 6e4;
function jstNow() {
  return toJstString(/* @__PURE__ */ new Date());
}
function toJstString(date) {
  const jst = new Date(date.getTime() + JST_OFFSET_MS$1);
  return jst.toISOString().slice(0, -1) + "+09:00";
}
function isTimeBefore(a, b) {
  return new Date(a).getTime() <= new Date(b).getTime();
}
async function getFriends(db, opts = {}) {
  const { limit = 50, offset = 0, tagId } = opts;
  if (tagId) {
    const result2 = await db.prepare(
      `SELECT f.*
         FROM friends f
         INNER JOIN friend_tags ft ON ft.friend_id = f.id
         WHERE ft.tag_id = ?
         ORDER BY f.created_at DESC
         LIMIT ? OFFSET ?`
    ).bind(tagId, limit, offset).all();
    return result2.results;
  }
  const result = await db.prepare(
    `SELECT * FROM friends
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();
  return result.results;
}
async function getFriendByLineUserId(db, lineUserId) {
  return db.prepare(`SELECT * FROM friends WHERE line_user_id = ?`).bind(lineUserId).first();
}
async function getFriendById(db, id) {
  return db.prepare(`SELECT * FROM friends WHERE id = ?`).bind(id).first();
}
async function upsertFriend(db, input) {
  const now = jstNow();
  const existing = await getFriendByLineUserId(db, input.lineUserId);
  if (existing) {
    await db.prepare(
      `UPDATE friends
         SET display_name = ?,
             picture_url = ?,
             status_message = ?,
             is_following = 1,
             updated_at = ?
         WHERE line_user_id = ?`
    ).bind(
      "displayName" in input ? input.displayName ?? null : existing.display_name,
      "pictureUrl" in input ? input.pictureUrl ?? null : existing.picture_url,
      "statusMessage" in input ? input.statusMessage ?? null : existing.status_message,
      now,
      input.lineUserId
    ).run();
    return await getFriendByLineUserId(db, input.lineUserId);
  }
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO friends (id, line_user_id, display_name, picture_url, status_message, is_following, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  ).bind(
    id,
    input.lineUserId,
    input.displayName ?? null,
    input.pictureUrl ?? null,
    input.statusMessage ?? null,
    now,
    now
  ).run();
  return await getFriendById(db, id);
}
async function updateFriendFollowStatus(db, lineUserId, isFollowing) {
  await db.prepare(
    `UPDATE friends
       SET is_following = ?, updated_at = ?
       WHERE line_user_id = ?`
  ).bind(isFollowing ? 1 : 0, jstNow(), lineUserId).run();
}
async function getFriendCount(db) {
  const row = await db.prepare(`SELECT COUNT(*) as count FROM friends`).first();
  return row?.count ?? 0;
}
async function getTags(db) {
  const result = await db.prepare(`SELECT * FROM tags ORDER BY name ASC`).all();
  return result.results;
}
async function createTag(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  const color = input.color ?? "#3B82F6";
  await db.prepare(
    `INSERT INTO tags (id, name, color, created_at)
       VALUES (?, ?, ?, ?)`
  ).bind(id, input.name, color, now).run();
  return await db.prepare(`SELECT * FROM tags WHERE id = ?`).bind(id).first();
}
async function deleteTag(db, id) {
  await db.prepare(`DELETE FROM tags WHERE id = ?`).bind(id).run();
}
async function addTagToFriend(db, friendId, tagId) {
  const now = jstNow();
  await db.prepare(
    `INSERT OR IGNORE INTO friend_tags (friend_id, tag_id, assigned_at)
       VALUES (?, ?, ?)`
  ).bind(friendId, tagId, now).run();
}
async function removeTagFromFriend(db, friendId, tagId) {
  await db.prepare(
    `DELETE FROM friend_tags WHERE friend_id = ? AND tag_id = ?`
  ).bind(friendId, tagId).run();
}
async function getFriendTags(db, friendId) {
  const result = await db.prepare(
    `SELECT t.*
       FROM tags t
       INNER JOIN friend_tags ft ON ft.tag_id = t.id
       WHERE ft.friend_id = ?
       ORDER BY t.name ASC`
  ).bind(friendId).all();
  return result.results;
}
async function getFriendsByTag(db, tagId) {
  const result = await db.prepare(
    `SELECT f.*
       FROM friends f
       INNER JOIN friend_tags ft ON ft.friend_id = f.id
       WHERE ft.tag_id = ?
       ORDER BY f.created_at DESC`
  ).bind(tagId).all();
  return result.results;
}
async function getScenarios(db) {
  const result = await db.prepare(
    `SELECT s.*, COUNT(ss.id) as step_count
       FROM scenarios s
       LEFT JOIN scenario_steps ss ON s.id = ss.scenario_id
       GROUP BY s.id
       ORDER BY s.created_at DESC`
  ).all();
  return result.results;
}
async function getScenarioById(db, id) {
  const scenario = await db.prepare(`SELECT * FROM scenarios WHERE id = ?`).bind(id).first();
  if (!scenario) return null;
  const stepsResult = await db.prepare(
    `SELECT * FROM scenario_steps WHERE scenario_id = ? ORDER BY step_order ASC`
  ).bind(id).all();
  return { ...scenario, steps: stepsResult.results };
}
async function createScenario(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(
    `INSERT INTO scenarios (id, name, description, trigger_type, trigger_tag_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  ).bind(
    id,
    input.name,
    input.description ?? null,
    input.triggerType,
    input.triggerTagId ?? null,
    now,
    now
  ).run();
  return await db.prepare(`SELECT * FROM scenarios WHERE id = ?`).bind(id).first();
}
async function updateScenario(db, id, updates) {
  const now = jstNow();
  const fields = [];
  const values = [];
  if (updates.name !== void 0) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.description !== void 0) {
    fields.push("description = ?");
    values.push(updates.description);
  }
  if (updates.trigger_type !== void 0) {
    fields.push("trigger_type = ?");
    values.push(updates.trigger_type);
  }
  if (updates.trigger_tag_id !== void 0) {
    fields.push("trigger_tag_id = ?");
    values.push(updates.trigger_tag_id);
  }
  if (updates.is_active !== void 0) {
    fields.push("is_active = ?");
    values.push(updates.is_active);
  }
  if (fields.length === 0) {
    return db.prepare(`SELECT * FROM scenarios WHERE id = ?`).bind(id).first();
  }
  fields.push("updated_at = ?");
  values.push(now);
  values.push(id);
  await db.prepare(`UPDATE scenarios SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  return db.prepare(`SELECT * FROM scenarios WHERE id = ?`).bind(id).first();
}
async function deleteScenario(db, id) {
  await db.prepare(`DELETE FROM scenarios WHERE id = ?`).bind(id).run();
}
async function createScenarioStep(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(
    `INSERT INTO scenario_steps (id, scenario_id, step_order, delay_minutes, message_type, message_content, condition_type, condition_value, next_step_on_false, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    input.scenarioId,
    input.stepOrder,
    input.delayMinutes ?? 0,
    input.messageType,
    input.messageContent,
    input.conditionType ?? null,
    input.conditionValue ?? null,
    input.nextStepOnFalse ?? null,
    now
  ).run();
  return await db.prepare(`SELECT * FROM scenario_steps WHERE id = ?`).bind(id).first();
}
async function updateScenarioStep(db, id, updates) {
  const fields = [];
  const values = [];
  if (updates.step_order !== void 0) {
    fields.push("step_order = ?");
    values.push(updates.step_order);
  }
  if (updates.delay_minutes !== void 0) {
    fields.push("delay_minutes = ?");
    values.push(updates.delay_minutes);
  }
  if (updates.message_type !== void 0) {
    fields.push("message_type = ?");
    values.push(updates.message_type);
  }
  if (updates.message_content !== void 0) {
    fields.push("message_content = ?");
    values.push(updates.message_content);
  }
  if (updates.condition_type !== void 0) {
    fields.push("condition_type = ?");
    values.push(updates.condition_type);
  }
  if (updates.condition_value !== void 0) {
    fields.push("condition_value = ?");
    values.push(updates.condition_value);
  }
  if (updates.next_step_on_false !== void 0) {
    fields.push("next_step_on_false = ?");
    values.push(updates.next_step_on_false);
  }
  if (fields.length > 0) {
    values.push(id);
    await db.prepare(`UPDATE scenario_steps SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  }
  return db.prepare(`SELECT * FROM scenario_steps WHERE id = ?`).bind(id).first();
}
async function deleteScenarioStep(db, id) {
  await db.prepare(`DELETE FROM scenario_steps WHERE id = ?`).bind(id).run();
}
async function getScenarioSteps(db, scenarioId) {
  const result = await db.prepare(
    `SELECT * FROM scenario_steps WHERE scenario_id = ? ORDER BY step_order ASC`
  ).bind(scenarioId).all();
  return result.results;
}
async function enrollFriendInScenario(db, friendId, scenarioId) {
  const id = crypto.randomUUID();
  const now = jstNow();
  const firstStep = await db.prepare(
    `SELECT * FROM scenario_steps WHERE scenario_id = ? ORDER BY step_order ASC LIMIT 1`
  ).bind(scenarioId).first();
  if (!firstStep) {
    await db.prepare(
      `INSERT INTO friend_scenarios (id, friend_id, scenario_id, current_step_order, status, started_at, next_delivery_at, updated_at)
         VALUES (?, ?, ?, 0, 'completed', ?, NULL, ?)`
    ).bind(id, friendId, scenarioId, now, now).run();
    return await db.prepare(`SELECT * FROM friend_scenarios WHERE id = ?`).bind(id).first();
  }
  const rawDate = new Date(Date.now() + 9 * 60 * 6e4 + firstStep.delay_minutes * 6e4);
  const hours = rawDate.getUTCHours();
  if (hours < 9 || hours >= 21) {
    if (hours >= 21) rawDate.setUTCDate(rawDate.getUTCDate() + 1);
    rawDate.setUTCHours(9, 0, 0, 0);
  }
  const nextDeliveryAt = rawDate.toISOString().slice(0, -1) + "+09:00";
  await db.prepare(
    `INSERT INTO friend_scenarios (id, friend_id, scenario_id, current_step_order, status, started_at, next_delivery_at, updated_at)
       VALUES (?, ?, ?, 0, 'active', ?, ?, ?)`
  ).bind(id, friendId, scenarioId, now, nextDeliveryAt, now).run();
  return await db.prepare(`SELECT * FROM friend_scenarios WHERE id = ?`).bind(id).first();
}
async function getFriendScenariosDueForDelivery(db, now) {
  const result = await db.prepare(
    `SELECT * FROM friend_scenarios
       WHERE status = 'active'
         AND next_delivery_at IS NOT NULL`
  ).all();
  const nowMs = new Date(now).getTime();
  return result.results.filter((fs) => new Date(fs.next_delivery_at).getTime() <= nowMs).sort((a, b) => new Date(a.next_delivery_at).getTime() - new Date(b.next_delivery_at).getTime());
}
async function advanceFriendScenario(db, id, nextStepOrder, nextDeliveryAt) {
  const now = jstNow();
  await db.prepare(
    `UPDATE friend_scenarios
       SET current_step_order = ?,
           next_delivery_at = ?,
           updated_at = ?
       WHERE id = ?`
  ).bind(nextStepOrder, nextDeliveryAt ?? null, now, id).run();
}
async function completeFriendScenario(db, id) {
  const now = jstNow();
  await db.prepare(
    `UPDATE friend_scenarios
       SET status = 'completed',
           next_delivery_at = NULL,
           updated_at = ?
       WHERE id = ?`
  ).bind(now, id).run();
}
async function getBroadcasts(db, accountId) {
  let sql = `SELECT b.*,
       bi.status as insight_status,
       bi.open_rate, bi.click_rate
FROM broadcasts b
LEFT JOIN broadcast_insights bi ON b.id = bi.broadcast_id`;
  const params = [];
  if (accountId) {
    sql += ` WHERE b.line_account_id = ?`;
    params.push(accountId);
  }
  sql += ` ORDER BY b.created_at DESC`;
  const result = params.length > 0 ? await db.prepare(sql).bind(...params).all() : await db.prepare(sql).all();
  return result.results;
}
async function getBroadcastById(db, id) {
  return db.prepare(
    `SELECT b.*,
       bi.id as insight_id, bi.delivered, bi.unique_impression,
       bi.unique_click, bi.unique_media_played,
       bi.open_rate, bi.click_rate, bi.status as insight_status,
       bi.retry_count, bi.fetched_at as insight_fetched_at,
       bi.created_at as insight_created_at
FROM broadcasts b
LEFT JOIN broadcast_insights bi ON b.id = bi.broadcast_id
WHERE b.id = ?`
  ).bind(id).first();
}
async function createBroadcast(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  const initialStatus = input.scheduledAt ? "scheduled" : "draft";
  await db.prepare(
    `INSERT INTO broadcasts
         (id, title, message_type, message_content, target_type, target_tag_id, status, scheduled_at, sent_at, total_count, success_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 0, ?)`
  ).bind(
    id,
    input.title,
    input.messageType,
    input.messageContent,
    input.targetType,
    input.targetTagId ?? null,
    initialStatus,
    input.scheduledAt ?? null,
    now
  ).run();
  return await getBroadcastById(db, id);
}
async function updateBroadcast(db, id, updates) {
  const fields = [];
  const values = [];
  if (updates.title !== void 0) {
    fields.push("title = ?");
    values.push(updates.title);
  }
  if (updates.message_type !== void 0) {
    fields.push("message_type = ?");
    values.push(updates.message_type);
  }
  if (updates.message_content !== void 0) {
    fields.push("message_content = ?");
    values.push(updates.message_content);
  }
  if (updates.target_type !== void 0) {
    fields.push("target_type = ?");
    values.push(updates.target_type);
  }
  if (updates.target_tag_id !== void 0) {
    fields.push("target_tag_id = ?");
    values.push(updates.target_tag_id);
  }
  if (updates.status !== void 0) {
    fields.push("status = ?");
    values.push(updates.status);
  }
  if (updates.scheduled_at !== void 0) {
    fields.push("scheduled_at = ?");
    values.push(updates.scheduled_at);
  }
  if (fields.length > 0) {
    values.push(id);
    await db.prepare(`UPDATE broadcasts SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  }
  return getBroadcastById(db, id);
}
async function deleteBroadcast(db, id) {
  await db.prepare(`DELETE FROM broadcasts WHERE id = ?`).bind(id).run();
}
async function createBroadcastInsight(db, broadcastId) {
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO broadcast_insights (id, broadcast_id, status) VALUES (?, ?, 'pending')`
  ).bind(id, broadcastId).run();
}
async function updateBroadcastLineRequestId(db, broadcastId, lineRequestId, aggregationUnit) {
  await db.prepare(
    `UPDATE broadcasts SET line_request_id = ?, aggregation_unit = ? WHERE id = ?`
  ).bind(lineRequestId, aggregationUnit, broadcastId).run();
}
async function getPendingInsights(db) {
  const result = await db.prepare(
    `SELECT bi.id as insight_id, bi.broadcast_id, bi.retry_count,
              b.line_request_id, b.aggregation_unit, b.sent_at, b.line_account_id
       FROM broadcast_insights bi
       JOIN broadcasts b ON bi.broadcast_id = b.id
       WHERE bi.status = 'pending'
         AND b.sent_at IS NOT NULL
         AND julianday('now', '+9 hours') - julianday(b.sent_at) >= 3`
  ).all();
  return (result.results || []).map((r) => ({
    insightId: r.insight_id,
    broadcastId: r.broadcast_id,
    lineRequestId: r.line_request_id,
    aggregationUnit: r.aggregation_unit,
    sentAt: r.sent_at,
    retryCount: r.retry_count,
    lineAccountId: r.line_account_id
  }));
}
async function updateInsightResult(db, insightId, result) {
  const openRate = result.delivered && result.uniqueImpression ? result.uniqueImpression / result.delivered : null;
  const clickRate = result.delivered && result.uniqueClick ? result.uniqueClick / result.delivered : null;
  const now = new Date(Date.now() + 9 * 60 * 60 * 1e3).toISOString();
  await db.prepare(
    `UPDATE broadcast_insights
       SET delivered = ?, unique_impression = ?, unique_click = ?,
           unique_media_played = ?, open_rate = ?, click_rate = ?,
           raw_response = ?, status = 'ready', fetched_at = ?
       WHERE id = ?`
  ).bind(
    result.delivered,
    result.uniqueImpression,
    result.uniqueClick,
    result.uniqueMediaPlayed,
    openRate,
    clickRate,
    result.rawResponse,
    now,
    insightId
  ).run();
}
async function markInsightFailed(db, insightId, retryCount) {
  const newStatus = retryCount >= 2 ? "failed" : "pending";
  await db.prepare(
    `UPDATE broadcast_insights SET retry_count = ?, status = ? WHERE id = ?`
  ).bind(retryCount + 1, newStatus, insightId).run();
}
async function updateBroadcastStatus(db, id, status, counts) {
  const fields = ["status = ?"];
  const values = [status];
  if (status === "sent") {
    fields.push("sent_at = ?");
    values.push(jstNow());
  }
  if (counts?.totalCount !== void 0) {
    fields.push("total_count = ?");
    values.push(counts.totalCount);
  }
  if (counts?.successCount !== void 0) {
    fields.push("success_count = ?");
    values.push(counts.successCount);
  }
  values.push(id);
  await db.prepare(`UPDATE broadcasts SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
}
async function createUser(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(
    `INSERT INTO users (id, email, phone, external_id, display_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    input.email ?? null,
    input.phone ?? null,
    input.externalId ?? null,
    input.displayName ?? null,
    now,
    now
  ).run();
  return await getUserById(db, id);
}
async function getUserById(db, id) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first();
}
async function getUsers(db) {
  const result = await db.prepare(`SELECT * FROM users ORDER BY created_at DESC`).all();
  return result.results;
}
async function getUserByEmail(db, email) {
  return db.prepare(`SELECT * FROM users WHERE email = ?`).bind(email).first();
}
async function getUserByPhone(db, phone) {
  return db.prepare(`SELECT * FROM users WHERE phone = ?`).bind(phone).first();
}
async function updateUser(db, id, updates) {
  const fields = [];
  const values = [];
  if (updates.email !== void 0) {
    fields.push("email = ?");
    values.push(updates.email);
  }
  if (updates.phone !== void 0) {
    fields.push("phone = ?");
    values.push(updates.phone);
  }
  if (updates.external_id !== void 0) {
    fields.push("external_id = ?");
    values.push(updates.external_id);
  }
  if (updates.display_name !== void 0) {
    fields.push("display_name = ?");
    values.push(updates.display_name);
  }
  if (fields.length === 0) return getUserById(db, id);
  fields.push("updated_at = ?");
  values.push(jstNow());
  values.push(id);
  await db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  return getUserById(db, id);
}
async function deleteUser(db, id) {
  await db.prepare(`DELETE FROM users WHERE id = ?`).bind(id).run();
}
async function linkFriendToUser(db, friendId, userId) {
  await db.prepare(`UPDATE friends SET user_id = ?, updated_at = ? WHERE id = ?`).bind(userId, jstNow(), friendId).run();
}
async function getUserFriends(db, userId) {
  const result = await db.prepare(`SELECT id, line_user_id, display_name, is_following FROM friends WHERE user_id = ?`).bind(userId).all();
  return result.results;
}
async function createLineAccount(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(
    `INSERT INTO line_accounts (id, channel_id, name, channel_access_token, channel_secret, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  ).bind(id, input.channelId, input.name, input.channelAccessToken, input.channelSecret, now, now).run();
  return await getLineAccountById(db, id);
}
async function getLineAccountById(db, id) {
  return db.prepare(`SELECT * FROM line_accounts WHERE id = ?`).bind(id).first();
}
async function getLineAccounts(db) {
  const result = await db.prepare(`SELECT * FROM line_accounts ORDER BY created_at DESC`).all();
  return result.results;
}
async function getLineAccountByChannelId(db, channelId) {
  return db.prepare(`SELECT * FROM line_accounts WHERE channel_id = ?`).bind(channelId).first();
}
async function updateLineAccount(db, id, updates) {
  const fields = [];
  const values = [];
  if (updates.name !== void 0) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.channel_access_token !== void 0) {
    fields.push("channel_access_token = ?");
    values.push(updates.channel_access_token);
  }
  if (updates.channel_secret !== void 0) {
    fields.push("channel_secret = ?");
    values.push(updates.channel_secret);
  }
  if (updates.is_active !== void 0) {
    fields.push("is_active = ?");
    values.push(updates.is_active);
  }
  if (updates.token_expires_at !== void 0) {
    fields.push("token_expires_at = ?");
    values.push(updates.token_expires_at);
  }
  if (fields.length === 0) return getLineAccountById(db, id);
  fields.push("updated_at = ?");
  values.push(jstNow());
  values.push(id);
  await db.prepare(`UPDATE line_accounts SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  return getLineAccountById(db, id);
}
async function deleteLineAccount(db, id) {
  await db.prepare(`DELETE FROM line_accounts WHERE id = ?`).bind(id).run();
}
async function getConversionPoints(db) {
  const result = await db.prepare(`SELECT * FROM conversion_points ORDER BY created_at DESC`).all();
  return result.results;
}
async function getConversionPointById(db, id) {
  return db.prepare(`SELECT * FROM conversion_points WHERE id = ?`).bind(id).first();
}
async function createConversionPoint(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(
    `INSERT INTO conversion_points (id, name, event_type, value, created_at)
       VALUES (?, ?, ?, ?, ?)`
  ).bind(id, input.name, input.eventType, input.value ?? null, now).run();
  return await getConversionPointById(db, id);
}
async function deleteConversionPoint(db, id) {
  await db.prepare(`DELETE FROM conversion_points WHERE id = ?`).bind(id).run();
}
async function trackConversion(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(
    `INSERT INTO conversion_events (id, conversion_point_id, friend_id, user_id, affiliate_code, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    input.conversionPointId,
    input.friendId,
    input.userId ?? null,
    input.affiliateCode ?? null,
    input.metadata ?? null,
    now
  ).run();
  return await db.prepare(`SELECT * FROM conversion_events WHERE id = ?`).bind(id).first();
}
async function getConversionEvents(db, opts = {}) {
  const conditions = [];
  const values = [];
  if (opts.conversionPointId) {
    conditions.push("conversion_point_id = ?");
    values.push(opts.conversionPointId);
  }
  if (opts.friendId) {
    conditions.push("friend_id = ?");
    values.push(opts.friendId);
  }
  if (opts.affiliateCode) {
    conditions.push("affiliate_code = ?");
    values.push(opts.affiliateCode);
  }
  if (opts.startDate) {
    conditions.push("created_at >= ?");
    values.push(opts.startDate);
  }
  if (opts.endDate) {
    conditions.push("created_at <= ?");
    values.push(opts.endDate);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  values.push(limit, offset);
  const result = await db.prepare(
    `SELECT * FROM conversion_events ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...values).all();
  return result.results;
}
async function getConversionReport(db, opts = {}) {
  const conditions = [];
  const values = [];
  if (opts.startDate) {
    conditions.push("ce.created_at >= ?");
    values.push(opts.startDate);
  }
  if (opts.endDate) {
    conditions.push("ce.created_at <= ?");
    values.push(opts.endDate);
  }
  const result = await db.prepare(
    `SELECT
         cp.id as conversion_point_id,
         cp.name as conversion_point_name,
         cp.event_type,
         COUNT(ce.id) as total_count,
         COALESCE(SUM(cp.value), 0) as total_value
       FROM conversion_points cp
       LEFT JOIN conversion_events ce ON ce.conversion_point_id = cp.id ${conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : ""}
       GROUP BY cp.id
       ORDER BY total_count DESC`
  ).bind(...values).all();
  return result.results.map((r) => ({
    conversionPointId: r.conversion_point_id,
    conversionPointName: r.conversion_point_name,
    eventType: r.event_type,
    totalCount: r.total_count,
    totalValue: r.total_value
  }));
}
async function getAffiliates(db) {
  const result = await db.prepare(`SELECT * FROM affiliates ORDER BY created_at DESC`).all();
  return result.results;
}
async function getAffiliateById(db, id) {
  return db.prepare(`SELECT * FROM affiliates WHERE id = ?`).bind(id).first();
}
async function getAffiliateByCode(db, code) {
  return db.prepare(`SELECT * FROM affiliates WHERE code = ?`).bind(code).first();
}
async function createAffiliate(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(
    `INSERT INTO affiliates (id, name, code, commission_rate, is_active, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`
  ).bind(id, input.name, input.code, input.commissionRate ?? 0, now).run();
  return await getAffiliateById(db, id);
}
async function updateAffiliate(db, id, updates) {
  const fields = [];
  const values = [];
  if (updates.name !== void 0) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.commission_rate !== void 0) {
    fields.push("commission_rate = ?");
    values.push(updates.commission_rate);
  }
  if (updates.is_active !== void 0) {
    fields.push("is_active = ?");
    values.push(updates.is_active);
  }
  if (fields.length === 0) return getAffiliateById(db, id);
  values.push(id);
  await db.prepare(`UPDATE affiliates SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  return getAffiliateById(db, id);
}
async function deleteAffiliate(db, id) {
  await db.prepare(`DELETE FROM affiliates WHERE id = ?`).bind(id).run();
}
async function recordAffiliateClick(db, affiliateId, url, ipAddress) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(
    `INSERT INTO affiliate_clicks (id, affiliate_id, url, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?)`
  ).bind(id, affiliateId, url ?? null, ipAddress ?? null, now).run();
  return await db.prepare(`SELECT * FROM affiliate_clicks WHERE id = ?`).bind(id).first();
}
async function getAffiliateReport(db, affiliateId, opts = {}) {
  const conditions = [];
  const values = [];
  if (affiliateId) {
    conditions.push("a.id = ?");
    values.push(affiliateId);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  let clickDateCond = "";
  let cvDateCond = "";
  const clickDateBinds = [];
  const cvDateBinds = [];
  if (opts.startDate) {
    clickDateCond += ` AND ac.created_at >= ?`;
    cvDateCond += ` AND ce.created_at >= ?`;
    clickDateBinds.push(opts.startDate);
    cvDateBinds.push(opts.startDate);
  }
  if (opts.endDate) {
    clickDateCond += ` AND ac.created_at <= ?`;
    cvDateCond += ` AND ce.created_at <= ?`;
    clickDateBinds.push(opts.endDate);
    cvDateBinds.push(opts.endDate);
  }
  const dateBindsForRevenue = [...cvDateBinds];
  const allBinds = [
    ...clickDateBinds,
    // for total_clicks subquery
    ...cvDateBinds,
    // for total_conversions subquery
    ...dateBindsForRevenue,
    // for total_revenue subquery
    ...values
    // for the outer WHERE clause
  ];
  const result = await db.prepare(
    `SELECT
         a.id as affiliate_id,
         a.name as affiliate_name,
         a.code,
         a.commission_rate,
         (SELECT COUNT(*) FROM affiliate_clicks ac WHERE ac.affiliate_id = a.id${clickDateCond}) as total_clicks,
         (SELECT COUNT(*) FROM conversion_events ce WHERE ce.affiliate_code = a.code${cvDateCond}) as total_conversions,
         (SELECT COALESCE(SUM(cp.value), 0) FROM conversion_events ce
          JOIN conversion_points cp ON cp.id = ce.conversion_point_id
          WHERE ce.affiliate_code = a.code${cvDateCond}) as total_revenue
       FROM affiliates a
       ${where}
       ORDER BY total_conversions DESC`
  ).bind(...allBinds).all();
  return result.results.map((r) => ({
    affiliateId: r.affiliate_id,
    affiliateName: r.affiliate_name,
    code: r.code,
    commissionRate: r.commission_rate,
    totalClicks: r.total_clicks,
    totalConversions: r.total_conversions,
    totalRevenue: r.total_revenue
  }));
}
async function getIncomingWebhooks(db) {
  const result = await db.prepare(`SELECT * FROM incoming_webhooks ORDER BY created_at DESC`).all();
  return result.results;
}
async function getIncomingWebhookById(db, id) {
  return db.prepare(`SELECT * FROM incoming_webhooks WHERE id = ?`).bind(id).first();
}
async function createIncomingWebhook(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO incoming_webhooks (id, name, source_type, secret, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, input.name, input.sourceType ?? "custom", input.secret ?? null, now, now).run();
  return await getIncomingWebhookById(db, id);
}
async function updateIncomingWebhook(db, id, updates) {
  const sets = [];
  const values = [];
  if (updates.name !== void 0) {
    sets.push("name = ?");
    values.push(updates.name);
  }
  if (updates.sourceType !== void 0) {
    sets.push("source_type = ?");
    values.push(updates.sourceType);
  }
  if (updates.secret !== void 0) {
    sets.push("secret = ?");
    values.push(updates.secret);
  }
  if (updates.isActive !== void 0) {
    sets.push("is_active = ?");
    values.push(updates.isActive ? 1 : 0);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  values.push(jstNow());
  values.push(id);
  await db.prepare(`UPDATE incoming_webhooks SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
}
async function deleteIncomingWebhook(db, id) {
  await db.prepare(`DELETE FROM incoming_webhooks WHERE id = ?`).bind(id).run();
}
async function getOutgoingWebhooks(db) {
  const result = await db.prepare(`SELECT * FROM outgoing_webhooks ORDER BY created_at DESC`).all();
  return result.results;
}
async function getOutgoingWebhookById(db, id) {
  return db.prepare(`SELECT * FROM outgoing_webhooks WHERE id = ?`).bind(id).first();
}
async function createOutgoingWebhook(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO outgoing_webhooks (id, name, url, event_types, secret, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id, input.name, input.url, JSON.stringify(input.eventTypes), input.secret ?? null, now, now).run();
  return await getOutgoingWebhookById(db, id);
}
async function updateOutgoingWebhook(db, id, updates) {
  const sets = [];
  const values = [];
  if (updates.name !== void 0) {
    sets.push("name = ?");
    values.push(updates.name);
  }
  if (updates.url !== void 0) {
    sets.push("url = ?");
    values.push(updates.url);
  }
  if (updates.eventTypes !== void 0) {
    sets.push("event_types = ?");
    values.push(JSON.stringify(updates.eventTypes));
  }
  if (updates.secret !== void 0) {
    sets.push("secret = ?");
    values.push(updates.secret);
  }
  if (updates.isActive !== void 0) {
    sets.push("is_active = ?");
    values.push(updates.isActive ? 1 : 0);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  values.push(jstNow());
  values.push(id);
  await db.prepare(`UPDATE outgoing_webhooks SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
}
async function deleteOutgoingWebhook(db, id) {
  await db.prepare(`DELETE FROM outgoing_webhooks WHERE id = ?`).bind(id).run();
}
async function getActiveOutgoingWebhooksByEvent(db, eventType) {
  const all = await db.prepare(`SELECT * FROM outgoing_webhooks WHERE is_active = 1`).all();
  return all.results.filter((w) => {
    const types = JSON.parse(w.event_types);
    return types.includes(eventType) || types.includes("*");
  });
}
async function getCalendarConnections(db) {
  const result = await db.prepare(`SELECT * FROM google_calendar_connections ORDER BY created_at DESC`).all();
  return result.results;
}
async function getCalendarConnectionById(db, id) {
  return db.prepare(`SELECT * FROM google_calendar_connections WHERE id = ?`).bind(id).first();
}
async function createCalendarConnection(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO google_calendar_connections (id, calendar_id, auth_type, access_token, refresh_token, api_key, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, input.calendarId, input.authType, input.accessToken ?? null, input.refreshToken ?? null, input.apiKey ?? null, now, now).run();
  return await getCalendarConnectionById(db, id);
}
async function deleteCalendarConnection(db, id) {
  await db.prepare(`DELETE FROM google_calendar_connections WHERE id = ?`).bind(id).run();
}
async function getCalendarBookings(db, opts = {}) {
  if (opts.friendId) {
    const result2 = await db.prepare(`SELECT * FROM calendar_bookings WHERE friend_id = ? ORDER BY start_at ASC`).bind(opts.friendId).all();
    return result2.results;
  }
  if (opts.connectionId) {
    const result2 = await db.prepare(`SELECT * FROM calendar_bookings WHERE connection_id = ? ORDER BY start_at ASC`).bind(opts.connectionId).all();
    return result2.results;
  }
  const result = await db.prepare(`SELECT * FROM calendar_bookings ORDER BY start_at ASC`).all();
  return result.results;
}
async function getCalendarBookingById(db, id) {
  return db.prepare(`SELECT * FROM calendar_bookings WHERE id = ?`).bind(id).first();
}
async function createCalendarBooking(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO calendar_bookings (id, connection_id, friend_id, event_id, title, start_at, end_at, metadata, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, input.connectionId, input.friendId ?? null, input.eventId ?? null, input.title, input.startAt, input.endAt, input.metadata ?? null, now, now).run();
  return await getCalendarBookingById(db, id);
}
async function updateCalendarBookingStatus(db, id, status) {
  await db.prepare(`UPDATE calendar_bookings SET status = ?, updated_at = ? WHERE id = ?`).bind(status, jstNow(), id).run();
}
async function updateCalendarBookingEventId(db, id, eventId) {
  await db.prepare(`UPDATE calendar_bookings SET event_id = ?, updated_at = ? WHERE id = ?`).bind(eventId, jstNow(), id).run();
}
async function getBookingsInRange(db, connectionId, startAt, endAt) {
  const result = await db.prepare(`SELECT * FROM calendar_bookings WHERE connection_id = ? AND start_at >= ? AND end_at <= ? AND status != 'cancelled' ORDER BY start_at ASC`).bind(connectionId, startAt, endAt).all();
  return result.results;
}
async function getReminders(db) {
  const result = await db.prepare(`SELECT * FROM reminders ORDER BY created_at DESC`).all();
  return result.results;
}
async function getReminderById(db, id) {
  return db.prepare(`SELECT * FROM reminders WHERE id = ?`).bind(id).first();
}
async function createReminder(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO reminders (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`).bind(id, input.name, input.description ?? null, now, now).run();
  return await getReminderById(db, id);
}
async function updateReminder(db, id, updates) {
  const sets = [];
  const values = [];
  if (updates.name !== void 0) {
    sets.push("name = ?");
    values.push(updates.name);
  }
  if (updates.description !== void 0) {
    sets.push("description = ?");
    values.push(updates.description);
  }
  if (updates.isActive !== void 0) {
    sets.push("is_active = ?");
    values.push(updates.isActive ? 1 : 0);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  values.push(jstNow());
  values.push(id);
  await db.prepare(`UPDATE reminders SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
}
async function deleteReminder(db, id) {
  await db.prepare(`DELETE FROM reminders WHERE id = ?`).bind(id).run();
}
async function getReminderSteps(db, reminderId) {
  const result = await db.prepare(`SELECT * FROM reminder_steps WHERE reminder_id = ? ORDER BY offset_minutes ASC`).bind(reminderId).all();
  return result.results;
}
async function createReminderStep(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO reminder_steps (id, reminder_id, offset_minutes, message_type, message_content, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, input.reminderId, input.offsetMinutes, input.messageType, input.messageContent, now).run();
  return await db.prepare(`SELECT * FROM reminder_steps WHERE id = ?`).bind(id).first();
}
async function deleteReminderStep(db, id) {
  await db.prepare(`DELETE FROM reminder_steps WHERE id = ?`).bind(id).run();
}
async function enrollFriendInReminder(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO friend_reminders (id, friend_id, reminder_id, target_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, input.friendId, input.reminderId, input.targetDate, now, now).run();
  return await db.prepare(`SELECT * FROM friend_reminders WHERE id = ?`).bind(id).first();
}
async function getFriendReminders(db, friendId) {
  const result = await db.prepare(`SELECT * FROM friend_reminders WHERE friend_id = ? ORDER BY target_date ASC`).bind(friendId).all();
  return result.results;
}
async function cancelFriendReminder(db, id) {
  await db.prepare(`UPDATE friend_reminders SET status = 'cancelled', updated_at = ? WHERE id = ?`).bind(jstNow(), id).run();
}
async function getDueReminderDeliveries(db, now) {
  const activeReminders = await db.prepare(`SELECT fr.* FROM friend_reminders fr
              INNER JOIN reminders r ON r.id = fr.reminder_id
              WHERE fr.status = 'active' AND r.is_active = 1`).all();
  const results = [];
  for (const fr of activeReminders.results) {
    const steps = await getReminderSteps(db, fr.reminder_id);
    const delivered = await db.prepare(`SELECT reminder_step_id FROM friend_reminder_deliveries WHERE friend_reminder_id = ?`).bind(fr.id).all();
    const deliveredIds = new Set(delivered.results.map((d) => d.reminder_step_id));
    const dueSteps = steps.filter((step) => {
      if (deliveredIds.has(step.id)) return false;
      const targetTime = new Date(fr.target_date).getTime() + step.offset_minutes * 6e4;
      return targetTime <= new Date(now).getTime();
    });
    if (dueSteps.length > 0) {
      results.push({ ...fr, steps: dueSteps });
    }
  }
  return results;
}
async function markReminderStepDelivered(db, friendReminderId, reminderStepId) {
  const id = crypto.randomUUID();
  await db.prepare(`INSERT OR IGNORE INTO friend_reminder_deliveries (id, friend_reminder_id, reminder_step_id) VALUES (?, ?, ?)`).bind(id, friendReminderId, reminderStepId).run();
}
async function completeReminderIfDone(db, friendReminderId, reminderId) {
  const totalSteps = await db.prepare(`SELECT COUNT(*) as count FROM reminder_steps WHERE reminder_id = ?`).bind(reminderId).first();
  const deliveredSteps = await db.prepare(`SELECT COUNT(*) as count FROM friend_reminder_deliveries WHERE friend_reminder_id = ?`).bind(friendReminderId).first();
  if (totalSteps && deliveredSteps && deliveredSteps.count >= totalSteps.count) {
    await db.prepare(`UPDATE friend_reminders SET status = 'completed', updated_at = ? WHERE id = ?`).bind(jstNow(), friendReminderId).run();
  }
}
async function getScoringRules(db) {
  const result = await db.prepare(`SELECT * FROM scoring_rules ORDER BY created_at DESC`).all();
  return result.results;
}
async function getScoringRuleById(db, id) {
  return db.prepare(`SELECT * FROM scoring_rules WHERE id = ?`).bind(id).first();
}
async function createScoringRule(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO scoring_rules (id, name, event_type, score_value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, input.name, input.eventType, input.scoreValue, now, now).run();
  return await getScoringRuleById(db, id);
}
async function updateScoringRule(db, id, updates) {
  const sets = [];
  const values = [];
  if (updates.name !== void 0) {
    sets.push("name = ?");
    values.push(updates.name);
  }
  if (updates.eventType !== void 0) {
    sets.push("event_type = ?");
    values.push(updates.eventType);
  }
  if (updates.scoreValue !== void 0) {
    sets.push("score_value = ?");
    values.push(updates.scoreValue);
  }
  if (updates.isActive !== void 0) {
    sets.push("is_active = ?");
    values.push(updates.isActive ? 1 : 0);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  values.push(jstNow());
  values.push(id);
  await db.prepare(`UPDATE scoring_rules SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
}
async function deleteScoringRule(db, id) {
  await db.prepare(`DELETE FROM scoring_rules WHERE id = ?`).bind(id).run();
}
async function addScore(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO friend_scores (id, friend_id, scoring_rule_id, score_change, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, input.friendId, input.scoringRuleId ?? null, input.scoreChange, input.reason ?? null, now).run();
  await db.prepare(`UPDATE friends SET score = score + ?, updated_at = ? WHERE id = ?`).bind(input.scoreChange, now, input.friendId).run();
}
async function getFriendScore(db, friendId) {
  const row = await db.prepare(`SELECT score FROM friends WHERE id = ?`).bind(friendId).first();
  return row?.score ?? 0;
}
async function getFriendScoreHistory(db, friendId) {
  const result = await db.prepare(`SELECT * FROM friend_scores WHERE friend_id = ? ORDER BY created_at DESC`).bind(friendId).all();
  return result.results;
}
async function getActiveRulesByEvent(db, eventType) {
  const result = await db.prepare(`SELECT * FROM scoring_rules WHERE event_type = ? AND is_active = 1`).bind(eventType).all();
  return result.results;
}
async function applyScoring(db, friendId, eventType) {
  const rules = await getActiveRulesByEvent(db, eventType);
  let totalChange = 0;
  for (const rule of rules) {
    await addScore(db, {
      friendId,
      scoringRuleId: rule.id,
      scoreChange: rule.score_value,
      reason: `${eventType} → ${rule.name}`
    });
    totalChange += rule.score_value;
  }
  return totalChange;
}
async function getTemplates(db, category) {
  if (category) {
    const result2 = await db.prepare(`SELECT * FROM templates WHERE category = ? ORDER BY created_at DESC`).bind(category).all();
    return result2.results;
  }
  const result = await db.prepare(`SELECT * FROM templates ORDER BY created_at DESC`).all();
  return result.results;
}
async function getTemplateById(db, id) {
  return db.prepare(`SELECT * FROM templates WHERE id = ?`).bind(id).first();
}
async function createTemplate(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO templates (id, name, category, message_type, message_content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id, input.name, input.category ?? "general", input.messageType, input.messageContent, now, now).run();
  return await getTemplateById(db, id);
}
async function updateTemplate(db, id, updates) {
  const sets = [];
  const values = [];
  if (updates.name !== void 0) {
    sets.push("name = ?");
    values.push(updates.name);
  }
  if (updates.category !== void 0) {
    sets.push("category = ?");
    values.push(updates.category);
  }
  if (updates.messageType !== void 0) {
    sets.push("message_type = ?");
    values.push(updates.messageType);
  }
  if (updates.messageContent !== void 0) {
    sets.push("message_content = ?");
    values.push(updates.messageContent);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  values.push(jstNow());
  values.push(id);
  await db.prepare(`UPDATE templates SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
}
async function deleteTemplate(db, id) {
  await db.prepare(`DELETE FROM templates WHERE id = ?`).bind(id).run();
}
async function getOperators(db) {
  const result = await db.prepare(`SELECT * FROM operators ORDER BY created_at DESC`).all();
  return result.results;
}
async function getOperatorById(db, id) {
  return db.prepare(`SELECT * FROM operators WHERE id = ?`).bind(id).first();
}
async function createOperator(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO operators (id, name, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, input.name, input.email, input.role ?? "operator", now, now).run();
  return await getOperatorById(db, id);
}
async function updateOperator(db, id, updates) {
  const sets = [];
  const values = [];
  if (updates.name !== void 0) {
    sets.push("name = ?");
    values.push(updates.name);
  }
  if (updates.email !== void 0) {
    sets.push("email = ?");
    values.push(updates.email);
  }
  if (updates.role !== void 0) {
    sets.push("role = ?");
    values.push(updates.role);
  }
  if (updates.isActive !== void 0) {
    sets.push("is_active = ?");
    values.push(updates.isActive ? 1 : 0);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  values.push(jstNow());
  values.push(id);
  await db.prepare(`UPDATE operators SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
}
async function deleteOperator(db, id) {
  await db.prepare(`DELETE FROM operators WHERE id = ?`).bind(id).run();
}
async function getChats(db, opts = {}) {
  if (opts.status && opts.operatorId) {
    const result2 = await db.prepare(`SELECT * FROM chats WHERE status = ? AND operator_id = ? ORDER BY last_message_at DESC`).bind(opts.status, opts.operatorId).all();
    return result2.results;
  }
  if (opts.status) {
    const result2 = await db.prepare(`SELECT * FROM chats WHERE status = ? ORDER BY last_message_at DESC`).bind(opts.status).all();
    return result2.results;
  }
  if (opts.operatorId) {
    const result2 = await db.prepare(`SELECT * FROM chats WHERE operator_id = ? ORDER BY last_message_at DESC`).bind(opts.operatorId).all();
    return result2.results;
  }
  const result = await db.prepare(`SELECT * FROM chats ORDER BY last_message_at DESC`).all();
  return result.results;
}
async function getChatById(db, id) {
  return db.prepare(`SELECT * FROM chats WHERE id = ?`).bind(id).first();
}
async function getChatByFriendId(db, friendId) {
  return db.prepare(`SELECT * FROM chats WHERE friend_id = ? ORDER BY created_at DESC LIMIT 1`).bind(friendId).first();
}
async function createChat(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO chats (id, friend_id, operator_id, last_message_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, input.friendId, input.operatorId ?? null, now, now, now).run();
  return await getChatById(db, id);
}
async function updateChat(db, id, updates) {
  const sets = [];
  const values = [];
  if (updates.operatorId !== void 0) {
    sets.push("operator_id = ?");
    values.push(updates.operatorId);
  }
  if (updates.status !== void 0) {
    sets.push("status = ?");
    values.push(updates.status);
  }
  if (updates.notes !== void 0) {
    sets.push("notes = ?");
    values.push(updates.notes);
  }
  if (updates.lastMessageAt !== void 0) {
    sets.push("last_message_at = ?");
    values.push(updates.lastMessageAt);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  values.push(jstNow());
  values.push(id);
  await db.prepare(`UPDATE chats SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
}
async function upsertChatOnMessage(db, friendId) {
  const existing = await getChatByFriendId(db, friendId);
  const now = jstNow();
  if (existing) {
    const newStatus = existing.status === "resolved" ? "unread" : existing.status;
    await updateChat(db, existing.id, { status: newStatus, lastMessageAt: now });
    return await getChatById(db, existing.id);
  }
  return createChat(db, { friendId });
}
async function getNotificationRules(db) {
  const result = await db.prepare(`SELECT * FROM notification_rules ORDER BY created_at DESC`).all();
  return result.results;
}
async function getNotificationRuleById(db, id) {
  return db.prepare(`SELECT * FROM notification_rules WHERE id = ?`).bind(id).first();
}
async function createNotificationRule(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO notification_rules (id, name, event_type, conditions, channels, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id, input.name, input.eventType, JSON.stringify(input.conditions ?? {}), JSON.stringify(input.channels ?? ["dashboard"]), now, now).run();
  return await getNotificationRuleById(db, id);
}
async function updateNotificationRule(db, id, updates) {
  const sets = [];
  const values = [];
  if (updates.name !== void 0) {
    sets.push("name = ?");
    values.push(updates.name);
  }
  if (updates.eventType !== void 0) {
    sets.push("event_type = ?");
    values.push(updates.eventType);
  }
  if (updates.conditions !== void 0) {
    sets.push("conditions = ?");
    values.push(JSON.stringify(updates.conditions));
  }
  if (updates.channels !== void 0) {
    sets.push("channels = ?");
    values.push(JSON.stringify(updates.channels));
  }
  if (updates.isActive !== void 0) {
    sets.push("is_active = ?");
    values.push(updates.isActive ? 1 : 0);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  values.push(jstNow());
  values.push(id);
  await db.prepare(`UPDATE notification_rules SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
}
async function deleteNotificationRule(db, id) {
  await db.prepare(`DELETE FROM notification_rules WHERE id = ?`).bind(id).run();
}
async function getNotifications(db, opts = {}) {
  const limit = opts.limit ?? 100;
  if (opts.status) {
    const result2 = await db.prepare(`SELECT * FROM notifications WHERE status = ? ORDER BY created_at DESC LIMIT ?`).bind(opts.status, limit).all();
    return result2.results;
  }
  const result = await db.prepare(`SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?`).bind(limit).all();
  return result.results;
}
async function createNotification(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO notifications (id, rule_id, event_type, title, body, channel, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, input.ruleId ?? null, input.eventType, input.title, input.body, input.channel, input.metadata ?? null, now).run();
  return await db.prepare(`SELECT * FROM notifications WHERE id = ?`).bind(id).first();
}
async function updateNotificationStatus(db, id, status) {
  await db.prepare(`UPDATE notifications SET status = ? WHERE id = ?`).bind(status, id).run();
}
async function getActiveNotificationRulesByEvent(db, eventType) {
  const result = await db.prepare(`SELECT * FROM notification_rules WHERE event_type = ? AND is_active = 1`).bind(eventType).all();
  return result.results;
}
async function getStripeEvents(db, opts = {}) {
  const limit = opts.limit ?? 100;
  if (opts.friendId) {
    const result2 = await db.prepare(`SELECT * FROM stripe_events WHERE friend_id = ? ORDER BY processed_at DESC LIMIT ?`).bind(opts.friendId, limit).all();
    return result2.results;
  }
  if (opts.eventType) {
    const result2 = await db.prepare(`SELECT * FROM stripe_events WHERE event_type = ? ORDER BY processed_at DESC LIMIT ?`).bind(opts.eventType, limit).all();
    return result2.results;
  }
  const result = await db.prepare(`SELECT * FROM stripe_events ORDER BY processed_at DESC LIMIT ?`).bind(limit).all();
  return result.results;
}
async function getStripeEventByStripeId(db, stripeEventId) {
  return db.prepare(`SELECT * FROM stripe_events WHERE stripe_event_id = ?`).bind(stripeEventId).first();
}
async function createStripeEvent(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO stripe_events (id, stripe_event_id, event_type, friend_id, amount, currency, metadata, processed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, input.stripeEventId, input.eventType, input.friendId ?? null, input.amount ?? null, input.currency ?? null, input.metadata ?? null, now).run();
  return await db.prepare(`SELECT * FROM stripe_events WHERE id = ?`).bind(id).first();
}
async function getAccountHealthLogs(db, lineAccountId, limit = 50) {
  const result = await db.prepare(`SELECT * FROM account_health_logs WHERE line_account_id = ? ORDER BY created_at DESC LIMIT ?`).bind(lineAccountId, limit).all();
  return result.results;
}
async function createAccountHealthLog(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO account_health_logs (id, line_account_id, error_code, error_count, check_period, risk_level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id, input.lineAccountId, input.errorCode ?? null, input.errorCount, input.checkPeriod, input.riskLevel, now).run();
  return await db.prepare(`SELECT * FROM account_health_logs WHERE id = ?`).bind(id).first();
}
async function getLatestRiskLevel(db, lineAccountId) {
  const row = await db.prepare(`SELECT risk_level FROM account_health_logs WHERE line_account_id = ? ORDER BY created_at DESC LIMIT 1`).bind(lineAccountId).first();
  return row?.risk_level ?? "normal";
}
async function getAccountMigrations(db) {
  const result = await db.prepare(`SELECT * FROM account_migrations ORDER BY created_at DESC`).all();
  return result.results;
}
async function getAccountMigrationById(db, id) {
  return db.prepare(`SELECT * FROM account_migrations WHERE id = ?`).bind(id).first();
}
async function createAccountMigration(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO account_migrations (id, from_account_id, to_account_id, total_count, created_at) VALUES (?, ?, ?, ?, ?)`).bind(id, input.fromAccountId, input.toAccountId, input.totalCount, now).run();
  return await getAccountMigrationById(db, id);
}
async function updateAccountMigration(db, id, updates) {
  const sets = [];
  const values = [];
  if (updates.status !== void 0) {
    sets.push("status = ?");
    values.push(updates.status);
  }
  if (updates.migratedCount !== void 0) {
    sets.push("migrated_count = ?");
    values.push(updates.migratedCount);
  }
  if (updates.completedAt !== void 0) {
    sets.push("completed_at = ?");
    values.push(updates.completedAt);
  }
  if (sets.length === 0) return;
  values.push(id);
  await db.prepare(`UPDATE account_migrations SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
}
async function getAutomations(db) {
  const result = await db.prepare(`SELECT * FROM automations ORDER BY priority DESC, created_at DESC`).all();
  return result.results;
}
async function getAutomationById(db, id) {
  return db.prepare(`SELECT * FROM automations WHERE id = ?`).bind(id).first();
}
async function createAutomation(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO automations (id, name, description, event_type, conditions, actions, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, input.name, input.description ?? null, input.eventType, JSON.stringify(input.conditions ?? {}), JSON.stringify(input.actions), input.priority ?? 0, now, now).run();
  return await getAutomationById(db, id);
}
async function updateAutomation(db, id, updates) {
  const sets = [];
  const values = [];
  if (updates.name !== void 0) {
    sets.push("name = ?");
    values.push(updates.name);
  }
  if (updates.description !== void 0) {
    sets.push("description = ?");
    values.push(updates.description);
  }
  if (updates.eventType !== void 0) {
    sets.push("event_type = ?");
    values.push(updates.eventType);
  }
  if (updates.conditions !== void 0) {
    sets.push("conditions = ?");
    values.push(JSON.stringify(updates.conditions));
  }
  if (updates.actions !== void 0) {
    sets.push("actions = ?");
    values.push(JSON.stringify(updates.actions));
  }
  if (updates.isActive !== void 0) {
    sets.push("is_active = ?");
    values.push(updates.isActive ? 1 : 0);
  }
  if (updates.priority !== void 0) {
    sets.push("priority = ?");
    values.push(updates.priority);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  values.push(jstNow());
  values.push(id);
  await db.prepare(`UPDATE automations SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
}
async function deleteAutomation(db, id) {
  await db.prepare(`DELETE FROM automations WHERE id = ?`).bind(id).run();
}
async function getAutomationLogs(db, automationId, limit = 100) {
  if (automationId) {
    const result2 = await db.prepare(`SELECT * FROM automation_logs WHERE automation_id = ? ORDER BY created_at DESC LIMIT ?`).bind(automationId, limit).all();
    return result2.results;
  }
  const result = await db.prepare(`SELECT * FROM automation_logs ORDER BY created_at DESC LIMIT ?`).bind(limit).all();
  return result.results;
}
async function createAutomationLog(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(`INSERT INTO automation_logs (id, automation_id, friend_id, event_data, actions_result, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id, input.automationId, input.friendId ?? null, input.eventData ?? null, input.actionsResult ?? null, input.status, now).run();
}
async function getActiveAutomationsByEvent(db, eventType) {
  const result = await db.prepare(`SELECT * FROM automations WHERE event_type = ? AND is_active = 1 ORDER BY priority DESC`).bind(eventType).all();
  return result.results;
}
async function getEntryRoutes(db) {
  const result = await db.prepare(`SELECT * FROM entry_routes ORDER BY created_at DESC`).all();
  return result.results;
}
async function getEntryRouteByRefCode(db, refCode) {
  return db.prepare(`SELECT * FROM entry_routes WHERE ref_code = ? AND is_active = 1`).bind(refCode).first();
}
async function createEntryRoute(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  const isActive = input.isActive !== false ? 1 : 0;
  await db.prepare(
    `INSERT INTO entry_routes
         (id, ref_code, name, tag_id, scenario_id, redirect_url, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    input.refCode,
    input.name,
    input.tagId ?? null,
    input.scenarioId ?? null,
    input.redirectUrl ?? null,
    isActive,
    now,
    now
  ).run();
  return await db.prepare(`SELECT * FROM entry_routes WHERE id = ?`).bind(id).first();
}
async function updateEntryRoute(db, id, input) {
  const now = jstNow();
  const fields = ["updated_at = ?"];
  const values = [now];
  if (input.name !== void 0) {
    fields.push("name = ?");
    values.push(input.name);
  }
  if (input.refCode !== void 0) {
    fields.push("ref_code = ?");
    values.push(input.refCode);
  }
  if (input.tagId !== void 0) {
    fields.push("tag_id = ?");
    values.push(input.tagId ?? null);
  }
  if (input.scenarioId !== void 0) {
    fields.push("scenario_id = ?");
    values.push(input.scenarioId ?? null);
  }
  if (input.redirectUrl !== void 0) {
    fields.push("redirect_url = ?");
    values.push(input.redirectUrl ?? null);
  }
  if (input.isActive !== void 0) {
    fields.push("is_active = ?");
    values.push(input.isActive ? 1 : 0);
  }
  values.push(id);
  await db.prepare(`UPDATE entry_routes SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  return db.prepare(`SELECT * FROM entry_routes WHERE id = ?`).bind(id).first();
}
async function deleteEntryRoute(db, id) {
  await db.prepare(`DELETE FROM entry_routes WHERE id = ?`).bind(id).run();
}
async function recordRefTracking(db, opts) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(
    `INSERT INTO ref_tracking
       (id, ref_code, friend_id, entry_route_id, source_url,
        fbclid, gclid, twclid, ttclid, utm_source, utm_medium, utm_campaign,
        user_agent, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    opts.refCode,
    opts.friendId ?? null,
    opts.entryRouteId ?? null,
    opts.sourceUrl ?? null,
    opts.fbclid ?? null,
    opts.gclid ?? null,
    opts.twclid ?? null,
    opts.ttclid ?? null,
    opts.utmSource ?? null,
    opts.utmMedium ?? null,
    opts.utmCampaign ?? null,
    opts.userAgent ?? null,
    opts.ipAddress ?? null,
    now
  ).run();
  return await db.prepare(`SELECT * FROM ref_tracking WHERE id = ?`).bind(id).first();
}
async function getRefTrackingWithClickIds(db, friendId) {
  return db.prepare(
    `SELECT * FROM ref_tracking
       WHERE friend_id = ?
       AND (fbclid IS NOT NULL OR gclid IS NOT NULL OR twclid IS NOT NULL OR ttclid IS NOT NULL)
       ORDER BY created_at DESC
       LIMIT 1`
  ).bind(friendId).first();
}
async function getRefTrackingByFriend(db, friendId) {
  const result = await db.prepare(`SELECT * FROM ref_tracking WHERE friend_id = ? ORDER BY created_at DESC`).bind(friendId).all();
  return result.results;
}
async function getRefTrackingStats(db, refCode) {
  const row = await db.prepare(
    `SELECT ref_code, COUNT(*) as count FROM ref_tracking WHERE ref_code = ? GROUP BY ref_code`
  ).bind(refCode).first();
  return row ?? { ref_code: refCode, count: 0 };
}
async function getTrackedLinks(db) {
  const result = await db.prepare(`SELECT * FROM tracked_links ORDER BY created_at DESC`).all();
  return result.results;
}
async function getTrackedLinkById(db, id) {
  return db.prepare(`SELECT * FROM tracked_links WHERE id = ?`).bind(id).first();
}
async function createTrackedLink(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(
    `INSERT INTO tracked_links (id, name, original_url, tag_id, scenario_id, is_active, click_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)`
  ).bind(id, input.name, input.originalUrl, input.tagId ?? null, input.scenarioId ?? null, now, now).run();
  return await getTrackedLinkById(db, id);
}
async function deleteTrackedLink(db, id) {
  await db.prepare(`DELETE FROM tracked_links WHERE id = ?`).bind(id).run();
}
async function recordLinkClick(db, trackedLinkId, friendId) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(
    `INSERT INTO link_clicks (id, tracked_link_id, friend_id, clicked_at)
       VALUES (?, ?, ?, ?)`
  ).bind(id, trackedLinkId, friendId ?? null, now).run();
  await db.prepare(
    `UPDATE tracked_links SET click_count = click_count + 1, updated_at = ? WHERE id = ?`
  ).bind(now, trackedLinkId).run();
  return await db.prepare(`SELECT * FROM link_clicks WHERE id = ?`).bind(id).first();
}
async function getLinkClicks(db, trackedLinkId) {
  const result = await db.prepare(
    `SELECT lc.*, f.display_name as friend_display_name
       FROM link_clicks lc
       LEFT JOIN friends f ON f.id = lc.friend_id
       WHERE lc.tracked_link_id = ?
       ORDER BY lc.clicked_at DESC`
  ).bind(trackedLinkId).all();
  return result.results;
}
async function getForms(db) {
  const result = await db.prepare(`SELECT * FROM forms ORDER BY created_at DESC`).all();
  return result.results;
}
async function getFormById(db, id) {
  return db.prepare(`SELECT * FROM forms WHERE id = ?`).bind(id).first();
}
async function createForm(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(
    `INSERT INTO forms
         (id, name, description, fields, on_submit_tag_id, on_submit_scenario_id,
          save_to_metadata, is_active, submit_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`
  ).bind(
    id,
    input.name,
    input.description ?? null,
    input.fields,
    input.onSubmitTagId ?? null,
    input.onSubmitScenarioId ?? null,
    input.saveToMetadata !== false ? 1 : 0,
    now,
    now
  ).run();
  return await getFormById(db, id);
}
async function updateForm(db, id, input) {
  const existing = await getFormById(db, id);
  if (!existing) return null;
  const now = jstNow();
  await db.prepare(
    `UPDATE forms
       SET name = ?,
           description = ?,
           fields = ?,
           on_submit_tag_id = ?,
           on_submit_scenario_id = ?,
           save_to_metadata = ?,
           is_active = ?,
           updated_at = ?
       WHERE id = ?`
  ).bind(
    input.name ?? existing.name,
    "description" in input ? input.description ?? null : existing.description,
    input.fields ?? existing.fields,
    "onSubmitTagId" in input ? input.onSubmitTagId ?? null : existing.on_submit_tag_id,
    "onSubmitScenarioId" in input ? input.onSubmitScenarioId ?? null : existing.on_submit_scenario_id,
    "saveToMetadata" in input ? input.saveToMetadata !== false ? 1 : 0 : existing.save_to_metadata,
    "isActive" in input ? input.isActive ? 1 : 0 : existing.is_active,
    now,
    id
  ).run();
  return getFormById(db, id);
}
async function deleteForm(db, id) {
  await db.prepare(`DELETE FROM forms WHERE id = ?`).bind(id).run();
}
async function getFormSubmissions(db, formId) {
  const result = await db.prepare(
    `SELECT fs.*, f.display_name as friend_name FROM form_submissions fs
       LEFT JOIN friends f ON f.id = fs.friend_id
       WHERE fs.form_id = ? ORDER BY fs.created_at DESC`
  ).bind(formId).all();
  return result.results;
}
async function createFormSubmission(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(
    `INSERT INTO form_submissions (id, form_id, friend_id, data, created_at)
       VALUES (?, ?, ?, ?, ?)`
  ).bind(id, input.formId, input.friendId ?? null, input.data, now).run();
  await db.prepare(`UPDATE forms SET submit_count = submit_count + 1, updated_at = ? WHERE id = ?`).bind(now, input.formId).run();
  return await db.prepare(`SELECT * FROM form_submissions WHERE id = ?`).bind(id).first();
}
async function getActiveAdPlatforms(db) {
  const result = await db.prepare(`SELECT * FROM ad_platforms WHERE is_active = 1`).all();
  return result.results;
}
async function getAdPlatformByName(db, name) {
  return db.prepare(`SELECT * FROM ad_platforms WHERE name = ? AND is_active = 1`).bind(name).first();
}
async function getAdPlatforms(db) {
  const result = await db.prepare(`SELECT * FROM ad_platforms ORDER BY created_at DESC`).all();
  return result.results;
}
async function getAdPlatformById(db, id) {
  return db.prepare(`SELECT * FROM ad_platforms WHERE id = ?`).bind(id).first();
}
async function createAdPlatform(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(
    `INSERT INTO ad_platforms (id, name, display_name, config, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`
  ).bind(id, input.name, input.displayName ?? null, JSON.stringify(input.config), now, now).run();
  return await db.prepare(`SELECT * FROM ad_platforms WHERE id = ?`).bind(id).first();
}
async function updateAdPlatform(db, id, input) {
  const now = jstNow();
  const fields = ["updated_at = ?"];
  const values = [now];
  if (input.name !== void 0) {
    fields.push("name = ?");
    values.push(input.name);
  }
  if (input.displayName !== void 0) {
    fields.push("display_name = ?");
    values.push(input.displayName);
  }
  if (input.config !== void 0) {
    fields.push("config = ?");
    values.push(JSON.stringify(input.config));
  }
  if (input.isActive !== void 0) {
    fields.push("is_active = ?");
    values.push(input.isActive ? 1 : 0);
  }
  values.push(id);
  await db.prepare(`UPDATE ad_platforms SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  return db.prepare(`SELECT * FROM ad_platforms WHERE id = ?`).bind(id).first();
}
async function deleteAdPlatform(db, id) {
  await db.prepare(`DELETE FROM ad_platforms WHERE id = ?`).bind(id).run();
}
async function logAdConversion(db, opts) {
  const id = crypto.randomUUID();
  const now = jstNow();
  await db.prepare(
    `INSERT INTO ad_conversion_logs
       (id, ad_platform_id, friend_id, event_name, click_id, click_id_type, status, request_body, response_body, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    opts.platformId,
    opts.friendId,
    opts.eventName,
    opts.clickId,
    opts.clickIdType,
    opts.status,
    opts.requestBody ?? null,
    opts.responseBody ?? null,
    opts.errorMessage ?? null,
    now
  ).run();
}
async function getAdConversionLogs(db, platformId, limit = 50) {
  const result = await db.prepare(
    `SELECT * FROM ad_conversion_logs WHERE ad_platform_id = ? ORDER BY created_at DESC LIMIT ?`
  ).bind(platformId, limit).all();
  return result.results;
}
function generateApiKey() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `lh_${hex}`;
}
async function getStaffByApiKey(db, apiKey) {
  return db.prepare("SELECT * FROM staff_members WHERE api_key = ? AND is_active = 1").bind(apiKey).first();
}
async function getStaffMembers(db) {
  const result = await db.prepare("SELECT * FROM staff_members ORDER BY created_at ASC").all();
  return result.results;
}
async function getStaffById(db, id) {
  return db.prepare("SELECT * FROM staff_members WHERE id = ?").bind(id).first();
}
async function createStaffMember(db, input) {
  const id = crypto.randomUUID();
  const now = jstNow();
  const apiKey = generateApiKey();
  await db.prepare(
    `INSERT INTO staff_members (id, name, email, role, api_key, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  ).bind(id, input.name, input.email ?? null, input.role, apiKey, now, now).run();
  return await db.prepare("SELECT * FROM staff_members WHERE id = ?").bind(id).first();
}
async function updateStaffMember(db, id, input) {
  const now = jstNow();
  const sets = ["updated_at = ?"];
  const values = [now];
  if (input.name !== void 0) {
    sets.push("name = ?");
    values.push(input.name);
  }
  if (input.email !== void 0) {
    sets.push("email = ?");
    values.push(input.email ?? null);
  }
  if (input.role !== void 0) {
    sets.push("role = ?");
    values.push(input.role);
  }
  if (input.is_active !== void 0) {
    sets.push("is_active = ?");
    values.push(input.is_active);
  }
  values.push(id);
  await db.prepare(`UPDATE staff_members SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
  return db.prepare("SELECT * FROM staff_members WHERE id = ?").bind(id).first();
}
async function deleteStaffMember(db, id) {
  await db.prepare("DELETE FROM staff_members WHERE id = ?").bind(id).run();
}
async function regenerateStaffApiKey(db, id) {
  const newKey = generateApiKey();
  const now = jstNow();
  const result = await db.prepare("UPDATE staff_members SET api_key = ?, updated_at = ? WHERE id = ?").bind(newKey, now, id).run();
  if (result.meta.changes === 0) {
    throw new Error(`Staff member not found: ${id}`);
  }
  return newKey;
}
async function countStaffByRole(db, role) {
  const result = await db.prepare("SELECT COUNT(*) as count FROM staff_members WHERE role = ?").bind(role).first();
  return result?.count ?? 0;
}
async function countActiveStaffByRole(db, role) {
  const result = await db.prepare("SELECT COUNT(*) as count FROM staff_members WHERE role = ? AND is_active = 1").bind(role).first();
  return result?.count ?? 0;
}
function extractFlexAltText(obj, depth = 0) {
  if (depth > 10 || !obj || typeof obj !== "object") return "お知らせ";
  const node = obj;
  if (node.type === "text" && typeof node.text === "string") {
    return node.text.slice(0, 100);
  }
  if (Array.isArray(node.contents)) {
    for (const child of node.contents) {
      const found = extractFlexAltTextInner(child, depth + 1);
      if (found) return found;
    }
  }
  for (const key of ["header", "body", "footer"]) {
    if (node[key]) {
      const found = extractFlexAltTextInner(node[key], depth + 1);
      if (found) return found;
    }
  }
  return "お知らせ";
}
function extractFlexAltTextInner(obj, depth) {
  if (depth > 10 || !obj || typeof obj !== "object") return null;
  const node = obj;
  if (node.type === "text" && typeof node.text === "string") {
    return node.text.slice(0, 100);
  }
  if (Array.isArray(node.contents)) {
    for (const child of node.contents) {
      const found = extractFlexAltTextInner(child, depth + 1);
      if (found) return found;
    }
  }
  for (const key of ["header", "body", "footer"]) {
    if (node[key]) {
      const found = extractFlexAltTextInner(node[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}
function addJitter(baseMs, jitterRangeMs) {
  return baseMs + Math.floor(Math.random() * jitterRangeMs);
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function addMessageVariation(text, index2) {
  const variations = [
    "​",
    // zero-width space
    "‌",
    // zero-width non-joiner
    "‍",
    // zero-width joiner
    "\uFEFF"
    // zero-width no-break space
  ];
  const varChar = variations[index2 % variations.length];
  const position = (index2 * 7 + 3) % Math.max(text.length, 1);
  if (text.length === 0) return text;
  return text.slice(0, position) + varChar + text.slice(position);
}
function calculateStaggerDelay(totalMessages, batchIndex) {
  if (totalMessages <= 100) {
    return addJitter(100, 500);
  }
  if (totalMessages <= 1e3) {
    const baseDelay2 = 12e4 / Math.ceil(totalMessages / 500) * batchIndex;
    return addJitter(baseDelay2, 2e3);
  }
  const baseDelay = 3e5 / Math.ceil(totalMessages / 500) * batchIndex;
  return addJitter(baseDelay, 5e3);
}
function jitterDeliveryTime(scheduledAt) {
  const jitterMinutes = Math.floor(Math.random() * 10) - 5;
  const result = new Date(scheduledAt);
  result.setMinutes(result.getMinutes() + jitterMinutes);
  return result;
}
function expandVariables(content, friend, apiOrigin) {
  let result = content;
  result = result.replace(/\{\{name\}\}/g, friend.display_name || "");
  result = result.replace(/\{\{uid\}\}/g, friend.user_id || "");
  result = result.replace(/\{\{friend_id\}\}/g, friend.id);
  result = result.replace(/\{\{ref\}\}/g, friend.ref_code || "");
  if (friend.ref_code) {
    result = result.replace(/\{\{#if_ref\}\}([\s\S]*?)\{\{\/if_ref\}\}/g, "$1");
  } else {
    result = result.replace(/\{\{#if_ref\}\}[\s\S]*?\{\{\/if_ref\}\}/g, "");
  }
  if (apiOrigin) {
    result = result.replace(/\{\{auth_url:([^}]+)\}\}/g, (_match, channelId) => {
      const params = new URLSearchParams({ account: channelId, ref: "cross-link" });
      if (friend.user_id) params.set("uid", friend.user_id);
      return `${apiOrigin}/auth/line?${params.toString()}`;
    });
  }
  return result;
}
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 23;
function enforceDeliveryWindow(date, preferredHour) {
  const hours = date.getUTCHours();
  const startHour = preferredHour ?? DEFAULT_START_HOUR;
  const endHour = DEFAULT_END_HOUR;
  if (hours >= startHour && hours < endHour) return date;
  const result = new Date(date);
  if (hours >= endHour) {
    result.setUTCDate(result.getUTCDate() + 1);
  }
  result.setUTCHours(startHour, 0, 0, 0);
  return result;
}
async function processStepDeliveries(db, lineClient, workerUrl) {
  const jstHour = new Date(Date.now() + 9 * 60 * 6e4).getUTCHours();
  if (jstHour < DEFAULT_START_HOUR || jstHour >= DEFAULT_END_HOUR) return;
  const now = jstNow();
  const dueFriendScenarios = await getFriendScenariosDueForDelivery(db, now);
  for (let i = 0; i < dueFriendScenarios.length; i++) {
    const fs = dueFriendScenarios[i];
    try {
      if (i > 0) {
        await sleep(addJitter(50, 200));
      }
      await processSingleDelivery(db, lineClient, fs, workerUrl);
    } catch (err) {
      console.error(`Error processing friend_scenario ${fs.id}:`, err);
    }
  }
}
async function processSingleDelivery(db, lineClient, fs, workerUrl) {
  const friend = await getFriendById(db, fs.friend_id);
  if (!friend || !friend.is_following) {
    await completeFriendScenario(db, fs.id);
    return;
  }
  const metadata = JSON.parse(friend.metadata || "{}");
  const preferredHour = typeof metadata.preferred_hour === "number" ? metadata.preferred_hour : void 0;
  const steps = await getScenarioSteps(db, fs.scenario_id);
  if (steps.length === 0) {
    await completeFriendScenario(db, fs.id);
    return;
  }
  const currentStep = steps.find((s) => s.step_order > fs.current_step_order);
  if (!currentStep) {
    await completeFriendScenario(db, fs.id);
    return;
  }
  if (currentStep.condition_type) {
    const conditionMet = await evaluateCondition(db, fs.friend_id, currentStep);
    if (!conditionMet) {
      if (currentStep.next_step_on_false !== null && currentStep.next_step_on_false !== void 0) {
        const jumpStep = steps.find((s) => s.step_order === currentStep.next_step_on_false);
        if (jumpStep) {
          const nextDate = new Date(Date.now() + 9 * 60 * 6e4);
          nextDate.setMinutes(nextDate.getMinutes() + jumpStep.delay_minutes);
          const windowedDate = enforceDeliveryWindow(nextDate, preferredHour);
          const jitteredDate = jitterDeliveryTime(windowedDate);
          await advanceFriendScenario(db, fs.id, currentStep.step_order, jitteredDate.toISOString().slice(0, -1) + "+09:00");
          return;
        }
      }
      const nextIndex = steps.indexOf(currentStep) + 1;
      if (nextIndex < steps.length) {
        const nextStep2 = steps[nextIndex];
        const nextDate = new Date(Date.now() + 9 * 60 * 6e4);
        nextDate.setMinutes(nextDate.getMinutes() + nextStep2.delay_minutes);
        const windowedDate = enforceDeliveryWindow(nextDate, preferredHour);
        const jitteredDate = jitterDeliveryTime(windowedDate);
        await advanceFriendScenario(db, fs.id, currentStep.step_order, jitteredDate.toISOString().slice(0, -1) + "+09:00");
      } else {
        await completeFriendScenario(db, fs.id);
      }
      return;
    }
  }
  const expandedContent = expandVariables(currentStep.message_content, friend, workerUrl);
  let trackedType = currentStep.message_type;
  let trackedContent = expandedContent;
  if (workerUrl) {
    const { autoTrackContent } = await import("./auto-track-DLaFv_VQ.js");
    const tracked = await autoTrackContent(db, currentStep.message_type, expandedContent, workerUrl);
    trackedType = tracked.messageType;
    trackedContent = tracked.content;
  }
  const message = buildMessage$3(trackedType, trackedContent);
  await lineClient.pushMessage(friend.line_user_id, [message]);
  const logId = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO messages_log (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, created_at)
       VALUES (?, ?, 'outgoing', ?, ?, NULL, ?, ?)`
  ).bind(logId, friend.id, currentStep.message_type, currentStep.message_content, currentStep.id, jstNow()).run();
  const currentIndex = steps.indexOf(currentStep);
  const nextStep = currentIndex + 1 < steps.length ? steps[currentIndex + 1] : null;
  if (nextStep) {
    const nextDeliveryDate = new Date(Date.now() + 9 * 60 * 6e4);
    nextDeliveryDate.setMinutes(nextDeliveryDate.getMinutes() + nextStep.delay_minutes);
    const windowedDate = enforceDeliveryWindow(nextDeliveryDate, preferredHour);
    const jitteredDate = jitterDeliveryTime(windowedDate);
    await advanceFriendScenario(db, fs.id, currentStep.step_order, jitteredDate.toISOString().slice(0, -1) + "+09:00");
  } else {
    await completeFriendScenario(db, fs.id);
  }
}
async function evaluateCondition(db, friendId, step) {
  if (!step.condition_type || !step.condition_value) return true;
  switch (step.condition_type) {
    case "tag_exists": {
      const tag = await db.prepare("SELECT 1 FROM friend_tags WHERE friend_id = ? AND tag_id = ?").bind(friendId, step.condition_value).first();
      return !!tag;
    }
    case "tag_not_exists": {
      const tag = await db.prepare("SELECT 1 FROM friend_tags WHERE friend_id = ? AND tag_id = ?").bind(friendId, step.condition_value).first();
      return !tag;
    }
    case "metadata_equals": {
      const { key, value } = JSON.parse(step.condition_value);
      const friend = await db.prepare("SELECT metadata FROM friends WHERE id = ?").bind(friendId).first();
      const metadata = JSON.parse(friend?.metadata || "{}");
      return metadata[key] === value;
    }
    case "metadata_not_equals": {
      const { key, value } = JSON.parse(step.condition_value);
      const friend = await db.prepare("SELECT metadata FROM friends WHERE id = ?").bind(friendId).first();
      const metadata = JSON.parse(friend?.metadata || "{}");
      return metadata[key] !== value;
    }
    default:
      return true;
  }
}
function cleanEmptyNodes(obj) {
  if (!obj || typeof obj !== "object") return;
  const node = obj;
  for (const key of ["header", "body", "footer"]) {
    if (node[key]) cleanEmptyNodes(node[key]);
  }
  if (Array.isArray(node.contents)) {
    node.contents = node.contents.filter((c2) => {
      if (c2 && typeof c2 === "object" && c2.type === "text") {
        const text = c2.text;
        return typeof text === "string" && text.trim().length > 0;
      }
      return true;
    });
    for (const c2 of node.contents) cleanEmptyNodes(c2);
  }
}
function buildMessage$3(messageType, messageContent, altText) {
  if (messageType === "text") {
    return { type: "text", text: messageContent };
  }
  if (messageType === "image") {
    try {
      const parsed = JSON.parse(messageContent);
      return {
        type: "image",
        originalContentUrl: parsed.originalContentUrl,
        previewImageUrl: parsed.previewImageUrl
      };
    } catch {
      return { type: "text", text: messageContent };
    }
  }
  if (messageType === "flex") {
    try {
      const contents = JSON.parse(messageContent);
      cleanEmptyNodes(contents);
      return { type: "flex", altText: altText || extractFlexAltText(contents), contents };
    } catch {
      return { type: "text", text: messageContent };
    }
  }
  return { type: "text", text: messageContent };
}
const stepDelivery = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  buildMessage: buildMessage$3,
  expandVariables,
  processStepDeliveries
}, Symbol.toStringTag, { value: "Module" }));
const MULTICAST_BATCH_SIZE$1 = 500;
async function processBroadcastSend(db, lineClient, broadcastId, workerUrl) {
  await updateBroadcastStatus(db, broadcastId, "sending");
  const broadcast = await getBroadcastById(db, broadcastId);
  if (!broadcast) {
    throw new Error(`Broadcast ${broadcastId} not found`);
  }
  let finalType = broadcast.message_type;
  let finalContent = broadcast.message_content;
  if (workerUrl) {
    const { autoTrackContent } = await import("./auto-track-DLaFv_VQ.js");
    const tracked = await autoTrackContent(db, broadcast.message_type, broadcast.message_content, workerUrl);
    finalType = tracked.messageType;
    finalContent = tracked.content;
  }
  const altText = broadcast.alt_text;
  const message = buildMessage$2(finalType, finalContent, altText || void 0);
  let totalCount = 0;
  let successCount = 0;
  try {
    if (broadcast.target_type === "all") {
      const { requestId } = await lineClient.broadcast([message]);
      await updateBroadcastLineRequestId(db, broadcast.id, requestId, null);
      totalCount = 0;
      successCount = 0;
    } else if (broadcast.target_type === "tag") {
      if (!broadcast.target_tag_id) {
        throw new Error("target_tag_id is required for tag-targeted broadcasts");
      }
      const friends2 = await getFriendsByTag(db, broadcast.target_tag_id);
      const followingFriends = friends2.filter((f) => f.is_following);
      totalCount = followingFriends.length;
      const now = jstNow();
      const totalBatches = Math.ceil(followingFriends.length / MULTICAST_BATCH_SIZE$1);
      const unit = `bcast_${broadcast.id.slice(0, 8)}`;
      for (let i = 0; i < followingFriends.length; i += MULTICAST_BATCH_SIZE$1) {
        const batchIndex = Math.floor(i / MULTICAST_BATCH_SIZE$1);
        const batch = followingFriends.slice(i, i + MULTICAST_BATCH_SIZE$1);
        const lineUserIds = batch.map((f) => f.line_user_id);
        if (batchIndex > 0) {
          const delay = calculateStaggerDelay(followingFriends.length, batchIndex);
          await sleep(delay);
        }
        let batchMessage = message;
        if (message.type === "text" && totalBatches > 1) {
          batchMessage = { ...message, text: addMessageVariation(message.text, batchIndex) };
        }
        try {
          await lineClient.multicast(lineUserIds, [batchMessage], [unit]);
          successCount += batch.length;
          for (const friend of batch) {
            const logId = crypto.randomUUID();
            await db.prepare(
              `INSERT INTO messages_log (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, created_at)
                 VALUES (?, ?, 'outgoing', ?, ?, ?, NULL, ?)`
            ).bind(logId, friend.id, broadcast.message_type, broadcast.message_content, broadcastId, now).run();
          }
        } catch (err) {
          console.error(`Multicast batch ${i / MULTICAST_BATCH_SIZE$1} failed:`, err);
        }
      }
      await updateBroadcastLineRequestId(db, broadcast.id, null, unit);
    }
    await createBroadcastInsight(db, broadcast.id);
    await updateBroadcastStatus(db, broadcastId, "sent", { totalCount, successCount });
  } catch (err) {
    await updateBroadcastStatus(db, broadcastId, "draft");
    throw err;
  }
  return await getBroadcastById(db, broadcastId);
}
async function processScheduledBroadcasts(db, lineClient, workerUrl) {
  jstNow();
  const allBroadcasts = await getBroadcasts(db);
  const nowMs = Date.now();
  const scheduled2 = allBroadcasts.filter(
    (b) => b.status === "scheduled" && b.scheduled_at !== null && new Date(b.scheduled_at).getTime() <= nowMs
  );
  for (const broadcast of scheduled2) {
    try {
      await processBroadcastSend(db, lineClient, broadcast.id, workerUrl);
    } catch (err) {
      console.error(`Failed to send scheduled broadcast ${broadcast.id}:`, err);
    }
  }
}
function buildMessage$2(messageType, messageContent, altText) {
  if (messageType === "text") {
    return { type: "text", text: messageContent };
  }
  if (messageType === "image") {
    try {
      const parsed = JSON.parse(messageContent);
      return {
        type: "image",
        originalContentUrl: parsed.originalContentUrl,
        previewImageUrl: parsed.previewImageUrl
      };
    } catch {
      return { type: "text", text: messageContent };
    }
  }
  if (messageType === "flex") {
    try {
      const contents = JSON.parse(messageContent);
      return { type: "flex", altText: altText || extractFlexAltText(contents), contents };
    } catch {
      return { type: "text", text: messageContent };
    }
  }
  return { type: "text", text: messageContent };
}
async function processReminderDeliveries(db, lineClient) {
  const now = jstNow();
  const dueReminders = await getDueReminderDeliveries(db, now);
  for (let i = 0; i < dueReminders.length; i++) {
    const fr = dueReminders[i];
    try {
      if (i > 0) {
        await sleep(addJitter(50, 200));
      }
      const friend = await getFriendById(db, fr.friend_id);
      if (!friend || !friend.is_following) {
        continue;
      }
      for (const step of fr.steps) {
        const message = buildMessage$1(step.message_type, step.message_content);
        await lineClient.pushMessage(friend.line_user_id, [message]);
        const logId = crypto.randomUUID();
        await db.prepare(
          `INSERT INTO messages_log (id, friend_id, direction, message_type, content, created_at)
             VALUES (?, ?, 'outgoing', ?, ?, ?)`
        ).bind(logId, friend.id, step.message_type, step.message_content, jstNow()).run();
        await markReminderStepDelivered(db, fr.id, step.id);
      }
      await completeReminderIfDone(db, fr.id, fr.reminder_id);
    } catch (err) {
      console.error(`リマインダ配信エラー (friend_reminder ${fr.id}):`, err);
    }
  }
}
function buildMessage$1(messageType, messageContent, altText) {
  if (messageType === "text") {
    return { type: "text", text: messageContent };
  }
  if (messageType === "image") {
    try {
      const parsed = JSON.parse(messageContent);
      return { type: "image", originalContentUrl: parsed.originalContentUrl, previewImageUrl: parsed.previewImageUrl };
    } catch {
      return { type: "text", text: messageContent };
    }
  }
  if (messageType === "flex") {
    try {
      const contents = JSON.parse(messageContent);
      return { type: "flex", altText: altText || extractFlexAltText(contents), contents };
    } catch {
      return { type: "text", text: messageContent };
    }
  }
  return { type: "text", text: messageContent };
}
async function checkAccountHealth(db) {
  const accounts = await getLineAccounts(db);
  for (const account of accounts) {
    if (!account.is_active) continue;
    try {
      await checkSingleAccount(db, account);
    } catch (err) {
      console.error(`ヘルスチェックエラー (account ${account.id}):`, err);
    }
  }
}
async function checkSingleAccount(db, account) {
  const jstMs = Date.now() + 9 * 60 * 6e4;
  const now = new Date(jstMs);
  const checkPeriod = now.toISOString().slice(0, -1) + "+09:00";
  const oneHourAgo = new Date(jstMs - 60 * 6e4).toISOString().slice(0, -1) + "+09:00";
  const sentMessages = await db.prepare(
    `SELECT COUNT(*) as count FROM messages_log
       WHERE direction = 'outgoing' AND created_at >= ?`
  ).bind(oneHourAgo).first();
  const totalSent = sentMessages?.count ?? 0;
  let errorCode = null;
  let errorCount = 0;
  try {
    const response = await fetch("https://api.line.me/v2/bot/info", {
      headers: { Authorization: `Bearer ${account.channel_access_token}` }
    });
    if (!response.ok) {
      errorCode = response.status;
      errorCount = 1;
    }
  } catch {
    errorCode = 0;
    errorCount = 1;
  }
  let riskLevel = "normal";
  if (errorCode === 403) {
    riskLevel = "danger";
  } else if (errorCode === 429) {
    riskLevel = "warning";
  } else if (totalSent > 5e3) {
    riskLevel = "warning";
  }
  await createAccountHealthLog(db, {
    lineAccountId: account.id,
    errorCode: errorCode ?? void 0,
    errorCount,
    checkPeriod,
    riskLevel
  });
  if (riskLevel === "danger") {
    console.error(`⚠️ BAN検知: アカウント ${account.id} で403エラー発生。即座に確認が必要。`);
  }
}
const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 6e4;
const JST_OFFSET_MS = 9 * 60 * 6e4;
function shouldRefresh(account) {
  if (!account.token_expires_at) return true;
  const expiresAt = new Date(account.token_expires_at).getTime();
  return expiresAt - Date.now() < REFRESH_THRESHOLD_MS;
}
async function issueNewToken(channelId, channelSecret) {
  const res = await fetch("https://api.line.me/v2/oauth/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: channelId,
      client_secret: channelSecret
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE token API ${res.status}: ${body}`);
  }
  return res.json();
}
async function refreshLineAccessTokens(db) {
  const accounts = await getLineAccounts(db);
  for (const account of accounts) {
    if (!account.is_active) continue;
    if (!shouldRefresh(account)) continue;
    try {
      const token = await issueNewToken(account.channel_id, account.channel_secret);
      const expiresAt = new Date(Date.now() + token.expires_in * 1e3 + JST_OFFSET_MS);
      const expiresAtJst = expiresAt.toISOString().slice(0, -1) + "+09:00";
      await updateLineAccount(db, account.id, {
        channel_access_token: token.access_token,
        token_expires_at: expiresAtJst
      });
      console.log(`🔄 Token refreshed: ${account.name} (expires ${expiresAtJst})`);
    } catch (err) {
      console.error(`❌ Token refresh failed for ${account.name}:`, err);
    }
  }
}
const INSIGHT_INTERVAL_MS = 24 * 60 * 60 * 1e3;
let lastInsightRun = 0;
async function processInsightFetch(db, lineClients, defaultLineClient) {
  const now = Date.now();
  if (now - lastInsightRun < INSIGHT_INTERVAL_MS) {
    return;
  }
  lastInsightRun = now;
  const pending = await getPendingInsights(db);
  if (pending.length === 0) return;
  for (const item of pending) {
    try {
      const client = item.lineAccountId && lineClients.get(item.lineAccountId) || defaultLineClient;
      if (item.lineRequestId) {
        const response = await client.getMessageEventInsight(
          item.lineRequestId
        );
        const overview = response.overview;
        await updateInsightResult(db, item.insightId, {
          delivered: overview?.delivered ?? null,
          uniqueImpression: overview?.uniqueImpression ?? null,
          uniqueClick: overview?.uniqueClick ?? null,
          uniqueMediaPlayed: overview?.uniqueMediaPlayed ?? null,
          rawResponse: JSON.stringify(response)
        });
      } else if (item.aggregationUnit) {
        const sentDate = item.sentAt.slice(0, 10).replace(/-/g, "");
        const response = await client.getUnitInsight(
          item.aggregationUnit,
          sentDate,
          sentDate
        );
        const messages = response.messages;
        const overview = messages?.[0] || {};
        await updateInsightResult(db, item.insightId, {
          delivered: null,
          uniqueImpression: overview.uniqueImpression ?? null,
          uniqueClick: overview.uniqueClick ?? null,
          uniqueMediaPlayed: overview.uniqueMediaPlayed ?? null,
          rawResponse: JSON.stringify(response)
        });
      } else {
        await markInsightFailed(db, item.insightId, item.retryCount);
      }
    } catch (error) {
      console.error(
        `Insight fetch failed for broadcast ${item.broadcastId}:`,
        error
      );
      await markInsightFailed(db, item.insightId, item.retryCount);
    }
  }
}
async function authMiddleware(c2, next) {
  const path = new URL(c2.req.url).pathname;
  if (path === "/webhook" || path === "/docs" || path === "/openapi.json" || path === "/api/affiliates/click" || path.startsWith("/t/") || path.startsWith("/r/") || path.startsWith("/images/") || path.startsWith("/api/liff/") || path.startsWith("/auth/") || path === "/api/integrations/stripe/webhook" || path.match(/^\/api\/webhooks\/incoming\/[^/]+\/receive$/) || path.match(/^\/api\/forms\/[^/]+\/submit$/) || path.match(/^\/api\/forms\/[^/]+$/)) {
    return next();
  }
  const authHeader = c2.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c2.json({ success: false, error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice("Bearer ".length);
  const staff2 = await getStaffByApiKey(c2.env.DB, token);
  if (staff2) {
    c2.set("staff", { id: staff2.id, name: staff2.name, role: staff2.role });
    return next();
  }
  if (token === c2.env.API_KEY) {
    c2.set("staff", { id: "env-owner", name: "Owner", role: "owner" });
    return next();
  }
  return c2.json({ success: false, error: "Unauthorized" }, 401);
}
const store = /* @__PURE__ */ new Map();
const PRUNE_INTERVAL = 6e4;
let lastPrune = Date.now();
function prune(windowMs) {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL) return;
  lastPrune = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}
function check(key, max, windowMs) {
  const now = Date.now();
  const cutoff = now - windowMs;
  prune(windowMs);
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length >= max) {
    const oldest = entry.timestamps[0];
    const retryAfter = Math.ceil((oldest + windowMs - now) / 1e3);
    return { ok: false, remaining: 0, retryAfter: Math.max(retryAfter, 1) };
  }
  entry.timestamps.push(now);
  return { ok: true, remaining: max - entry.timestamps.length, retryAfter: 0 };
}
const UNAUTHENTICATED_PATTERNS = [
  "/webhook",
  /^\/api\/forms\/[^/]+\/submit$/
];
function isUnauthenticatedPath(path) {
  return UNAUTHENTICATED_PATTERNS.some(
    (p) => typeof p === "string" ? path === p : p.test(path)
  );
}
function getClientIp(c2) {
  return c2.req.header("cf-connecting-ip") || c2.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c2.req.header("x-real-ip") || "0.0.0.0";
}
const AUTHENTICATED_MAX = 1e3;
const AUTHENTICATED_WINDOW = 6e4;
const UNAUTHENTICATED_MAX = 100;
const UNAUTHENTICATED_WINDOW = 6e4;
async function rateLimitMiddleware(c2, next) {
  const path = new URL(c2.req.url).pathname;
  if (path === "/docs" || path === "/openapi.json" || path.startsWith("/r/")) {
    return next();
  }
  let key;
  let max;
  let windowMs;
  if (isUnauthenticatedPath(path)) {
    key = `ip:${getClientIp(c2)}`;
    max = UNAUTHENTICATED_MAX;
    windowMs = UNAUTHENTICATED_WINDOW;
  } else {
    const authHeader = c2.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token) {
      key = `key:${token.slice(0, 16)}`;
      max = AUTHENTICATED_MAX;
      windowMs = AUTHENTICATED_WINDOW;
    } else {
      key = `ip:${getClientIp(c2)}`;
      max = UNAUTHENTICATED_MAX;
      windowMs = UNAUTHENTICATED_WINDOW;
    }
  }
  const result = check(key, max, windowMs);
  if (!result.ok) {
    return c2.json(
      { success: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(result.retryAfter) } }
    );
  }
  await next();
  c2.header("X-RateLimit-Remaining", String(result.remaining));
}
async function sendAdConversions(db, friendId, eventName, eventValue) {
  const ref = await getRefTrackingWithClickIds(db, friendId);
  if (!ref) return;
  const platforms = await getActiveAdPlatforms(db);
  for (const platform of platforms) {
    const config = JSON.parse(platform.config);
    try {
      switch (platform.name) {
        case "meta":
          if (ref.fbclid) {
            await sendMetaConversion(config, ref, eventName, eventValue);
            await logAdConversion(db, {
              platformId: platform.id,
              friendId,
              eventName,
              clickId: ref.fbclid,
              clickIdType: "fbclid",
              status: "sent"
            });
          }
          break;
        case "x":
          if (ref.twclid) {
            await sendXConversion(config, ref, eventName, eventValue);
            await logAdConversion(db, {
              platformId: platform.id,
              friendId,
              eventName,
              clickId: ref.twclid,
              clickIdType: "twclid",
              status: "sent"
            });
          }
          break;
        case "google":
          if (ref.gclid) {
            await sendGoogleConversion(config, ref, eventName, eventValue);
            await logAdConversion(db, {
              platformId: platform.id,
              friendId,
              eventName,
              clickId: ref.gclid,
              clickIdType: "gclid",
              status: "sent"
            });
          }
          break;
        case "tiktok":
          if (ref.ttclid) {
            await sendTikTokConversion(config, ref, eventName, eventValue);
            await logAdConversion(db, {
              platformId: platform.id,
              friendId,
              eventName,
              clickId: ref.ttclid,
              clickIdType: "ttclid",
              status: "sent"
            });
          }
          break;
      }
    } catch (error) {
      await logAdConversion(db, {
        platformId: platform.id,
        friendId,
        eventName,
        clickId: ref.fbclid || ref.twclid || ref.gclid || ref.ttclid || "",
        clickIdType: platform.name,
        status: "failed",
        errorMessage: String(error)
      });
    }
  }
}
async function sendMetaConversion(config, ref, eventName, eventValue) {
  const url = `https://graph.facebook.com/v21.0/${config.pixel_id}/events`;
  const eventData = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1e3),
    action_source: "website",
    user_data: {
      fbc: `fb.1.${Date.now()}.${ref.fbclid}`,
      client_ip_address: ref.ip_address || void 0,
      client_user_agent: ref.user_agent || void 0
    }
  };
  if (eventValue) {
    eventData.custom_data = { currency: "JPY", value: eventValue };
  }
  const body = {
    data: [eventData],
    access_token: config.access_token
  };
  if (config.test_event_code) {
    body.test_event_code = config.test_event_code;
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Meta CAPI error: ${response.status} ${errorBody}`);
  }
}
async function sendXConversion(config, ref, eventName, eventValue) {
  const url = "https://ads-api.x.com/12/measurement/conversions";
  const body = {
    conversions: [{
      conversion_time: (/* @__PURE__ */ new Date()).toISOString(),
      event_id: crypto.randomUUID(),
      identifiers: [{ twclid: ref.twclid }],
      conversion_id: config.pixel_id,
      event_name: eventName,
      ...eventValue && { value: { currency: "JPY", amount: String(eventValue) } }
    }]
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
      // OAuth 1.0a signature required — placeholder for production implementation
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`X Conversion API error: ${response.status} ${errorBody}`);
  }
}
async function sendGoogleConversion(config, ref, eventName, eventValue) {
  const url = `https://googleads.googleapis.com/v17/customers/${config.customer_id}:uploadClickConversions`;
  const body = {
    conversions: [{
      gclid: ref.gclid,
      conversion_action: `customers/${config.customer_id}/conversionActions/${config.conversion_action_id}`,
      conversion_date_time: (/* @__PURE__ */ new Date()).toISOString().replace("Z", "+09:00"),
      ...eventValue && { conversion_value: eventValue, currency_code: "JPY" }
    }],
    partial_failure: true
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.oauth_token}`,
      "developer-token": config.developer_token || ""
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google Ads API error: ${response.status} ${errorBody}`);
  }
}
async function sendTikTokConversion(config, ref, eventName, eventValue) {
  const url = "https://business-api.tiktok.com/open_api/v1.3/event/track/";
  const body = {
    pixel_code: config.pixel_code,
    event: eventName,
    event_id: crypto.randomUUID(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    context: {
      user_agent: ref.user_agent || "",
      ip: ref.ip_address || ""
    },
    properties: {
      ...ref.ttclid && { ttclid: ref.ttclid },
      ...eventValue && { currency: "JPY", value: eventValue }
    }
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Access-Token": config.access_token || ""
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`TikTok Events API error: ${response.status} ${errorBody}`);
  }
}
async function fireEvent(db, eventType, payload, lineAccessToken, lineAccountId) {
  const phase1 = [
    fireOutgoingWebhooks(db, eventType, payload),
    processScoring(db, eventType, payload)
  ];
  if (payload.friendId && payload.conversionEventName) {
    phase1.push(
      sendAdConversions(db, payload.friendId, payload.conversionEventName, payload.conversionValue)
    );
  }
  await Promise.allSettled(phase1);
  const enrichedPayload = payload.friendId ? {
    ...payload,
    eventData: {
      ...payload.eventData,
      currentScore: await getFriendScore(db, payload.friendId)
    }
  } : payload;
  await Promise.allSettled([
    processAutomations(db, eventType, enrichedPayload, lineAccessToken, lineAccountId),
    processNotifications(db, eventType, enrichedPayload, lineAccountId)
  ]);
}
async function fireOutgoingWebhooks(db, eventType, payload) {
  try {
    const webhooks2 = await getActiveOutgoingWebhooksByEvent(db, eventType);
    for (const wh of webhooks2) {
      try {
        const body = JSON.stringify({
          event: eventType,
          timestamp: jstNow(),
          data: payload
        });
        const headers = { "Content-Type": "application/json" };
        if (wh.secret) {
          const encoder = new TextEncoder();
          const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(wh.secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
          );
          const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
          const hexSignature = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
          headers["X-Webhook-Signature"] = hexSignature;
        }
        await fetch(wh.url, { method: "POST", headers, body });
      } catch (err) {
        console.error(`送信Webhook ${wh.id} への通知失敗:`, err);
      }
    }
  } catch (err) {
    console.error("fireOutgoingWebhooks error:", err);
  }
}
async function processScoring(db, eventType, payload) {
  if (!payload.friendId) return;
  try {
    await applyScoring(db, payload.friendId, eventType);
  } catch (err) {
    console.error("processScoring error:", err);
  }
}
async function processAutomations(db, eventType, payload, lineAccessToken, lineAccountId) {
  try {
    const allAutomations = await getActiveAutomationsByEvent(db, eventType);
    const automations2 = allAutomations.filter(
      (a) => !a.line_account_id || !lineAccountId || a.line_account_id === lineAccountId
    );
    for (const automation of automations2) {
      const conditions = JSON.parse(automation.conditions);
      const actions = JSON.parse(automation.actions);
      if (!matchConditions(conditions, payload)) continue;
      const results = [];
      for (const action of actions) {
        try {
          await executeAction(db, action, payload, lineAccessToken);
          results.push({ action: action.type, success: true });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          results.push({ action: action.type, success: false, error: errorMsg });
        }
      }
      const allSuccess = results.every((r) => r.success);
      const anySuccess = results.some((r) => r.success);
      await createAutomationLog(db, {
        automationId: automation.id,
        friendId: payload.friendId,
        eventData: JSON.stringify(payload.eventData ?? {}),
        actionsResult: JSON.stringify(results),
        status: allSuccess ? "success" : anySuccess ? "partial" : "failed"
      });
    }
  } catch (err) {
    console.error("processAutomations error:", err);
  }
}
function matchConditions(conditions, payload) {
  if (Object.keys(conditions).length === 0) return true;
  if (conditions.score_threshold !== void 0 && payload.eventData) {
    const currentScore = payload.eventData.currentScore;
    if (currentScore !== void 0 && currentScore < conditions.score_threshold) {
      return false;
    }
  }
  if (conditions.tag_id !== void 0 && payload.eventData) {
    if (payload.eventData.tagId !== conditions.tag_id) return false;
  }
  if (conditions.keyword !== void 0 && payload.eventData) {
    const text = payload.eventData.text;
    if (!text || !text.includes(conditions.keyword)) return false;
  }
  return true;
}
async function executeAction(db, action, payload, lineAccessToken) {
  const friendId = payload.friendId;
  if (!friendId && action.type !== "send_webhook") {
    throw new Error("friendId is required for this action");
  }
  switch (action.type) {
    case "add_tag":
      await addTagToFriend(db, friendId, action.params.tagId);
      break;
    case "remove_tag":
      await removeTagFromFriend(db, friendId, action.params.tagId);
      break;
    case "start_scenario":
      await enrollFriendInScenario(db, friendId, action.params.scenarioId);
      break;
    case "send_message": {
      if (!lineAccessToken || !friendId) break;
      const friend = await db.prepare("SELECT line_user_id FROM friends WHERE id = ?").bind(friendId).first();
      if (!friend) break;
      const lineClient = new LineClient(lineAccessToken);
      const msgType = action.params.messageType || "text";
      let msg;
      if (msgType === "flex") {
        const contents = JSON.parse(action.params.content);
        msg = { type: "flex", altText: action.params.altText || extractFlexAltText(contents), contents };
      } else {
        msg = { type: "text", text: action.params.content };
      }
      if (payload.replyToken) {
        try {
          await lineClient.replyMessage(payload.replyToken, [msg]);
          payload.replyToken = void 0;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const isTokenError = errMsg.includes("400") || errMsg.includes("Invalid reply token");
          if (isTokenError) {
            await lineClient.pushMessage(friend.line_user_id, [msg]);
          } else {
            throw err;
          }
        }
      } else {
        await lineClient.pushMessage(friend.line_user_id, [msg]);
      }
      break;
    }
    case "send_webhook": {
      const url = action.params.url;
      if (url) {
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ friendId, ...payload.eventData })
        });
      }
      break;
    }
    case "switch_rich_menu": {
      if (!lineAccessToken || !friendId) break;
      const friend = await db.prepare("SELECT line_user_id FROM friends WHERE id = ?").bind(friendId).first();
      if (!friend) break;
      const lineClient = new LineClient(lineAccessToken);
      await lineClient.linkRichMenuToUser(friend.line_user_id, action.params.richMenuId);
      break;
    }
    case "remove_rich_menu": {
      if (!lineAccessToken || !friendId) break;
      const friend = await db.prepare("SELECT line_user_id FROM friends WHERE id = ?").bind(friendId).first();
      if (!friend) break;
      const lineClient = new LineClient(lineAccessToken);
      await lineClient.unlinkRichMenuFromUser(friend.line_user_id);
      break;
    }
    case "set_metadata": {
      if (!friendId) break;
      const existing = await db.prepare("SELECT metadata FROM friends WHERE id = ?").bind(friendId).first();
      const current = JSON.parse(existing?.metadata || "{}");
      const patch = JSON.parse(action.params.data || "{}");
      const merged = { ...current, ...patch };
      await db.prepare("UPDATE friends SET metadata = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(merged), jstNow(), friendId).run();
      break;
    }
    default:
      console.warn(`未知のアクションタイプ: ${action.type}`);
  }
}
async function processNotifications(db, eventType, payload, lineAccountId) {
  try {
    const allRules = await getActiveNotificationRulesByEvent(db, eventType);
    const rules = allRules.filter(
      (r) => !r.line_account_id || !lineAccountId || r.line_account_id === lineAccountId
    );
    for (const rule of rules) {
      let channels = JSON.parse(rule.channels);
      if (typeof channels === "string") channels = JSON.parse(channels);
      for (const channel of channels) {
        await createNotification(db, {
          ruleId: rule.id,
          eventType,
          title: `${rule.name}: ${eventType}`,
          body: JSON.stringify(payload),
          channel,
          metadata: JSON.stringify(payload.eventData ?? {})
        });
        if (channel === "webhook") {
        }
      }
    }
  } catch (err) {
    console.error("processNotifications error:", err);
  }
}
const eventBus = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  fireEvent
}, Symbol.toStringTag, { value: "Module" }));
const webhook = new Hono();
webhook.post("/webhook", async (c2) => {
  const rawBody = await c2.req.text();
  const signature = c2.req.header("X-Line-Signature") ?? "";
  const db = c2.env.DB;
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.error("Failed to parse webhook body");
    return c2.json({ status: "ok" }, 200);
  }
  let channelSecret = c2.env.LINE_CHANNEL_SECRET;
  let channelAccessToken = c2.env.LINE_CHANNEL_ACCESS_TOKEN;
  let matchedAccountId = null;
  if (body.destination) {
    const accounts = await getLineAccounts(db);
    for (const account of accounts) {
      if (!account.is_active) continue;
      const isValid = await verifySignature(account.channel_secret, rawBody, signature);
      if (isValid) {
        channelSecret = account.channel_secret;
        channelAccessToken = account.channel_access_token;
        matchedAccountId = account.id;
        break;
      }
    }
  }
  const valid = await verifySignature(channelSecret, rawBody, signature);
  if (!valid) {
    console.error("Invalid LINE signature");
    return c2.json({ status: "ok" }, 200);
  }
  const lineClient = new LineClient(channelAccessToken);
  const processingPromise = (async () => {
    for (const event of body.events) {
      try {
        await handleEvent(db, lineClient, event, channelAccessToken, matchedAccountId, c2.env.WORKER_URL || new URL(c2.req.url).origin);
      } catch (err) {
        console.error("Error handling webhook event:", err);
      }
    }
  })();
  c2.executionCtx.waitUntil(processingPromise);
  return c2.json({ status: "ok" }, 200);
});
async function handleEvent(db, lineClient, event, lineAccessToken, lineAccountId = null, workerUrl) {
  if (event.type === "follow") {
    const userId = event.source.type === "user" ? event.source.userId : void 0;
    if (!userId) return;
    let profile;
    try {
      profile = await lineClient.getProfile(userId);
    } catch (err) {
      console.error("Failed to get profile for", userId, err);
    }
    const friend = await upsertFriend(db, {
      lineUserId: userId,
      displayName: profile?.displayName ?? null,
      pictureUrl: profile?.pictureUrl ?? null,
      statusMessage: profile?.statusMessage ?? null
    });
    if (lineAccountId) {
      await db.prepare("UPDATE friends SET line_account_id = ? WHERE id = ? AND line_account_id IS NULL").bind(lineAccountId, friend.id).run();
    }
    const scenarios2 = await getScenarios(db);
    for (const scenario of scenarios2) {
      const scenarioAccountMatch = !scenario.line_account_id || !lineAccountId || scenario.line_account_id === lineAccountId;
      if (scenario.trigger_type === "friend_add" && scenario.is_active && scenarioAccountMatch) {
        try {
          const existing = await db.prepare(`SELECT id FROM friend_scenarios WHERE friend_id = ? AND scenario_id = ?`).bind(friend.id, scenario.id).first();
          if (!existing) {
            const friendScenario = await enrollFriendInScenario(db, friend.id, scenario.id);
            const steps = await getScenarioSteps(db, scenario.id);
            const firstStep = steps[0];
            if (firstStep && firstStep.delay_minutes === 0 && friendScenario.status === "active") {
              try {
                const expandedContent = expandVariables(firstStep.message_content, friend);
                const message = buildMessage$3(firstStep.message_type, expandedContent);
                await lineClient.replyMessage(event.replyToken, [message]);
                console.log(`Immediate delivery: sent step ${firstStep.id} to ${userId}`);
                const logId = crypto.randomUUID();
                await db.prepare(
                  `INSERT INTO messages_log (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, delivery_type, created_at)
                     VALUES (?, ?, 'outgoing', ?, ?, NULL, ?, 'reply', ?)`
                ).bind(logId, friend.id, firstStep.message_type, firstStep.message_content, firstStep.id, jstNow()).run();
                const secondStep = steps[1] ?? null;
                if (secondStep) {
                  const nextDeliveryDate = new Date(Date.now() + 9 * 60 * 6e4);
                  nextDeliveryDate.setMinutes(nextDeliveryDate.getMinutes() + secondStep.delay_minutes);
                  const h = nextDeliveryDate.getUTCHours();
                  if (h < 9 || h >= 21) {
                    if (h >= 21) nextDeliveryDate.setUTCDate(nextDeliveryDate.getUTCDate() + 1);
                    nextDeliveryDate.setUTCHours(9, 0, 0, 0);
                  }
                  await advanceFriendScenario(db, friendScenario.id, firstStep.step_order, nextDeliveryDate.toISOString().slice(0, -1) + "+09:00");
                } else {
                  await completeFriendScenario(db, friendScenario.id);
                }
              } catch (err) {
                console.error("Failed immediate delivery for scenario", scenario.id, err);
              }
            }
          }
        } catch (err) {
          console.error("Failed to enroll friend in scenario", scenario.id, err);
        }
      }
    }
    await fireEvent(db, "friend_add", { friendId: friend.id, eventData: { displayName: friend.display_name } }, lineAccessToken, lineAccountId);
    return;
  }
  if (event.type === "unfollow") {
    const userId = event.source.type === "user" ? event.source.userId : void 0;
    if (!userId) return;
    await updateFriendFollowStatus(db, userId, false);
    return;
  }
  if (event.type === "message" && event.message.type === "text") {
    const textMessage = event.message;
    const userId = event.source.type === "user" ? event.source.userId : void 0;
    if (!userId) return;
    const friend = await getFriendByLineUserId(db, userId);
    if (!friend) return;
    const incomingText = textMessage.text;
    const now = jstNow();
    const logId = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO messages_log (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, created_at)
         VALUES (?, ?, 'incoming', 'text', ?, NULL, NULL, ?)`
    ).bind(logId, friend.id, incomingText, now).run();
    const autoKeywords = ["料金", "機能", "API", "フォーム", "ヘルプ", "UUID", "UUID連携について教えて", "UUID連携を確認", "配信時間", "導入支援を希望します", "アカウント連携を見る", "体験を完了する", "BAN対策を見る", "連携確認"];
    const isAutoKeyword = autoKeywords.some((k) => incomingText === k);
    const isTimeCommand = /(?:配信時間|配信|届けて|通知)[はを]?\s*\d{1,2}\s*時/.test(incomingText);
    if (!isAutoKeyword && !isTimeCommand) {
      await upsertChatOnMessage(db, friend.id);
    }
    const timeMatch = incomingText.match(/(?:配信時間|配信|届けて|通知)[はを]?\s*(\d{1,2})\s*時/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1], 10);
      if (hour >= 6 && hour <= 22) {
        const existing = await db.prepare("SELECT metadata FROM friends WHERE id = ?").bind(friend.id).first();
        const meta = JSON.parse(existing?.metadata || "{}");
        meta.preferred_hour = hour;
        await db.prepare("UPDATE friends SET metadata = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(meta), jstNow(), friend.id).run();
        try {
          const period = hour < 12 ? "午前" : "午後";
          const displayHour = hour <= 12 ? hour : hour - 12;
          await lineClient.replyMessage(event.replyToken, [
            buildMessage$3("flex", JSON.stringify({
              type: "bubble",
              body: { type: "box", layout: "vertical", contents: [
                { type: "text", text: "配信時間を設定しました", size: "lg", weight: "bold", color: "#1e293b" },
                { type: "box", layout: "vertical", contents: [
                  { type: "text", text: `${period} ${displayHour}:00`, size: "xxl", weight: "bold", color: "#f59e0b", align: "center" },
                  { type: "text", text: `（${hour}:00〜）`, size: "sm", color: "#64748b", align: "center", margin: "sm" }
                ], backgroundColor: "#fffbeb", cornerRadius: "md", paddingAll: "20px", margin: "lg" },
                { type: "text", text: "今後のステップ配信はこの時間以降にお届けします。", size: "xs", color: "#64748b", wrap: true, margin: "lg" }
              ], paddingAll: "20px" }
            }))
          ]);
        } catch (err) {
          console.error("Failed to reply for time setting", err);
        }
        return;
      }
    }
    if (incomingText === "体験を完了する" && lineAccountId) {
      try {
        const friendRecord = await db.prepare("SELECT user_id FROM friends WHERE id = ?").bind(friend.id).first();
        if (friendRecord?.user_id) {
          const otherFriends = await db.prepare(
            "SELECT f.line_user_id, la.channel_access_token FROM friends f INNER JOIN line_accounts la ON la.id = f.line_account_id WHERE f.user_id = ? AND f.line_account_id != ? AND f.is_following = 1"
          ).bind(friendRecord.user_id, lineAccountId).all();
          for (const other of otherFriends.results) {
            const otherClient = new LineClient(other.channel_access_token);
            const { buildMessage: bm } = await Promise.resolve().then(() => stepDelivery);
            await otherClient.pushMessage(other.line_user_id, [bm("flex", JSON.stringify({
              type: "bubble",
              size: "giga",
              header: {
                type: "box",
                layout: "vertical",
                paddingAll: "20px",
                backgroundColor: "#fffbeb",
                contents: [{ type: "text", text: `${friend.display_name || ""}さんへ`, size: "lg", weight: "bold", color: "#1e293b" }]
              },
              body: {
                type: "box",
                layout: "vertical",
                paddingAll: "20px",
                contents: [
                  { type: "text", text: "別アカウントからのアクションを検知しました。", size: "sm", color: "#06C755", weight: "bold", wrap: true },
                  { type: "text", text: "アカウント連携が正常に動作しています。体験ありがとうございました。", size: "sm", color: "#1e293b", wrap: true, margin: "md" },
                  { type: "separator", margin: "lg" },
                  { type: "text", text: "ステップ配信・フォーム即返信・アカウント連携・リッチメニュー・自動返信 — 全て無料、全てOSS。", size: "xs", color: "#64748b", wrap: true, margin: "lg" }
                ]
              },
              footer: {
                type: "box",
                layout: "vertical",
                paddingAll: "16px",
                contents: [
                  { type: "button", action: { type: "message", label: "導入について相談する", text: "導入支援を希望します" }, style: "primary", color: "#06C755" },
                  ...c.env.LIFF_URL ? [{ type: "button", action: { type: "uri", label: "フィードバックを送る", uri: `${c.env.LIFF_URL}?page=form` }, style: "secondary", margin: "sm" }] : []
                ]
              }
            }))]);
          }
          await lineClient.replyMessage(event.replyToken, [buildMessage$3("flex", JSON.stringify({
            type: "bubble",
            body: {
              type: "box",
              layout: "vertical",
              paddingAll: "20px",
              contents: [
                { type: "text", text: "Account ① にメッセージを送りました", size: "sm", color: "#06C755", weight: "bold", align: "center" },
                { type: "text", text: "Account ① のトーク画面を確認してください", size: "xs", color: "#64748b", align: "center", margin: "md" }
              ]
            }
          }))]);
          return;
        }
      } catch (err) {
        console.error("Cross-account trigger error:", err);
      }
    }
    const autoReplyQuery = lineAccountId ? `SELECT * FROM auto_replies WHERE is_active = 1 AND (line_account_id IS NULL OR line_account_id = ?) ORDER BY created_at ASC` : `SELECT * FROM auto_replies WHERE is_active = 1 AND line_account_id IS NULL ORDER BY created_at ASC`;
    const autoReplyStmt = db.prepare(autoReplyQuery);
    const autoReplies = await (lineAccountId ? autoReplyStmt.bind(lineAccountId) : autoReplyStmt).all();
    let matched = false;
    let replyTokenConsumed = false;
    for (const rule of autoReplies.results) {
      const isMatch = rule.match_type === "exact" ? incomingText === rule.keyword : incomingText.includes(rule.keyword);
      if (isMatch) {
        try {
          const expandedContent = expandVariables(rule.response_content, friend, workerUrl);
          const replyMsg = buildMessage$3(rule.response_type, expandedContent);
          await lineClient.replyMessage(event.replyToken, [replyMsg]);
          replyTokenConsumed = true;
          const outLogId = crypto.randomUUID();
          await db.prepare(
            `INSERT INTO messages_log (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, delivery_type, created_at)
               VALUES (?, ?, 'outgoing', ?, ?, NULL, NULL, 'reply', ?)`
          ).bind(outLogId, friend.id, rule.response_type, rule.response_content, jstNow()).run();
        } catch (err) {
          console.error("Failed to send auto-reply", err);
        }
        matched = true;
        break;
      }
    }
    await fireEvent(db, "message_received", {
      friendId: friend.id,
      eventData: { text: incomingText, matched },
      replyToken: replyTokenConsumed ? void 0 : event.replyToken
    }, lineAccessToken, lineAccountId);
    return;
  }
}
const friends = new Hono();
function serializeFriend(row) {
  return {
    id: row.id,
    lineUserId: row.line_user_id,
    displayName: row.display_name,
    pictureUrl: row.picture_url,
    statusMessage: row.status_message,
    isFollowing: Boolean(row.is_following),
    metadata: JSON.parse(row.metadata || "{}"),
    refCode: row.ref_code,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function serializeTag$1(row) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at
  };
}
friends.get("/api/friends", async (c2) => {
  try {
    const limit = Number(c2.req.query("limit") ?? "50");
    const offset = Number(c2.req.query("offset") ?? "0");
    const tagId = c2.req.query("tagId");
    const lineAccountId = c2.req.query("lineAccountId");
    const search = c2.req.query("search");
    const db = c2.env.DB;
    const conditions = [];
    const binds = [];
    if (tagId) {
      conditions.push("EXISTS (SELECT 1 FROM friend_tags ft WHERE ft.friend_id = f.id AND ft.tag_id = ?)");
      binds.push(tagId);
    }
    if (lineAccountId) {
      conditions.push("f.line_account_id = ?");
      binds.push(lineAccountId);
    }
    if (search) {
      conditions.push("f.display_name LIKE ?");
      binds.push(`%${search}%`);
    }
    const url = new URL(c2.req.url);
    for (const [key, value] of url.searchParams.entries()) {
      if (key.startsWith("metadata.")) {
        const metaKey = key.slice("metadata.".length);
        conditions.push(`json_extract(f.metadata, '$.' || ?) = ?`);
        binds.push(metaKey, value);
      }
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM friends f ${where}`);
    const totalRow = await (binds.length > 0 ? countStmt.bind(...binds) : countStmt).first();
    const total = totalRow?.count ?? 0;
    const listStmt = db.prepare(
      `SELECT f.* FROM friends f ${where} ORDER BY f.created_at DESC LIMIT ? OFFSET ?`
    );
    const listBinds = [...binds, limit, offset];
    const listResult = await listStmt.bind(...listBinds).all();
    const items = listResult.results;
    const itemsWithTags = await Promise.all(
      items.map(async (friend) => {
        const tags2 = await getFriendTags(db, friend.id);
        return { ...serializeFriend(friend), tags: tags2.map(serializeTag$1) };
      })
    );
    return c2.json({
      success: true,
      data: {
        items: itemsWithTags,
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        hasNextPage: offset + limit < total
      }
    });
  } catch (err) {
    console.error("GET /api/friends error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
friends.get("/api/friends/count", async (c2) => {
  try {
    const lineAccountId = c2.req.query("lineAccountId");
    let count;
    if (lineAccountId) {
      const row = await c2.env.DB.prepare("SELECT COUNT(*) as count FROM friends WHERE is_following = 1 AND line_account_id = ?").bind(lineAccountId).first();
      count = row?.count ?? 0;
    } else {
      count = await getFriendCount(c2.env.DB);
    }
    return c2.json({ success: true, data: { count } });
  } catch (err) {
    console.error("GET /api/friends/count error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
friends.get("/api/friends/ref-stats", async (c2) => {
  try {
    const lineAccountId = c2.req.query("lineAccountId");
    const where = lineAccountId ? "WHERE line_account_id = ?" : "WHERE ref_code IS NOT NULL";
    const binds = lineAccountId ? [lineAccountId] : [];
    const stmt = c2.env.DB.prepare(
      `SELECT ref_code, COUNT(*) as count FROM friends ${where} AND ref_code IS NOT NULL GROUP BY ref_code ORDER BY count DESC`
    );
    const result = await (binds.length > 0 ? stmt.bind(...binds) : stmt).all();
    const total = await c2.env.DB.prepare(
      `SELECT COUNT(*) as count FROM friends ${lineAccountId ? "WHERE line_account_id = ?" : ""} ${lineAccountId ? "AND" : "WHERE"} ref_code IS NOT NULL`
    ).bind(...lineAccountId ? [lineAccountId] : []).first();
    return c2.json({
      success: true,
      data: {
        routes: result.results.map((r) => ({ refCode: r.ref_code, friendCount: r.count })),
        totalWithRef: total?.count ?? 0
      }
    });
  } catch (err) {
    console.error("GET /api/friends/ref-stats error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
friends.get("/api/friends/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const db = c2.env.DB;
    const [friend, tags2] = await Promise.all([
      getFriendById(db, id),
      getFriendTags(db, id)
    ]);
    if (!friend) {
      return c2.json({ success: false, error: "Friend not found" }, 404);
    }
    return c2.json({
      success: true,
      data: {
        ...serializeFriend(friend),
        tags: tags2.map(serializeTag$1)
      }
    });
  } catch (err) {
    console.error("GET /api/friends/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
friends.post("/api/friends/:id/tags", async (c2) => {
  try {
    const friendId = c2.req.param("id");
    const body = await c2.req.json();
    if (!body.tagId) {
      return c2.json({ success: false, error: "tagId is required" }, 400);
    }
    const db = c2.env.DB;
    await addTagToFriend(db, friendId, body.tagId);
    const allScenarios = await getScenarios(db);
    for (const scenario of allScenarios) {
      if (scenario.trigger_type === "tag_added" && scenario.is_active && scenario.trigger_tag_id === body.tagId) {
        const existing = await db.prepare(`SELECT id FROM friend_scenarios WHERE friend_id = ? AND scenario_id = ?`).bind(friendId, scenario.id).first();
        if (!existing) {
          await enrollFriendInScenario(db, friendId, scenario.id);
        }
      }
    }
    await fireEvent(db, "tag_change", { friendId, eventData: { tagId: body.tagId, action: "add" } });
    return c2.json({ success: true, data: null }, 201);
  } catch (err) {
    console.error("POST /api/friends/:id/tags error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
friends.delete("/api/friends/:id/tags/:tagId", async (c2) => {
  try {
    const friendId = c2.req.param("id");
    const tagId = c2.req.param("tagId");
    await removeTagFromFriend(c2.env.DB, friendId, tagId);
    await fireEvent(c2.env.DB, "tag_change", { friendId, eventData: { tagId, action: "remove" } });
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/friends/:id/tags/:tagId error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
friends.put("/api/friends/:id/metadata", async (c2) => {
  try {
    const friendId = c2.req.param("id");
    const db = c2.env.DB;
    const friend = await getFriendById(db, friendId);
    if (!friend) {
      return c2.json({ success: false, error: "Friend not found" }, 404);
    }
    const body = await c2.req.json();
    const existing = JSON.parse(friend.metadata || "{}");
    const merged = { ...existing, ...body };
    const now = jstNow();
    await db.prepare("UPDATE friends SET metadata = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(merged), now, friendId).run();
    const updated = await getFriendById(db, friendId);
    const tags2 = await getFriendTags(db, friendId);
    return c2.json({
      success: true,
      data: {
        ...serializeFriend(updated),
        tags: tags2.map(serializeTag$1)
      }
    });
  } catch (err) {
    console.error("PUT /api/friends/:id/metadata error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
friends.get("/api/friends/:id/messages", async (c2) => {
  try {
    const friendId = c2.req.param("id");
    const result = await c2.env.DB.prepare(
      `SELECT id, direction, message_type as messageType, content, created_at as createdAt
         FROM messages_log WHERE friend_id = ? ORDER BY created_at ASC LIMIT 200`
    ).bind(friendId).all();
    return c2.json({ success: true, data: result.results });
  } catch (err) {
    console.error("GET /api/friends/:id/messages error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
friends.post("/api/friends/:id/messages", async (c2) => {
  try {
    const friendId = c2.req.param("id");
    const body = await c2.req.json();
    if (!body.content) {
      return c2.json({ success: false, error: "content is required" }, 400);
    }
    const db = c2.env.DB;
    const friend = await getFriendById(db, friendId);
    if (!friend) {
      return c2.json({ success: false, error: "Friend not found" }, 404);
    }
    const { LineClient: LineClient2 } = await import("./index-NYpmBJRY.js");
    let accessToken = c2.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (friend.line_account_id) {
      const { getLineAccountById: getLineAccountById2 } = await import("./index-BFY0hiw7.js");
      const account = await getLineAccountById2(db, friend.line_account_id);
      if (account) accessToken = account.channel_access_token;
    }
    const lineClient = new LineClient2(accessToken);
    const messageType = body.messageType ?? "text";
    const { autoTrackContent } = await import("./auto-track-DLaFv_VQ.js");
    const tracked = await autoTrackContent(
      db,
      messageType,
      body.content,
      c2.env.WORKER_URL || new URL(c2.req.url).origin
    );
    const message = buildMessage$3(tracked.messageType, tracked.content, body.altText);
    await lineClient.pushMessage(friend.line_user_id, [message]);
    const logId = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO messages_log (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, created_at)
         VALUES (?, ?, 'outgoing', ?, ?, NULL, NULL, ?)`
    ).bind(logId, friend.id, messageType, body.content, jstNow()).run();
    return c2.json({ success: true, data: { messageId: logId } });
  } catch (err) {
    console.error("POST /api/friends/:id/messages error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const tags = new Hono();
function serializeTag(row) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at
  };
}
tags.get("/api/tags", async (c2) => {
  try {
    const items = await getTags(c2.env.DB);
    return c2.json({ success: true, data: items.map(serializeTag) });
  } catch (err) {
    console.error("GET /api/tags error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
tags.post("/api/tags", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.name) {
      return c2.json({ success: false, error: "name is required" }, 400);
    }
    const tag = await createTag(c2.env.DB, {
      name: body.name,
      color: body.color
    });
    return c2.json({ success: true, data: serializeTag(tag) }, 201);
  } catch (err) {
    console.error("POST /api/tags error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
tags.delete("/api/tags/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    await deleteTag(c2.env.DB, id);
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/tags/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const scenarios = new Hono();
function serializeScenario(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    triggerType: row.trigger_type,
    triggerTagId: row.trigger_tag_id,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function serializeStep(row) {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    stepOrder: row.step_order,
    delayMinutes: row.delay_minutes,
    messageType: row.message_type,
    messageContent: row.message_content,
    conditionType: row.condition_type ?? null,
    conditionValue: row.condition_value ?? null,
    nextStepOnFalse: row.next_step_on_false ?? null,
    createdAt: row.created_at
  };
}
function serializeFriendScenario(row) {
  return {
    id: row.id,
    friendId: row.friend_id,
    scenarioId: row.scenario_id,
    currentStepOrder: row.current_step_order,
    status: row.status,
    startedAt: row.started_at,
    nextDeliveryAt: row.next_delivery_at,
    updatedAt: row.updated_at
  };
}
scenarios.get("/api/scenarios", async (c2) => {
  try {
    const lineAccountId = c2.req.query("lineAccountId");
    let items;
    if (lineAccountId) {
      const result = await c2.env.DB.prepare(
        `SELECT s.*, COUNT(ss.id) as step_count
           FROM scenarios s
           LEFT JOIN scenario_steps ss ON s.id = ss.scenario_id
           WHERE s.line_account_id = ?
           GROUP BY s.id
           ORDER BY s.created_at DESC`
      ).bind(lineAccountId).all();
      items = result.results;
    } else {
      items = await getScenarios(c2.env.DB);
    }
    return c2.json({
      success: true,
      data: items.map((row) => ({
        ...serializeScenario(row),
        stepCount: row.step_count
      }))
    });
  } catch (err) {
    console.error("GET /api/scenarios error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
scenarios.get("/api/scenarios/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const scenario = await getScenarioById(c2.env.DB, id);
    if (!scenario) {
      return c2.json({ success: false, error: "Scenario not found" }, 404);
    }
    return c2.json({
      success: true,
      data: {
        ...serializeScenario(scenario),
        steps: scenario.steps.map(serializeStep)
      }
    });
  } catch (err) {
    console.error("GET /api/scenarios/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
scenarios.post("/api/scenarios", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.name || !body.triggerType) {
      return c2.json({ success: false, error: "name and triggerType are required" }, 400);
    }
    let scenario = await createScenario(c2.env.DB, {
      name: body.name,
      description: body.description ?? null,
      triggerType: body.triggerType,
      triggerTagId: body.triggerTagId ?? null
    });
    if (body.lineAccountId) {
      await c2.env.DB.prepare(`UPDATE scenarios SET line_account_id = ? WHERE id = ?`).bind(body.lineAccountId, scenario.id).run();
    }
    if (body.isActive === false) {
      const updated = await updateScenario(c2.env.DB, scenario.id, { is_active: 0 });
      if (updated) scenario = updated;
    }
    return c2.json({ success: true, data: serializeScenario(scenario) }, 201);
  } catch (err) {
    console.error("POST /api/scenarios error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
scenarios.put("/api/scenarios/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const body = await c2.req.json();
    const updated = await updateScenario(c2.env.DB, id, {
      name: body.name,
      description: body.description,
      trigger_type: body.triggerType,
      trigger_tag_id: body.triggerTagId,
      is_active: body.isActive !== void 0 ? body.isActive ? 1 : 0 : void 0
    });
    if (!updated) {
      return c2.json({ success: false, error: "Scenario not found" }, 404);
    }
    return c2.json({ success: true, data: serializeScenario(updated) });
  } catch (err) {
    console.error("PUT /api/scenarios/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
scenarios.delete("/api/scenarios/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    await deleteScenario(c2.env.DB, id);
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/scenarios/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
scenarios.post("/api/scenarios/:id/steps", async (c2) => {
  try {
    const scenarioId = c2.req.param("id");
    const body = await c2.req.json();
    if (body.stepOrder === void 0 || !body.messageType || !body.messageContent) {
      return c2.json(
        { success: false, error: "stepOrder, messageType, and messageContent are required" },
        400
      );
    }
    const step = await createScenarioStep(c2.env.DB, {
      scenarioId,
      stepOrder: body.stepOrder,
      delayMinutes: body.delayMinutes ?? 0,
      messageType: body.messageType,
      messageContent: body.messageContent,
      conditionType: body.conditionType ?? null,
      conditionValue: body.conditionValue ?? null,
      nextStepOnFalse: body.nextStepOnFalse ?? null
    });
    return c2.json({ success: true, data: serializeStep(step) }, 201);
  } catch (err) {
    console.error("POST /api/scenarios/:id/steps error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
scenarios.put("/api/scenarios/:id/steps/:stepId", async (c2) => {
  try {
    const stepId = c2.req.param("stepId");
    const body = await c2.req.json();
    const updated = await updateScenarioStep(c2.env.DB, stepId, {
      step_order: body.stepOrder,
      delay_minutes: body.delayMinutes,
      message_type: body.messageType,
      message_content: body.messageContent,
      condition_type: body.conditionType,
      condition_value: body.conditionValue,
      next_step_on_false: body.nextStepOnFalse
    });
    if (!updated) {
      return c2.json({ success: false, error: "Step not found" }, 404);
    }
    return c2.json({ success: true, data: serializeStep(updated) });
  } catch (err) {
    console.error("PUT /api/scenarios/:id/steps/:stepId error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
scenarios.delete("/api/scenarios/:id/steps/:stepId", async (c2) => {
  try {
    const stepId = c2.req.param("stepId");
    await deleteScenarioStep(c2.env.DB, stepId);
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/scenarios/:id/steps/:stepId error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
scenarios.post("/api/scenarios/:id/enroll/:friendId", async (c2) => {
  try {
    const scenarioId = c2.req.param("id");
    const friendId = c2.req.param("friendId");
    const db = c2.env.DB;
    const [scenario, friend] = await Promise.all([
      getScenarioById(db, scenarioId),
      getFriendById(db, friendId)
    ]);
    if (!scenario) {
      return c2.json({ success: false, error: "Scenario not found" }, 404);
    }
    if (!friend) {
      return c2.json({ success: false, error: "Friend not found" }, 404);
    }
    const enrollment = await enrollFriendInScenario(db, friendId, scenarioId);
    return c2.json({ success: true, data: serializeFriendScenario(enrollment) }, 201);
  } catch (err) {
    console.error("POST /api/scenarios/:id/enroll/:friendId error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
function buildSegmentQuery(condition) {
  const bindings = [];
  const clauses = [];
  for (const rule of condition.rules) {
    switch (rule.type) {
      case "tag_exists": {
        if (typeof rule.value !== "string") {
          throw new Error("tag_exists rule requires a string tag ID value");
        }
        clauses.push(
          `EXISTS (SELECT 1 FROM friend_tags ft WHERE ft.friend_id = f.id AND ft.tag_id = ?)`
        );
        bindings.push(rule.value);
        break;
      }
      case "tag_not_exists": {
        if (typeof rule.value !== "string") {
          throw new Error("tag_not_exists rule requires a string tag ID value");
        }
        clauses.push(
          `NOT EXISTS (SELECT 1 FROM friend_tags ft WHERE ft.friend_id = f.id AND ft.tag_id = ?)`
        );
        bindings.push(rule.value);
        break;
      }
      case "metadata_equals": {
        if (typeof rule.value !== "object" || rule.value === null || typeof rule.value.key !== "string" || typeof rule.value.value !== "string") {
          throw new Error("metadata_equals rule requires { key: string; value: string }");
        }
        const mv = rule.value;
        clauses.push(`json_extract(f.metadata, ?) = ?`);
        bindings.push(`$.${mv.key}`, mv.value);
        break;
      }
      case "metadata_not_equals": {
        if (typeof rule.value !== "object" || rule.value === null || typeof rule.value.key !== "string" || typeof rule.value.value !== "string") {
          throw new Error("metadata_not_equals rule requires { key: string; value: string }");
        }
        const mv = rule.value;
        clauses.push(`(json_extract(f.metadata, ?) IS NULL OR json_extract(f.metadata, ?) != ?)`);
        bindings.push(`$.${mv.key}`, `$.${mv.key}`, mv.value);
        break;
      }
      case "ref_code": {
        if (typeof rule.value !== "string") {
          throw new Error("ref_code rule requires a string value");
        }
        clauses.push(`f.ref_code = ?`);
        bindings.push(rule.value);
        break;
      }
      case "is_following": {
        if (typeof rule.value !== "boolean") {
          throw new Error("is_following rule requires a boolean value");
        }
        clauses.push(`f.is_following = ?`);
        bindings.push(rule.value ? 1 : 0);
        break;
      }
      default: {
        const exhaustive = rule.type;
        throw new Error(`Unknown segment rule type: ${exhaustive}`);
      }
    }
  }
  const separator = condition.operator === "AND" ? " AND " : " OR ";
  const where = clauses.length > 0 ? clauses.join(separator) : "1=1";
  const sql = `SELECT f.id, f.line_user_id FROM friends f WHERE ${where}`;
  return { sql, bindings };
}
const MULTICAST_BATCH_SIZE = 500;
async function processSegmentSend(db, lineClient, broadcastId, condition) {
  await updateBroadcastStatus(db, broadcastId, "sending");
  const broadcast = await getBroadcastById(db, broadcastId);
  if (!broadcast) {
    throw new Error(`Broadcast ${broadcastId} not found`);
  }
  const message = buildMessage(broadcast.message_type, broadcast.message_content);
  let totalCount = 0;
  let successCount = 0;
  try {
    const { sql, bindings } = buildSegmentQuery(condition);
    const queryResult = await db.prepare(sql).bind(...bindings).all();
    const friends2 = queryResult.results ?? [];
    totalCount = friends2.length;
    const now = jstNow();
    const totalBatches = Math.ceil(friends2.length / MULTICAST_BATCH_SIZE);
    const unit = `bcast_${broadcast.id.slice(0, 8)}`;
    for (let i = 0; i < friends2.length; i += MULTICAST_BATCH_SIZE) {
      const batchIndex = Math.floor(i / MULTICAST_BATCH_SIZE);
      const batch = friends2.slice(i, i + MULTICAST_BATCH_SIZE);
      const lineUserIds = batch.map((f) => f.line_user_id);
      if (batchIndex > 0) {
        const delay = calculateStaggerDelay(friends2.length, batchIndex);
        await sleep(delay);
      }
      let batchMessage = message;
      if (message.type === "text" && totalBatches > 1) {
        batchMessage = { ...message, text: addMessageVariation(message.text, batchIndex) };
      }
      try {
        await lineClient.multicast(lineUserIds, [batchMessage], [unit]);
        successCount += batch.length;
        for (const friend of batch) {
          const logId = crypto.randomUUID();
          await db.prepare(
            `INSERT INTO messages_log (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, created_at)
               VALUES (?, ?, 'outgoing', ?, ?, ?, NULL, ?)`
          ).bind(logId, friend.id, broadcast.message_type, broadcast.message_content, broadcastId, now).run();
        }
      } catch (err) {
        console.error(`Segment multicast batch ${batchIndex} failed:`, err);
      }
    }
    await updateBroadcastLineRequestId(db, broadcast.id, null, unit);
    await createBroadcastInsight(db, broadcast.id);
    await updateBroadcastStatus(db, broadcastId, "sent", { totalCount, successCount });
  } catch (err) {
    await updateBroadcastStatus(db, broadcastId, "draft");
    throw err;
  }
  return await getBroadcastById(db, broadcastId);
}
function buildMessage(messageType, messageContent, altText) {
  if (messageType === "text") {
    return { type: "text", text: messageContent };
  }
  if (messageType === "image") {
    try {
      const parsed = JSON.parse(messageContent);
      return {
        type: "image",
        originalContentUrl: parsed.originalContentUrl,
        previewImageUrl: parsed.previewImageUrl
      };
    } catch {
      return { type: "text", text: messageContent };
    }
  }
  if (messageType === "flex") {
    try {
      const contents = JSON.parse(messageContent);
      return { type: "flex", altText: altText || extractFlexAltText(contents), contents };
    } catch {
      return { type: "text", text: messageContent };
    }
  }
  return { type: "text", text: messageContent };
}
const broadcasts = new Hono();
function serializeBroadcast(row) {
  return {
    id: row.id,
    title: row.title,
    messageType: row.message_type,
    messageContent: row.message_content,
    targetType: row.target_type,
    targetTagId: row.target_tag_id,
    status: row.status,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    totalCount: row.total_count,
    successCount: row.success_count,
    createdAt: row.created_at
  };
}
broadcasts.get("/api/broadcasts", async (c2) => {
  try {
    const lineAccountId = c2.req.query("lineAccountId");
    let items;
    if (lineAccountId) {
      const result = await c2.env.DB.prepare(`SELECT * FROM broadcasts WHERE line_account_id = ? ORDER BY created_at DESC`).bind(lineAccountId).all();
      items = result.results;
    } else {
      items = await getBroadcasts(c2.env.DB);
    }
    return c2.json({ success: true, data: items.map(serializeBroadcast) });
  } catch (err) {
    console.error("GET /api/broadcasts error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
broadcasts.get("/api/broadcasts/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const broadcast = await getBroadcastById(c2.env.DB, id);
    if (!broadcast) {
      return c2.json({ success: false, error: "Broadcast not found" }, 404);
    }
    return c2.json({ success: true, data: serializeBroadcast(broadcast) });
  } catch (err) {
    console.error("GET /api/broadcasts/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
broadcasts.post("/api/broadcasts", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.title || !body.messageType || !body.messageContent || !body.targetType) {
      return c2.json(
        { success: false, error: "title, messageType, messageContent, and targetType are required" },
        400
      );
    }
    if (body.targetType === "tag" && !body.targetTagId) {
      return c2.json(
        { success: false, error: 'targetTagId is required when targetType is "tag"' },
        400
      );
    }
    const broadcast = await createBroadcast(c2.env.DB, {
      title: body.title,
      messageType: body.messageType,
      messageContent: body.messageContent,
      targetType: body.targetType,
      targetTagId: body.targetTagId ?? null,
      scheduledAt: body.scheduledAt ?? null
    });
    const updates = [];
    const binds = [];
    if (body.lineAccountId) {
      updates.push("line_account_id = ?");
      binds.push(body.lineAccountId);
    }
    if (body.altText) {
      updates.push("alt_text = ?");
      binds.push(body.altText);
    }
    if (updates.length > 0) {
      binds.push(broadcast.id);
      await c2.env.DB.prepare(`UPDATE broadcasts SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();
    }
    return c2.json({ success: true, data: serializeBroadcast(broadcast) }, 201);
  } catch (err) {
    console.error("POST /api/broadcasts error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
broadcasts.put("/api/broadcasts/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const existing = await getBroadcastById(c2.env.DB, id);
    if (!existing) {
      return c2.json({ success: false, error: "Broadcast not found" }, 404);
    }
    if (existing.status !== "draft" && existing.status !== "scheduled") {
      return c2.json({ success: false, error: "Only draft or scheduled broadcasts can be updated" }, 400);
    }
    const body = await c2.req.json();
    let statusUpdate;
    if (body.scheduledAt !== void 0) {
      statusUpdate = body.scheduledAt ? "scheduled" : "draft";
    }
    const updated = await updateBroadcast(c2.env.DB, id, {
      title: body.title,
      message_type: body.messageType,
      message_content: body.messageContent,
      target_type: body.targetType,
      target_tag_id: body.targetTagId,
      scheduled_at: body.scheduledAt,
      ...statusUpdate !== void 0 ? { status: statusUpdate } : {}
    });
    return c2.json({ success: true, data: updated ? serializeBroadcast(updated) : null });
  } catch (err) {
    console.error("PUT /api/broadcasts/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
broadcasts.delete("/api/broadcasts/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    await deleteBroadcast(c2.env.DB, id);
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/broadcasts/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
broadcasts.post("/api/broadcasts/:id/send", async (c2) => {
  try {
    const id = c2.req.param("id");
    const existing = await getBroadcastById(c2.env.DB, id);
    if (!existing) {
      return c2.json({ success: false, error: "Broadcast not found" }, 404);
    }
    if (existing.status === "sending" || existing.status === "sent") {
      return c2.json({ success: false, error: "Broadcast is already sent or sending" }, 400);
    }
    const lineClient = new LineClient(c2.env.LINE_CHANNEL_ACCESS_TOKEN);
    await processBroadcastSend(c2.env.DB, lineClient, id, c2.env.WORKER_URL);
    const result = await getBroadcastById(c2.env.DB, id);
    return c2.json({ success: true, data: result ? serializeBroadcast(result) : null });
  } catch (err) {
    console.error("POST /api/broadcasts/:id/send error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
broadcasts.post("/api/broadcasts/:id/send-segment", async (c2) => {
  try {
    const id = c2.req.param("id");
    const existing = await getBroadcastById(c2.env.DB, id);
    if (!existing) {
      return c2.json({ success: false, error: "Broadcast not found" }, 404);
    }
    if (existing.status === "sending" || existing.status === "sent") {
      return c2.json({ success: false, error: "Broadcast is already sent or sending" }, 400);
    }
    const body = await c2.req.json();
    if (!body.conditions || !body.conditions.operator || !Array.isArray(body.conditions.rules)) {
      return c2.json(
        { success: false, error: "conditions with operator and rules array is required" },
        400
      );
    }
    const lineClient = new LineClient(c2.env.LINE_CHANNEL_ACCESS_TOKEN);
    await processSegmentSend(c2.env.DB, lineClient, id, body.conditions);
    const result = await getBroadcastById(c2.env.DB, id);
    return c2.json({ success: true, data: result ? serializeBroadcast(result) : null });
  } catch (err) {
    console.error("POST /api/broadcasts/:id/send-segment error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const users = new Hono();
function serializeUser(row) {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    externalId: row.external_id,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
users.get("/api/users", async (c2) => {
  try {
    const items = await getUsers(c2.env.DB);
    return c2.json({ success: true, data: items.map(serializeUser) });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
users.get("/api/users/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const user = await getUserById(c2.env.DB, id);
    if (!user) {
      return c2.json({ success: false, error: "User not found" }, 404);
    }
    return c2.json({ success: true, data: serializeUser(user) });
  } catch (err) {
    console.error("GET /api/users/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
users.post("/api/users", async (c2) => {
  try {
    const body = await c2.req.json();
    const user = await createUser(c2.env.DB, body);
    return c2.json({ success: true, data: serializeUser(user) }, 201);
  } catch (err) {
    console.error("POST /api/users error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
users.put("/api/users/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const body = await c2.req.json();
    const updated = await updateUser(c2.env.DB, id, {
      email: body.email,
      phone: body.phone,
      external_id: body.externalId,
      display_name: body.displayName
    });
    if (!updated) {
      return c2.json({ success: false, error: "User not found" }, 404);
    }
    return c2.json({ success: true, data: serializeUser(updated) });
  } catch (err) {
    console.error("PUT /api/users/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
users.delete("/api/users/:id", async (c2) => {
  try {
    await deleteUser(c2.env.DB, c2.req.param("id"));
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/users/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
users.post("/api/users/:id/link", async (c2) => {
  try {
    const userId = c2.req.param("id");
    const body = await c2.req.json();
    if (!body.friendId) {
      return c2.json({ success: false, error: "friendId is required" }, 400);
    }
    await linkFriendToUser(c2.env.DB, body.friendId, userId);
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("POST /api/users/:id/link error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
users.get("/api/users/:id/accounts", async (c2) => {
  try {
    const userId = c2.req.param("id");
    const friends2 = await getUserFriends(c2.env.DB, userId);
    return c2.json({
      success: true,
      data: friends2.map((f) => ({
        id: f.id,
        lineUserId: f.line_user_id,
        displayName: f.display_name,
        isFollowing: Boolean(f.is_following)
      }))
    });
  } catch (err) {
    console.error("GET /api/users/:id/accounts error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
users.post("/api/users/match", async (c2) => {
  try {
    const body = await c2.req.json();
    let user = null;
    if (body.email) {
      user = await getUserByEmail(c2.env.DB, body.email);
    }
    if (!user && body.phone) {
      user = await getUserByPhone(c2.env.DB, body.phone);
    }
    if (!user) {
      return c2.json({ success: false, error: "User not found" }, 404);
    }
    return c2.json({ success: true, data: serializeUser(user) });
  } catch (err) {
    console.error("POST /api/users/match error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
function requireRole(...allowed) {
  return async (c2, next) => {
    const staff2 = c2.get("staff");
    if (!staff2 || !allowed.includes(staff2.role)) {
      return c2.json(
        { success: false, error: `この操作には${allowed[0]}権限が必要です` },
        403
      );
    }
    return next();
  };
}
const lineAccounts = new Hono();
function serializeLineAccount(row) {
  return {
    id: row.id,
    channelId: row.channel_id,
    name: row.name,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
    // Intentionally omit channelAccessToken and channelSecret from list responses
  };
}
function serializeLineAccountFull(row) {
  return {
    ...serializeLineAccount(row),
    channelAccessToken: row.channel_access_token,
    channelSecret: row.channel_secret
  };
}
async function fetchBotProfile(accessToken) {
  try {
    const res = await fetch("https://api.line.me/v2/bot/info", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return {};
    const data = await res.json();
    return { displayName: data.displayName, pictureUrl: data.pictureUrl, basicId: data.basicId };
  } catch {
    return {};
  }
}
lineAccounts.get("/api/line-accounts", async (c2) => {
  try {
    const db = c2.env.DB;
    const items = await getLineAccounts(db);
    const results = await Promise.all(
      items.map(async (item) => {
        const [profile, friendCount, scenarioCount, msgCount] = await Promise.all([
          fetchBotProfile(item.channel_access_token),
          db.prepare(`SELECT COUNT(*) as count FROM friends WHERE is_following = 1 AND line_account_id = ?`).bind(item.id).first(),
          db.prepare(
            `SELECT COUNT(*) as count FROM friend_scenarios fs
             INNER JOIN friends f ON f.id = fs.friend_id
             WHERE fs.status = 'active' AND f.line_account_id = ?`
          ).bind(item.id).first(),
          db.prepare(
            `SELECT COUNT(*) as count FROM messages_log ml
             INNER JOIN friends f ON f.id = ml.friend_id
             WHERE ml.direction = 'outgoing' AND (ml.delivery_type IS NULL OR ml.delivery_type = 'push') AND ml.created_at >= date('now', '-30 days') AND f.line_account_id = ?`
          ).bind(item.id).first()
        ]);
        return {
          ...serializeLineAccount(item),
          displayName: profile.displayName || item.name,
          pictureUrl: profile.pictureUrl || null,
          basicId: profile.basicId || null,
          stats: {
            friendCount: friendCount?.count ?? 0,
            activeScenarios: scenarioCount?.count ?? 0,
            messagesThisMonth: msgCount?.count ?? 0
          }
        };
      })
    );
    return c2.json({ success: true, data: results });
  } catch (err) {
    console.error("GET /api/line-accounts error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
lineAccounts.get("/api/line-accounts/:id", async (c2) => {
  try {
    const account = await getLineAccountById(c2.env.DB, c2.req.param("id"));
    if (!account) {
      return c2.json({ success: false, error: "LINE account not found" }, 404);
    }
    const staff2 = c2.get("staff");
    const data = staff2?.role === "staff" ? serializeLineAccount(account) : serializeLineAccountFull(account);
    return c2.json({ success: true, data });
  } catch (err) {
    console.error("GET /api/line-accounts/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
lineAccounts.post("/api/line-accounts", requireRole("owner"), async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.channelId || !body.name || !body.channelAccessToken || !body.channelSecret) {
      return c2.json(
        { success: false, error: "channelId, name, channelAccessToken, and channelSecret are required" },
        400
      );
    }
    const account = await createLineAccount(c2.env.DB, body);
    return c2.json({ success: true, data: serializeLineAccountFull(account) }, 201);
  } catch (err) {
    console.error("POST /api/line-accounts error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
lineAccounts.put("/api/line-accounts/:id", requireRole("owner"), async (c2) => {
  try {
    const id = c2.req.param("id");
    const body = await c2.req.json();
    const updated = await updateLineAccount(c2.env.DB, id, {
      name: body.name,
      channel_access_token: body.channelAccessToken,
      channel_secret: body.channelSecret,
      is_active: body.isActive !== void 0 ? body.isActive ? 1 : 0 : void 0
    });
    if (!updated) {
      return c2.json({ success: false, error: "LINE account not found" }, 404);
    }
    return c2.json({ success: true, data: serializeLineAccountFull(updated) });
  } catch (err) {
    console.error("PUT /api/line-accounts/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
lineAccounts.delete("/api/line-accounts/:id", requireRole("owner"), async (c2) => {
  try {
    await deleteLineAccount(c2.env.DB, c2.req.param("id"));
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/line-accounts/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const conversions = new Hono();
conversions.get("/api/conversions/points", async (c2) => {
  try {
    const items = await getConversionPoints(c2.env.DB);
    return c2.json({
      success: true,
      data: items.map((p) => ({
        id: p.id,
        name: p.name,
        eventType: p.event_type,
        value: p.value,
        createdAt: p.created_at
      }))
    });
  } catch (err) {
    console.error("GET /api/conversions/points error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
conversions.post("/api/conversions/points", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.name || !body.eventType) {
      return c2.json({ success: false, error: "name and eventType are required" }, 400);
    }
    const point = await createConversionPoint(c2.env.DB, body);
    return c2.json({
      success: true,
      data: {
        id: point.id,
        name: point.name,
        eventType: point.event_type,
        value: point.value,
        createdAt: point.created_at
      }
    }, 201);
  } catch (err) {
    console.error("POST /api/conversions/points error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
conversions.delete("/api/conversions/points/:id", async (c2) => {
  try {
    await deleteConversionPoint(c2.env.DB, c2.req.param("id"));
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/conversions/points/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
conversions.post("/api/conversions/track", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.conversionPointId || !body.friendId) {
      return c2.json(
        { success: false, error: "conversionPointId and friendId are required" },
        400
      );
    }
    const event = await trackConversion(c2.env.DB, {
      conversionPointId: body.conversionPointId,
      friendId: body.friendId,
      userId: body.userId,
      affiliateCode: body.affiliateCode,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null
    });
    return c2.json({
      success: true,
      data: {
        id: event.id,
        conversionPointId: event.conversion_point_id,
        friendId: event.friend_id,
        userId: event.user_id,
        affiliateCode: event.affiliate_code,
        metadata: event.metadata,
        createdAt: event.created_at
      }
    }, 201);
  } catch (err) {
    console.error("POST /api/conversions/track error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
conversions.get("/api/conversions/events", async (c2) => {
  try {
    const events = await getConversionEvents(c2.env.DB, {
      conversionPointId: c2.req.query("conversionPointId"),
      friendId: c2.req.query("friendId"),
      affiliateCode: c2.req.query("affiliateCode"),
      startDate: c2.req.query("startDate"),
      endDate: c2.req.query("endDate"),
      limit: Number(c2.req.query("limit") ?? "100"),
      offset: Number(c2.req.query("offset") ?? "0")
    });
    return c2.json({
      success: true,
      data: events.map((e) => ({
        id: e.id,
        conversionPointId: e.conversion_point_id,
        friendId: e.friend_id,
        userId: e.user_id,
        affiliateCode: e.affiliate_code,
        metadata: e.metadata,
        createdAt: e.created_at
      }))
    });
  } catch (err) {
    console.error("GET /api/conversions/events error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
conversions.get("/api/conversions/report", async (c2) => {
  try {
    const report = await getConversionReport(c2.env.DB, {
      startDate: c2.req.query("startDate"),
      endDate: c2.req.query("endDate")
    });
    return c2.json({ success: true, data: report });
  } catch (err) {
    console.error("GET /api/conversions/report error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const affiliates = new Hono();
function serializeAffiliate(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    commissionRate: row.commission_rate,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at
  };
}
affiliates.get("/api/affiliates", async (c2) => {
  try {
    const items = await getAffiliates(c2.env.DB);
    return c2.json({ success: true, data: items.map(serializeAffiliate) });
  } catch (err) {
    console.error("GET /api/affiliates error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
affiliates.get("/api/affiliates/:id", async (c2) => {
  try {
    const item = await getAffiliateById(c2.env.DB, c2.req.param("id"));
    if (!item) {
      return c2.json({ success: false, error: "Affiliate not found" }, 404);
    }
    return c2.json({ success: true, data: serializeAffiliate(item) });
  } catch (err) {
    console.error("GET /api/affiliates/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
affiliates.post("/api/affiliates", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.name || !body.code) {
      return c2.json({ success: false, error: "name and code are required" }, 400);
    }
    const item = await createAffiliate(c2.env.DB, body);
    return c2.json({ success: true, data: serializeAffiliate(item) }, 201);
  } catch (err) {
    console.error("POST /api/affiliates error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
affiliates.put("/api/affiliates/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const body = await c2.req.json();
    const updated = await updateAffiliate(c2.env.DB, id, {
      name: body.name,
      commission_rate: body.commissionRate,
      is_active: body.isActive !== void 0 ? body.isActive ? 1 : 0 : void 0
    });
    if (!updated) {
      return c2.json({ success: false, error: "Affiliate not found" }, 404);
    }
    return c2.json({ success: true, data: serializeAffiliate(updated) });
  } catch (err) {
    console.error("PUT /api/affiliates/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
affiliates.delete("/api/affiliates/:id", async (c2) => {
  try {
    await deleteAffiliate(c2.env.DB, c2.req.param("id"));
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/affiliates/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
affiliates.get("/api/affiliates/:id/report", async (c2) => {
  try {
    const report = await getAffiliateReport(c2.env.DB, c2.req.param("id"), {
      startDate: c2.req.query("startDate"),
      endDate: c2.req.query("endDate")
    });
    if (report.length === 0) {
      return c2.json({ success: false, error: "Affiliate not found" }, 404);
    }
    return c2.json({ success: true, data: report[0] });
  } catch (err) {
    console.error("GET /api/affiliates/:id/report error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
affiliates.post("/api/affiliates/click", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.code) {
      return c2.json({ success: false, error: "code is required" }, 400);
    }
    const affiliate = await getAffiliateByCode(c2.env.DB, body.code);
    if (!affiliate) {
      return c2.json({ success: false, error: "Affiliate not found" }, 404);
    }
    const ipAddress = c2.req.header("CF-Connecting-IP") ?? c2.req.header("X-Forwarded-For") ?? null;
    await recordAffiliateClick(c2.env.DB, affiliate.id, body.url, ipAddress);
    return c2.json({ success: true, data: null }, 201);
  } catch (err) {
    console.error("POST /api/affiliates/click error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
affiliates.get("/api/affiliates-report", async (c2) => {
  try {
    const report = await getAffiliateReport(c2.env.DB, void 0, {
      startDate: c2.req.query("startDate"),
      endDate: c2.req.query("endDate")
    });
    return c2.json({ success: true, data: report });
  } catch (err) {
    console.error("GET /api/affiliates-report error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const openapi = new Hono();
const spec = {
  openapi: "3.1.0",
  info: {
    title: "LINE OSS CRM API",
    version: "0.2.0",
    description: "Open-source LINE Official Account CRM/marketing automation API. API-first design for Claude Code / AI agent integration.",
    license: { name: "MIT" }
  },
  servers: [{ url: "/", description: "Current server" }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "API Key passed as Bearer token"
      }
    },
    schemas: {
      ApiResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {},
          error: { type: "string" }
        }
      },
      Friend: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          lineUserId: { type: "string" },
          displayName: { type: "string", nullable: true },
          pictureUrl: { type: "string", nullable: true },
          statusMessage: { type: "string", nullable: true },
          isFollowing: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          tags: { type: "array", items: { $ref: "#/components/schemas/Tag" } }
        }
      },
      Tag: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          color: { type: "string" },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      Scenario: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          triggerType: { type: "string", enum: ["friend_add", "tag_added", "manual"] },
          triggerTagId: { type: "string", nullable: true },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      ScenarioStep: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          scenarioId: { type: "string" },
          stepOrder: { type: "integer" },
          delayMinutes: { type: "integer" },
          messageType: { type: "string", enum: ["text", "image", "flex"] },
          messageContent: { type: "string" },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      Broadcast: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string" },
          messageType: { type: "string", enum: ["text", "image", "flex"] },
          messageContent: { type: "string" },
          targetType: { type: "string", enum: ["all", "tag"] },
          targetTagId: { type: "string", nullable: true },
          status: { type: "string", enum: ["draft", "scheduled", "sending", "sent"] },
          scheduledAt: { type: "string", nullable: true },
          sentAt: { type: "string", nullable: true },
          totalCount: { type: "integer" },
          successCount: { type: "integer" },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", nullable: true },
          phone: { type: "string", nullable: true },
          externalId: { type: "string", nullable: true },
          displayName: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      LineAccount: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          channelId: { type: "string" },
          name: { type: "string" },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      ConversionPoint: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          eventType: { type: "string" },
          value: { type: "number", nullable: true },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      ConversionEvent: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          conversionPointId: { type: "string" },
          friendId: { type: "string" },
          userId: { type: "string", nullable: true },
          affiliateCode: { type: "string", nullable: true },
          metadata: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      Affiliate: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          code: { type: "string" },
          commissionRate: { type: "number" },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      AffiliateReport: {
        type: "object",
        properties: {
          affiliateId: { type: "string" },
          affiliateName: { type: "string" },
          code: { type: "string" },
          commissionRate: { type: "number" },
          totalClicks: { type: "integer" },
          totalConversions: { type: "integer" },
          totalRevenue: { type: "number" }
        }
      }
    }
  },
  paths: {
    // ── Friends ─────────────────────────────────────────────────────────────
    "/api/friends": {
      get: {
        tags: ["Friends"],
        summary: "友だち一覧取得",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          { name: "tagId", in: "query", schema: { type: "string" } }
        ],
        responses: { "200": { description: "Paginated friends list" } }
      }
    },
    "/api/friends/count": {
      get: { tags: ["Friends"], summary: "友だち数取得", responses: { "200": { description: "Count" } } }
    },
    "/api/friends/{id}": {
      get: {
        tags: ["Friends"],
        summary: "友だち詳細取得",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Friend with tags" }, "404": { description: "Not found" } }
      }
    },
    "/api/friends/{id}/tags": {
      post: {
        tags: ["Friends"],
        summary: "友だちにタグ追加",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { tagId: { type: "string" } }, required: ["tagId"] } } } },
        responses: { "201": { description: "Tag added" } }
      }
    },
    "/api/friends/{id}/tags/{tagId}": {
      delete: {
        tags: ["Friends"],
        summary: "友だちからタグ削除",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "tagId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "Tag removed" } }
      }
    },
    // ── Tags ────────────────────────────────────────────────────────────────
    "/api/tags": {
      get: { tags: ["Tags"], summary: "タグ一覧取得", responses: { "200": { description: "All tags" } } },
      post: {
        tags: ["Tags"],
        summary: "タグ作成",
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, color: { type: "string" } }, required: ["name"] } } } },
        responses: { "201": { description: "Tag created" } }
      }
    },
    "/api/tags/{id}": {
      delete: {
        tags: ["Tags"],
        summary: "タグ削除",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Tag deleted" } }
      }
    },
    // ── Scenarios ────────────────────────────────────────────────────────────
    "/api/scenarios": {
      get: { tags: ["Scenarios"], summary: "シナリオ一覧取得", responses: { "200": { description: "All scenarios" } } },
      post: {
        tags: ["Scenarios"],
        summary: "シナリオ作成",
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, triggerType: { type: "string" }, description: { type: "string" }, triggerTagId: { type: "string" }, isActive: { type: "boolean" } }, required: ["name", "triggerType"] } } } },
        responses: { "201": { description: "Scenario created" } }
      }
    },
    "/api/scenarios/{id}": {
      get: {
        tags: ["Scenarios"],
        summary: "シナリオ詳細取得 (ステップ含む)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Scenario with steps" } }
      },
      put: {
        tags: ["Scenarios"],
        summary: "シナリオ更新",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Updated" } }
      },
      delete: {
        tags: ["Scenarios"],
        summary: "シナリオ削除",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Deleted" } }
      }
    },
    "/api/scenarios/{id}/steps": {
      post: {
        tags: ["Scenarios"],
        summary: "ステップ追加",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "201": { description: "Step created" } }
      }
    },
    "/api/scenarios/{id}/steps/{stepId}": {
      put: {
        tags: ["Scenarios"],
        summary: "ステップ更新",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "stepId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "Updated" } }
      },
      delete: {
        tags: ["Scenarios"],
        summary: "ステップ削除",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "stepId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "Deleted" } }
      }
    },
    "/api/scenarios/{id}/enroll/{friendId}": {
      post: {
        tags: ["Scenarios"],
        summary: "手動エンロール",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "friendId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "201": { description: "Enrolled" } }
      }
    },
    // ── Broadcasts ───────────────────────────────────────────────────────────
    "/api/broadcasts": {
      get: { tags: ["Broadcasts"], summary: "配信一覧取得", responses: { "200": { description: "All broadcasts" } } },
      post: {
        tags: ["Broadcasts"],
        summary: "配信作成",
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { title: { type: "string" }, messageType: { type: "string" }, messageContent: { type: "string" }, targetType: { type: "string" }, targetTagId: { type: "string" }, scheduledAt: { type: "string" } }, required: ["title", "messageType", "messageContent", "targetType"] } } } },
        responses: { "201": { description: "Broadcast created" } }
      }
    },
    "/api/broadcasts/{id}": {
      get: {
        tags: ["Broadcasts"],
        summary: "配信詳細取得",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Broadcast" } }
      },
      put: { tags: ["Broadcasts"], summary: "配信更新", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated" } } },
      delete: { tags: ["Broadcasts"], summary: "配信削除", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } }
    },
    "/api/broadcasts/{id}/send": {
      post: {
        tags: ["Broadcasts"],
        summary: "即時配信",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Sent" } }
      }
    },
    // ── Users (UUID Cross-Account) ──────────────────────────────────────────
    "/api/users": {
      get: { tags: ["Users"], summary: "内部ユーザー一覧取得", responses: { "200": { description: "All users" } } },
      post: {
        tags: ["Users"],
        summary: "内部ユーザー作成",
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { email: { type: "string" }, phone: { type: "string" }, externalId: { type: "string" }, displayName: { type: "string" } } } } } },
        responses: { "201": { description: "User created" } }
      }
    },
    "/api/users/match": {
      post: {
        tags: ["Users"],
        summary: "メール/電話でユーザー検索",
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { email: { type: "string" }, phone: { type: "string" } } } } } },
        responses: { "200": { description: "Matched user" }, "404": { description: "Not found" } }
      }
    },
    "/api/users/{id}": {
      get: { tags: ["Users"], summary: "ユーザー詳細取得", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "User" } } },
      put: { tags: ["Users"], summary: "ユーザー更新", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated" } } },
      delete: { tags: ["Users"], summary: "ユーザー削除", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } }
    },
    "/api/users/{id}/link": {
      post: {
        tags: ["Users"],
        summary: "友だちをUUIDにリンク",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { friendId: { type: "string" } }, required: ["friendId"] } } } },
        responses: { "200": { description: "Linked" } }
      }
    },
    "/api/users/{id}/accounts": {
      get: {
        tags: ["Users"],
        summary: "UUID紐付き友だち一覧",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Linked friends/accounts" } }
      }
    },
    // ── LINE Accounts ───────────────────────────────────────────────────────
    "/api/line-accounts": {
      get: { tags: ["LINE Accounts"], summary: "LINEアカウント一覧", responses: { "200": { description: "All LINE accounts" } } },
      post: {
        tags: ["LINE Accounts"],
        summary: "LINEアカウント登録",
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { channelId: { type: "string" }, name: { type: "string" }, channelAccessToken: { type: "string" }, channelSecret: { type: "string" } }, required: ["channelId", "name", "channelAccessToken", "channelSecret"] } } } },
        responses: { "201": { description: "Account created" } }
      }
    },
    "/api/line-accounts/{id}": {
      get: { tags: ["LINE Accounts"], summary: "LINEアカウント詳細", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Account" } } },
      put: { tags: ["LINE Accounts"], summary: "LINEアカウント更新", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated" } } },
      delete: { tags: ["LINE Accounts"], summary: "LINEアカウント削除", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } }
    },
    // ── Conversions ─────────────────────────────────────────────────────────
    "/api/conversions/points": {
      get: { tags: ["Conversions"], summary: "CV ポイント一覧", responses: { "200": { description: "All conversion points" } } },
      post: {
        tags: ["Conversions"],
        summary: "CV ポイント作成",
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, eventType: { type: "string" }, value: { type: "number" } }, required: ["name", "eventType"] } } } },
        responses: { "201": { description: "Created" } }
      }
    },
    "/api/conversions/points/{id}": {
      delete: {
        tags: ["Conversions"],
        summary: "CV ポイント削除",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Deleted" } }
      }
    },
    "/api/conversions/track": {
      post: {
        tags: ["Conversions"],
        summary: "コンバージョン記録",
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { conversionPointId: { type: "string" }, friendId: { type: "string" }, userId: { type: "string" }, affiliateCode: { type: "string" }, metadata: { type: "object" } }, required: ["conversionPointId", "friendId"] } } } },
        responses: { "201": { description: "Tracked" } }
      }
    },
    "/api/conversions/events": {
      get: {
        tags: ["Conversions"],
        summary: "CV イベント一覧",
        parameters: [
          { name: "conversionPointId", in: "query", schema: { type: "string" } },
          { name: "friendId", in: "query", schema: { type: "string" } },
          { name: "affiliateCode", in: "query", schema: { type: "string" } },
          { name: "startDate", in: "query", schema: { type: "string" } },
          { name: "endDate", in: "query", schema: { type: "string" } }
        ],
        responses: { "200": { description: "Events" } }
      }
    },
    "/api/conversions/report": {
      get: {
        tags: ["Conversions"],
        summary: "CV レポート",
        parameters: [
          { name: "startDate", in: "query", schema: { type: "string" } },
          { name: "endDate", in: "query", schema: { type: "string" } }
        ],
        responses: { "200": { description: "Aggregated report" } }
      }
    },
    // ── Affiliates ──────────────────────────────────────────────────────────
    "/api/affiliates": {
      get: { tags: ["Affiliates"], summary: "アフィリエイト一覧", responses: { "200": { description: "All affiliates" } } },
      post: {
        tags: ["Affiliates"],
        summary: "アフィリエイト作成",
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, code: { type: "string" }, commissionRate: { type: "number" } }, required: ["name", "code"] } } } },
        responses: { "201": { description: "Created" } }
      }
    },
    "/api/affiliates/{id}": {
      get: { tags: ["Affiliates"], summary: "アフィリエイト詳細", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Affiliate" } } },
      put: { tags: ["Affiliates"], summary: "アフィリエイト更新", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated" } } },
      delete: { tags: ["Affiliates"], summary: "アフィリエイト削除", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" } } }
    },
    "/api/affiliates/{id}/report": {
      get: {
        tags: ["Affiliates"],
        summary: "アフィリエイトレポート",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "startDate", in: "query", schema: { type: "string" } },
          { name: "endDate", in: "query", schema: { type: "string" } }
        ],
        responses: { "200": { description: "Report" } }
      }
    },
    "/api/affiliates/click": {
      post: {
        tags: ["Affiliates"],
        summary: "クリック記録",
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { code: { type: "string" }, url: { type: "string" } }, required: ["code"] } } } },
        responses: { "201": { description: "Recorded" } }
      }
    },
    // ── Webhook ─────────────────────────────────────────────────────────────
    "/webhook": {
      post: {
        tags: ["Webhook"],
        summary: "LINE Messaging API Webhook",
        description: "LINE プラットフォームからのWebhookイベントを受信。署名検証あり、常に200を返す。",
        security: [],
        responses: { "200": { description: "OK" } }
      }
    }
  },
  tags: [
    { name: "Friends", description: "友だち管理" },
    { name: "Tags", description: "タグ管理" },
    { name: "Scenarios", description: "ステップ配信シナリオ" },
    { name: "Broadcasts", description: "一斉配信" },
    { name: "Users", description: "UUID Cross-Account ユーザー管理" },
    { name: "LINE Accounts", description: "マルチLINEアカウント管理" },
    { name: "Conversions", description: "コンバージョン計測" },
    { name: "Affiliates", description: "アフィリエイト管理" },
    { name: "Webhook", description: "LINE Webhook" }
  ]
};
openapi.get("/openapi.json", (c2) => {
  return c2.json(spec);
});
openapi.get("/docs", (c2) => {
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LINE CRM API Docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"><\/script>
  <script>
    SwaggerUIBundle({
      url: '/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
    });
  <\/script>
</body>
</html>`;
  return c2.html(html);
});
const liffRoutes = new Hono();
liffRoutes.get("/auth/line", async (c2) => {
  const ref = c2.req.query("ref") || "";
  const redirect = c2.req.query("redirect") || "";
  const gclid = c2.req.query("gclid") || "";
  const fbclid = c2.req.query("fbclid") || "";
  const twclid = c2.req.query("twclid") || "";
  const ttclid = c2.req.query("ttclid") || "";
  const utmSource = c2.req.query("utm_source") || "";
  const utmMedium = c2.req.query("utm_medium") || "";
  const utmCampaign = c2.req.query("utm_campaign") || "";
  const accountParam = c2.req.query("account") || "";
  const uidParam = c2.req.query("uid") || "";
  const baseUrl = new URL(c2.req.url).origin;
  let channelId = c2.env.LINE_LOGIN_CHANNEL_ID;
  let liffUrl = c2.env.LIFF_URL;
  if (accountParam) {
    const account = await getLineAccountByChannelId(c2.env.DB, accountParam);
    if (account?.login_channel_id) {
      channelId = account.login_channel_id;
    }
    if (account?.liff_id) {
      liffUrl = `https://liff.line.me/${account.liff_id}`;
    }
  }
  const callbackUrl = `${baseUrl}/auth/callback`;
  const externalRef = ref.startsWith("xh:") ? "" : ref;
  const liffIdMatch = liffUrl.match(/liff\.line\.me\/([0-9]+-[A-Za-z0-9]+)/);
  const liffParams = new URLSearchParams();
  if (liffIdMatch) liffParams.set("liffId", liffIdMatch[1]);
  if (externalRef) liffParams.set("ref", externalRef);
  if (redirect) liffParams.set("redirect", redirect);
  if (gclid) liffParams.set("gclid", gclid);
  if (fbclid) liffParams.set("fbclid", fbclid);
  if (twclid) liffParams.set("twclid", twclid);
  if (ttclid) liffParams.set("ttclid", ttclid);
  if (utmSource) liffParams.set("utm_source", utmSource);
  liffParams.toString() ? `${liffUrl}?${liffParams.toString()}` : liffUrl;
  const state = JSON.stringify({ ref, redirect, gclid, fbclid, twclid, ttclid, utmSource, utmMedium, utmCampaign, account: accountParam, uid: uidParam });
  const encodedState = btoa(state);
  const loginUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  loginUrl.searchParams.set("response_type", "code");
  loginUrl.searchParams.set("client_id", channelId);
  loginUrl.searchParams.set("redirect_uri", callbackUrl);
  loginUrl.searchParams.set("scope", "profile openid email");
  loginUrl.searchParams.set("bot_prompt", "aggressive");
  loginUrl.searchParams.set("state", encodedState);
  const qrParams = new URLSearchParams();
  if (externalRef) qrParams.set("ref", externalRef);
  if (uidParam) qrParams.set("uid", uidParam);
  if (accountParam) qrParams.set("account", accountParam);
  const qrUrl = qrParams.toString() ? `${liffUrl}?${qrParams.toString()}` : liffUrl;
  const ua = (c2.req.header("user-agent") || "").toLowerCase();
  const isMobile = /iphone|ipad|android|mobile/.test(ua);
  if (isMobile) {
    if (accountParam) {
      return c2.redirect(loginUrl.toString());
    }
    return c2.redirect(qrUrl);
  }
  return c2.html(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LINE で友だち追加</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Hiragino Sans', system-ui, sans-serif; background: #0d1117; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 48px; text-align: center; max-width: 480px; width: 90%; }
    h1 { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
    .sub { font-size: 14px; color: rgba(255,255,255,0.5); margin-bottom: 32px; }
    .qr { background: #fff; border-radius: 16px; padding: 24px; display: inline-block; margin-bottom: 24px; }
    .qr img { display: block; width: 240px; height: 240px; }
    .hint { font-size: 13px; color: rgba(255,255,255,0.4); line-height: 1.6; }
    .badge { display: inline-block; margin-top: 24px; padding: 8px 20px; border-radius: 20px; font-size: 12px; font-weight: 600; color: #06C755; background: rgba(6,199,85,0.1); border: 1px solid rgba(6,199,85,0.2); }
  </style>
</head>
<body>
  <div class="card">
    <h1>全機能を使う（0円）</h1>
    <p class="sub">スマートフォンで QR コードを読み取ってください</p>
    <div class="qr">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrUrl)}" alt="QR Code">
    </div>
    <p class="hint">LINE アプリのカメラまたは<br>スマートフォンのカメラで読み取れます</p>
    <div class="badge">LINE Harness OSS</div>
  </div>
</body>
</html>`);
});
liffRoutes.get("/auth/callback", async (c2) => {
  const code = c2.req.query("code");
  const stateParam = c2.req.query("state") || "";
  const error = c2.req.query("error");
  let ref = "";
  let redirect = "";
  let gclid = "";
  let fbclid = "";
  let twclid = "";
  let ttclid = "";
  let utmSource = "";
  let utmMedium = "";
  let utmCampaign = "";
  let accountParam = "";
  let uidParam = "";
  try {
    const parsed = JSON.parse(atob(stateParam));
    ref = parsed.ref || "";
    redirect = parsed.redirect || "";
    gclid = parsed.gclid || "";
    fbclid = parsed.fbclid || "";
    twclid = parsed.twclid || "";
    ttclid = parsed.ttclid || "";
    utmSource = parsed.utmSource || "";
    utmMedium = parsed.utmMedium || "";
    utmCampaign = parsed.utmCampaign || "";
    accountParam = parsed.account || "";
    uidParam = parsed.uid || "";
  } catch {
  }
  if (error || !code) {
    return c2.html(errorPage(error || "Authorization failed"));
  }
  try {
    const baseUrl = new URL(c2.req.url).origin;
    const callbackUrl = `${baseUrl}/auth/callback`;
    let loginChannelId = c2.env.LINE_LOGIN_CHANNEL_ID;
    let loginChannelSecret = c2.env.LINE_LOGIN_CHANNEL_SECRET;
    if (accountParam) {
      const account = await getLineAccountByChannelId(c2.env.DB, accountParam);
      if (account?.login_channel_id && account?.login_channel_secret) {
        loginChannelId = account.login_channel_id;
        loginChannelSecret = account.login_channel_secret;
      }
    }
    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl,
        client_id: loginChannelId,
        client_secret: loginChannelSecret
      })
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Token exchange failed:", errText);
      return c2.html(errorPage("Token exchange failed"));
    }
    const tokens = await tokenRes.json();
    const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        id_token: tokens.id_token,
        client_id: loginChannelId
      })
    });
    if (!verifyRes.ok) {
      return c2.html(errorPage("ID token verification failed"));
    }
    const verified = await verifyRes.json();
    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    let displayName = verified.name || "Unknown";
    let pictureUrl = null;
    if (profileRes.ok) {
      const profile = await profileRes.json();
      displayName = profile.displayName;
      pictureUrl = profile.pictureUrl || null;
    }
    const db = c2.env.DB;
    const lineUserId = verified.sub;
    const friend = await upsertFriend(db, {
      lineUserId,
      displayName,
      pictureUrl,
      statusMessage: null
    });
    let userId = null;
    const existingUserId = friend.user_id;
    if (existingUserId) {
      userId = existingUserId;
    } else {
      if (uidParam) {
        userId = uidParam;
      }
      if (!userId && verified.email) {
        const existingUser = await getUserByEmail(db, verified.email);
        if (existingUser) userId = existingUser.id;
      }
      if (!userId) {
        const newUser = await createUser(db, {
          email: verified.email || null,
          displayName
        });
        userId = newUser.id;
      }
      await linkFriendToUser(db, friend.id, userId);
    }
    if (ref && !ref.startsWith("xh:")) {
      await db.prepare(`UPDATE friends SET ref_code = ? WHERE id = ? AND ref_code IS NULL`).bind(ref, friend.id).run();
      const route = await getEntryRouteByRefCode(db, ref);
      await recordRefTracking(db, {
        refCode: ref,
        friendId: friend.id,
        entryRouteId: route?.id ?? null,
        sourceUrl: null,
        fbclid: fbclid || null,
        gclid: gclid || null,
        twclid: twclid || null,
        ttclid: ttclid || null,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        userAgent: c2.req.header("User-Agent") || null,
        ipAddress: c2.req.header("CF-Connecting-IP") || null
      });
      if (route) {
        if (route.tag_id) {
          await addTagToFriend(db, friend.id, route.tag_id);
        }
      }
    }
    const adMeta = {};
    if (gclid) adMeta.gclid = gclid;
    if (fbclid) adMeta.fbclid = fbclid;
    if (twclid) adMeta.twclid = twclid;
    if (ttclid) adMeta.ttclid = ttclid;
    if (utmSource) adMeta.utm_source = utmSource;
    if (utmMedium) adMeta.utm_medium = utmMedium;
    if (utmCampaign) adMeta.utm_campaign = utmCampaign;
    if (Object.keys(adMeta).length > 0) {
      const existingMeta = await db.prepare("SELECT metadata FROM friends WHERE id = ?").bind(friend.id).first();
      const merged = { ...JSON.parse(existingMeta?.metadata || "{}"), ...adMeta };
      await db.prepare("UPDATE friends SET metadata = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(merged), jstNow(), friend.id).run();
    }
    if (ref && ref.startsWith("xh:")) {
      try {
        const xhToken = ref.slice(3);
        const xhResult = await resolveXHarnessToken(xhToken, c2.env);
        if (xhResult?.xUsername) {
          const existingMeta = await db.prepare("SELECT metadata FROM friends WHERE id = ?").bind(friend.id).first();
          const meta = JSON.parse(existingMeta?.metadata || "{}");
          meta.x_username = xhResult.xUsername;
          await db.prepare("UPDATE friends SET metadata = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(meta), jstNow(), friend.id).run();
          console.log(`X Harness: linked @${xhResult.xUsername} to friend ${friend.id}`);
        }
        if (xhResult) {
          await applyXHarnessActions(db, friend.id, xhResult);
        }
      } catch (err) {
        console.error("X Harness token resolution error (non-blocking):", err);
      }
    }
    try {
      const { getScenarios: getScenarios2, enrollFriendInScenario: enroll, getScenarioSteps: getScenarioSteps2 } = await import("./index-BFY0hiw7.js");
      const { LineClient: LineClient2 } = await import("./index-NYpmBJRY.js");
      const { buildMessage: buildMessage2, expandVariables: expandVariables2 } = await Promise.resolve().then(() => stepDelivery);
      const matchedAccountId = accountParam ? (await getLineAccountByChannelId(db, accountParam))?.id ?? null : null;
      let accessToken = c2.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (accountParam) {
        const acct = await getLineAccountByChannelId(db, accountParam);
        if (acct) accessToken = acct.channel_access_token;
      }
      const lineClient = new LineClient2(accessToken);
      const scenarios2 = await getScenarios2(db);
      for (const scenario of scenarios2) {
        const scenarioAccountMatch = !scenario.line_account_id || !matchedAccountId || scenario.line_account_id === matchedAccountId;
        if (scenario.trigger_type === "friend_add" && scenario.is_active && scenarioAccountMatch) {
          const existing = await db.prepare("SELECT id FROM friend_scenarios WHERE friend_id = ? AND scenario_id = ?").bind(friend.id, scenario.id).first();
          if (!existing) {
            await enroll(db, friend.id, scenario.id);
            const steps = await getScenarioSteps2(db, scenario.id);
            const firstStep = steps[0];
            if (firstStep && firstStep.delay_minutes === 0) {
              const expandedContent = expandVariables2(
                firstStep.message_content,
                friend,
                c2.env.WORKER_URL
              );
              await lineClient.pushMessage(lineUserId, [buildMessage2(firstStep.message_type, expandedContent)]);
            }
          }
        }
      }
    } catch (err) {
      console.error("OAuth scenario enrollment error:", err);
    }
    if (redirect) {
      return c2.redirect(redirect);
    }
    let redirectAccount = null;
    if (accountParam) {
      redirectAccount = await getLineAccountByChannelId(db, accountParam);
    }
    if (!redirectAccount) {
      redirectAccount = await db.prepare("SELECT * FROM line_accounts WHERE login_channel_id = ?").bind(loginChannelId).first();
    }
    if (!redirectAccount) {
      redirectAccount = await db.prepare("SELECT * FROM line_accounts WHERE is_active = 1 LIMIT 1").first();
    }
    if (redirectAccount?.channel_access_token) {
      try {
        const botInfo = await fetch("https://api.line.me/v2/bot/info", {
          headers: { Authorization: `Bearer ${redirectAccount.channel_access_token}` }
        });
        if (botInfo.ok) {
          const bot = await botInfo.json();
          if (bot.basicId) {
            return c2.redirect(`https://line.me/R/ti/p/${bot.basicId}`);
          }
        }
      } catch {
      }
    }
    return c2.html(completionPage(displayName, pictureUrl, ref));
  } catch (err) {
    console.error("Auth callback error:", err);
    return c2.html(errorPage("Internal error"));
  }
});
liffRoutes.post("/api/liff/profile", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.lineUserId) {
      return c2.json({ success: false, error: "lineUserId is required" }, 400);
    }
    const friend = await getFriendByLineUserId(c2.env.DB, body.lineUserId);
    if (!friend) {
      return c2.json({ success: false, error: "Friend not found" }, 404);
    }
    return c2.json({
      success: true,
      data: {
        id: friend.id,
        displayName: friend.display_name,
        isFollowing: Boolean(friend.is_following),
        userId: friend.user_id ?? null
      }
    });
  } catch (err) {
    console.error("POST /api/liff/profile error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
liffRoutes.post("/api/liff/link", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.idToken) {
      return c2.json({ success: false, error: "idToken is required" }, 400);
    }
    const loginChannelIds = [c2.env.LINE_LOGIN_CHANNEL_ID];
    const dbAccounts = await getLineAccounts(c2.env.DB);
    for (const acct of dbAccounts) {
      if (acct.login_channel_id && !loginChannelIds.includes(acct.login_channel_id)) {
        loginChannelIds.push(acct.login_channel_id);
      }
    }
    let verifyRes = null;
    for (const channelId of loginChannelIds) {
      verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ id_token: body.idToken, client_id: channelId })
      });
      if (verifyRes.ok) break;
    }
    if (!verifyRes?.ok) {
      return c2.json({ success: false, error: "Invalid ID token" }, 401);
    }
    const verified = await verifyRes.json();
    const lineUserId = verified.sub;
    const email = verified.email || null;
    const db = c2.env.DB;
    const friend = await getFriendByLineUserId(db, lineUserId);
    if (!friend) {
      return c2.json({ success: false, error: "Friend not found" }, 404);
    }
    if (friend.user_id) {
      if (body.ref && !body.ref.startsWith("xh:")) {
        await db.prepare("UPDATE friends SET ref_code = ? WHERE id = ? AND ref_code IS NULL").bind(body.ref, friend.id).run();
      }
      if (body.ref && body.ref.startsWith("xh:")) {
        try {
          const xhToken = body.ref.slice(3);
          const xhResult = await resolveXHarnessToken(xhToken, c2.env);
          if (xhResult?.xUsername) {
            const existingMeta = await db.prepare("SELECT metadata FROM friends WHERE id = ?").bind(friend.id).first();
            const meta = JSON.parse(existingMeta?.metadata || "{}");
            meta.x_username = xhResult.xUsername;
            await db.prepare("UPDATE friends SET metadata = ? WHERE id = ?").bind(JSON.stringify(meta), friend.id).run();
            console.log(`X Harness: linked @${xhResult.xUsername} to friend ${friend.id}`);
          }
          if (xhResult) {
            await applyXHarnessActions(db, friend.id, xhResult);
          }
        } catch (err) {
          console.error("X Harness token resolution error (non-blocking):", err);
        }
      }
      return c2.json({
        success: true,
        data: { userId: friend.user_id, alreadyLinked: true }
      });
    }
    let userId = null;
    if (email) {
      const existingUser = await getUserByEmail(db, email);
      if (existingUser) userId = existingUser.id;
    }
    if (!userId) {
      const newUser = await createUser(db, {
        email,
        displayName: body.displayName || verified.name
      });
      userId = newUser.id;
    }
    await linkFriendToUser(db, friend.id, userId);
    if (body.ref && !body.ref.startsWith("xh:")) {
      await db.prepare("UPDATE friends SET ref_code = ? WHERE id = ? AND ref_code IS NULL").bind(body.ref, friend.id).run();
      try {
        const route = await getEntryRouteByRefCode(db, body.ref);
        await recordRefTracking(db, {
          refCode: body.ref,
          friendId: friend.id,
          entryRouteId: route?.id ?? null,
          sourceUrl: null
        });
      } catch {
      }
    }
    if (body.ref && body.ref.startsWith("xh:")) {
      try {
        const xhToken = body.ref.slice(3);
        const xhResult = await resolveXHarnessToken(xhToken, c2.env);
        if (xhResult?.xUsername) {
          const existingMeta = await db.prepare("SELECT metadata FROM friends WHERE id = ?").bind(friend.id).first();
          const meta = JSON.parse(existingMeta?.metadata || "{}");
          meta.x_username = xhResult.xUsername;
          await db.prepare("UPDATE friends SET metadata = ? WHERE id = ?").bind(JSON.stringify(meta), friend.id).run();
          console.log(`X Harness: linked @${xhResult.xUsername} to friend ${friend.id}`);
        }
        if (xhResult) {
          await applyXHarnessActions(db, friend.id, xhResult);
        }
      } catch (err) {
        console.error("X Harness token resolution error (non-blocking):", err);
      }
    }
    return c2.json({
      success: true,
      data: { userId, alreadyLinked: false }
    });
  } catch (err) {
    console.error("POST /api/liff/link error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
liffRoutes.get("/api/analytics/ref-summary", async (c2) => {
  try {
    const db = c2.env.DB;
    const lineAccountId = c2.req.query("lineAccountId");
    const accountFilter = lineAccountId ? "AND f.line_account_id = ?" : "";
    const accountBinds = lineAccountId ? [lineAccountId] : [];
    const rows = await db.prepare(
      `SELECT
          er.ref_code,
          er.name,
          COUNT(DISTINCT rt.friend_id) as friend_count,
          COUNT(rt.id) as click_count,
          MAX(rt.created_at) as latest_at
        FROM entry_routes er
        LEFT JOIN ref_tracking rt ON er.ref_code = rt.ref_code
        LEFT JOIN friends f ON f.id = rt.friend_id ${accountFilter ? `${accountFilter}` : ""}
        GROUP BY er.ref_code, er.name
        ORDER BY friend_count DESC`
    ).bind(...accountBinds).all();
    const totalStmt = lineAccountId ? db.prepare(`SELECT COUNT(*) as count FROM friends WHERE line_account_id = ?`).bind(lineAccountId) : db.prepare(`SELECT COUNT(*) as count FROM friends`);
    const totalFriendsRes = await totalStmt.first();
    const refStmt = lineAccountId ? db.prepare(`SELECT COUNT(*) as count FROM friends WHERE ref_code IS NOT NULL AND ref_code != '' AND line_account_id = ?`).bind(lineAccountId) : db.prepare(`SELECT COUNT(*) as count FROM friends WHERE ref_code IS NOT NULL AND ref_code != ''`);
    const friendsWithRefRes = await refStmt.first();
    const totalFriends = totalFriendsRes?.count ?? 0;
    const friendsWithRef = friendsWithRefRes?.count ?? 0;
    return c2.json({
      success: true,
      data: {
        routes: (rows.results ?? []).map((r) => ({
          refCode: r.ref_code,
          name: r.name,
          friendCount: r.friend_count,
          clickCount: r.click_count,
          latestAt: r.latest_at
        })),
        totalFriends,
        friendsWithRef,
        friendsWithoutRef: totalFriends - friendsWithRef
      }
    });
  } catch (err) {
    console.error("GET /api/analytics/ref-summary error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
liffRoutes.get("/api/analytics/ref/:refCode", async (c2) => {
  try {
    const db = c2.env.DB;
    const refCode = c2.req.param("refCode");
    const routeRow = await db.prepare(`SELECT ref_code, name FROM entry_routes WHERE ref_code = ?`).bind(refCode).first();
    if (!routeRow) {
      return c2.json({ success: false, error: "Entry route not found" }, 404);
    }
    const lineAccountId = c2.req.query("lineAccountId");
    const accountFilter = lineAccountId ? "AND f.line_account_id = ?" : "";
    const binds = lineAccountId ? [refCode, refCode, lineAccountId] : [refCode, refCode];
    const friends2 = await db.prepare(
      `SELECT
          f.id,
          f.display_name,
          f.ref_code,
          rt.created_at as tracked_at
        FROM friends f
        LEFT JOIN ref_tracking rt ON f.id = rt.friend_id AND rt.ref_code = ?
        WHERE f.ref_code = ? ${accountFilter}
        ORDER BY rt.created_at DESC`
    ).bind(...binds).all();
    return c2.json({
      success: true,
      data: {
        refCode: routeRow.ref_code,
        name: routeRow.name,
        friends: (friends2.results ?? []).map((f) => ({
          id: f.id,
          displayName: f.display_name,
          trackedAt: f.tracked_at
        }))
      }
    });
  } catch (err) {
    console.error("GET /api/analytics/ref/:refCode error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
liffRoutes.post("/api/links/wrap", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.url) {
      return c2.json({ success: false, error: "url is required" }, 400);
    }
    const liffUrl = c2.env.LIFF_URL;
    if (!liffUrl) {
      return c2.json({ success: false, error: "LIFF_URL not configured" }, 500);
    }
    const params = new URLSearchParams({ redirect: body.url });
    if (body.ref) {
      params.set("ref", body.ref);
    }
    const wrappedUrl = `${liffUrl}?${params.toString()}`;
    return c2.json({ success: true, data: { url: wrappedUrl } });
  } catch (err) {
    console.error("POST /api/links/wrap error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
function completionPage(displayName, pictureUrl, ref) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>登録完了</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Hiragino Sans', system-ui, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 16px; padding: 40px 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; max-width: 400px; width: 90%; }
    .check { width: 64px; height: 64px; border-radius: 50%; background: #06C755; color: #fff; font-size: 32px; line-height: 64px; margin: 0 auto 16px; }
    h2 { font-size: 20px; color: #06C755; margin-bottom: 16px; }
    .profile { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 16px 0; }
    .profile img { width: 48px; height: 48px; border-radius: 50%; }
    .profile .name { font-size: 16px; font-weight: 600; }
    .message { font-size: 14px; color: #666; line-height: 1.6; margin-top: 12px; }
    .ref { display: inline-block; margin-top: 12px; padding: 4px 12px; background: #f0f0f0; border-radius: 12px; font-size: 11px; color: #999; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">✓</div>
    <h2>登録完了！</h2>
    <div class="profile">
      ${pictureUrl ? `<img src="${pictureUrl}" alt="">` : ""}
      <p class="name">${escapeHtml(displayName)} さん</p>
    </div>
    <p class="message">ありがとうございます！<br>これからお役立ち情報をお届けします。<br>このページは閉じて大丈夫です。</p>
    ${ref ? `<p class="ref">${escapeHtml(ref)}</p>` : ""}
  </div>
</body>
</html>`;
}
function errorPage(message) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>エラー</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Hiragino Sans', system-ui, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 16px; padding: 40px 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; max-width: 400px; width: 90%; }
    h2 { font-size: 18px; color: #e53e3e; margin-bottom: 12px; }
    p { font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="card">
    <h2>エラー</h2>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
async function applyXHarnessActions(db, friendId, result) {
  if (result.tag) {
    try {
      let tagRow = await db.prepare("SELECT id FROM tags WHERE name = ?").bind(result.tag).first();
      if (!tagRow) {
        const tagId = crypto.randomUUID();
        const { jstNow: jstNow2 } = await import("./index-BFY0hiw7.js");
        tagRow = await db.prepare("INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?) RETURNING id").bind(tagId, result.tag, jstNow2()).first();
      }
      if (tagRow) {
        const { addTagToFriend: addTagToFriend2 } = await import("./index-BFY0hiw7.js");
        await addTagToFriend2(db, friendId, tagRow.id);
        console.log(`X Harness: added tag "${result.tag}" to friend ${friendId}`);
      }
    } catch (err) {
      console.error(`X Harness: failed to add tag "${result.tag}":`, err);
    }
  }
  if (result.scenarioId) {
    try {
      const { enrollFriendInScenario: enrollFriendInScenario2 } = await import("./index-BFY0hiw7.js");
      await enrollFriendInScenario2(db, friendId, result.scenarioId);
      console.log(`X Harness: enrolled friend ${friendId} in scenario ${result.scenarioId}`);
    } catch (err) {
      console.error(`X Harness: failed to enroll in scenario:`, err);
    }
  }
}
async function resolveXHarnessToken(token, env) {
  if (!env.X_HARNESS_URL) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5e3);
    try {
      const res = await fetch(`${env.X_HARNESS_URL}/api/tokens/${token}/resolve`, {
        headers: { "Content-Type": "application/json" },
        signal: controller.signal
      });
      if (!res.ok) return null;
      const body = await res.json();
      if (!body.success || !body.data) return null;
      return { xUsername: body.data.xUsername, tag: body.data.tag ?? null, scenarioId: body.data.scenarioId ?? null };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return null;
  }
}
const webhooks = new Hono();
webhooks.get("/api/webhooks/incoming", async (c2) => {
  try {
    const items = await getIncomingWebhooks(c2.env.DB);
    return c2.json({
      success: true,
      data: items.map((w) => ({
        id: w.id,
        name: w.name,
        sourceType: w.source_type,
        secret: w.secret,
        isActive: Boolean(w.is_active),
        createdAt: w.created_at,
        updatedAt: w.updated_at
      }))
    });
  } catch (err) {
    console.error("GET /api/webhooks/incoming error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
webhooks.post("/api/webhooks/incoming", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.name) return c2.json({ success: false, error: "name is required" }, 400);
    const item = await createIncomingWebhook(c2.env.DB, body);
    return c2.json({ success: true, data: { id: item.id, name: item.name, sourceType: item.source_type, isActive: Boolean(item.is_active), createdAt: item.created_at } }, 201);
  } catch (err) {
    console.error("POST /api/webhooks/incoming error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
webhooks.put("/api/webhooks/incoming/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const body = await c2.req.json();
    await updateIncomingWebhook(c2.env.DB, id, body);
    const updated = await getIncomingWebhookById(c2.env.DB, id);
    if (!updated) return c2.json({ success: false, error: "Not found" }, 404);
    return c2.json({ success: true, data: { id: updated.id, name: updated.name, sourceType: updated.source_type, isActive: Boolean(updated.is_active) } });
  } catch (err) {
    console.error("PUT /api/webhooks/incoming/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
webhooks.delete("/api/webhooks/incoming/:id", async (c2) => {
  try {
    await deleteIncomingWebhook(c2.env.DB, c2.req.param("id"));
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/webhooks/incoming/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
webhooks.get("/api/webhooks/outgoing", async (c2) => {
  try {
    const items = await getOutgoingWebhooks(c2.env.DB);
    return c2.json({
      success: true,
      data: items.map((w) => ({
        id: w.id,
        name: w.name,
        url: w.url,
        eventTypes: JSON.parse(w.event_types),
        secret: w.secret,
        isActive: Boolean(w.is_active),
        createdAt: w.created_at,
        updatedAt: w.updated_at
      }))
    });
  } catch (err) {
    console.error("GET /api/webhooks/outgoing error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
webhooks.post("/api/webhooks/outgoing", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.name || !body.url) return c2.json({ success: false, error: "name and url are required" }, 400);
    const item = await createOutgoingWebhook(c2.env.DB, { ...body, eventTypes: body.eventTypes ?? [] });
    return c2.json({
      success: true,
      data: { id: item.id, name: item.name, url: item.url, eventTypes: JSON.parse(item.event_types), isActive: Boolean(item.is_active), createdAt: item.created_at }
    }, 201);
  } catch (err) {
    console.error("POST /api/webhooks/outgoing error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
webhooks.put("/api/webhooks/outgoing/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const body = await c2.req.json();
    await updateOutgoingWebhook(c2.env.DB, id, body);
    const updated = await getOutgoingWebhookById(c2.env.DB, id);
    if (!updated) return c2.json({ success: false, error: "Not found" }, 404);
    return c2.json({ success: true, data: { id: updated.id, name: updated.name, url: updated.url, eventTypes: JSON.parse(updated.event_types), isActive: Boolean(updated.is_active) } });
  } catch (err) {
    console.error("PUT /api/webhooks/outgoing/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
webhooks.delete("/api/webhooks/outgoing/:id", async (c2) => {
  try {
    await deleteOutgoingWebhook(c2.env.DB, c2.req.param("id"));
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/webhooks/outgoing/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
webhooks.post("/api/webhooks/incoming/:id/receive", async (c2) => {
  try {
    const id = c2.req.param("id");
    const wh = await getIncomingWebhookById(c2.env.DB, id);
    if (!wh || !wh.is_active) return c2.json({ success: false, error: "Webhook not found or inactive" }, 404);
    const body = await c2.req.json();
    const { fireEvent: fireEvent2 } = await Promise.resolve().then(() => eventBus);
    const eventType = `incoming_webhook.${wh.source_type}`;
    await fireEvent2(c2.env.DB, eventType, {
      eventData: { webhookId: wh.id, source: wh.source_type, payload: body }
    });
    return c2.json({ success: true, data: { received: true, source: wh.source_type } });
  } catch (err) {
    console.error("POST /api/webhooks/incoming/:id/receive error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const GCAL_BASE = "https://www.googleapis.com/calendar/v3";
const TIMEZONE = "Asia/Tokyo";
class GoogleCalendarClient {
  constructor(config) {
    this.config = config;
  }
  /**
   * Get busy time intervals from Google Calendar FreeBusy API.
   * Returns an array of { start, end } intervals when the calendar is busy.
   */
  async getFreeBusy(timeMin, timeMax) {
    const url = `${GCAL_BASE}/freeBusy`;
    const body = {
      timeMin,
      timeMax,
      items: [{ id: this.config.calendarId }]
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Google FreeBusy API error ${res.status}: ${text}`);
    }
    const data = await res.json();
    const calendarData = data.calendars?.[this.config.calendarId];
    return calendarData?.busy ?? [];
  }
  /**
   * Create an event on Google Calendar.
   * Returns the created event's ID.
   */
  async createEvent(event) {
    const url = `${GCAL_BASE}/calendars/${encodeURIComponent(this.config.calendarId)}/events`;
    const body = {
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.start, timeZone: TIMEZONE },
      end: { dateTime: event.end, timeZone: TIMEZONE }
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Google Calendar createEvent error ${res.status}: ${text}`);
    }
    const data = await res.json();
    if (!data.id) {
      throw new Error("Google Calendar createEvent: response missing event id");
    }
    return { eventId: data.id };
  }
  /**
   * Delete an event from Google Calendar.
   */
  async deleteEvent(eventId) {
    const url = `${GCAL_BASE}/calendars/${encodeURIComponent(this.config.calendarId)}/events/${encodeURIComponent(eventId)}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`
      }
    });
    if (!res.ok && res.status !== 410) {
      const text = await res.text().catch(() => "");
      throw new Error(`Google Calendar deleteEvent error ${res.status}: ${text}`);
    }
  }
}
const calendar = new Hono();
calendar.get("/api/integrations/google-calendar", async (c2) => {
  try {
    const items = await getCalendarConnections(c2.env.DB);
    return c2.json({
      success: true,
      data: items.map((conn) => ({
        id: conn.id,
        calendarId: conn.calendar_id,
        authType: conn.auth_type,
        isActive: Boolean(conn.is_active),
        createdAt: conn.created_at,
        updatedAt: conn.updated_at
      }))
    });
  } catch (err) {
    console.error("GET /api/integrations/google-calendar error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
calendar.post("/api/integrations/google-calendar/connect", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.calendarId) return c2.json({ success: false, error: "calendarId is required" }, 400);
    const conn = await createCalendarConnection(c2.env.DB, body);
    return c2.json({
      success: true,
      data: { id: conn.id, calendarId: conn.calendar_id, authType: conn.auth_type, isActive: Boolean(conn.is_active), createdAt: conn.created_at }
    }, 201);
  } catch (err) {
    console.error("POST /api/integrations/google-calendar/connect error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
calendar.delete("/api/integrations/google-calendar/:id", async (c2) => {
  try {
    await deleteCalendarConnection(c2.env.DB, c2.req.param("id"));
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/integrations/google-calendar/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
calendar.get("/api/integrations/google-calendar/slots", async (c2) => {
  try {
    const connectionId = c2.req.query("connectionId");
    const date = c2.req.query("date");
    const slotMinutes = Number(c2.req.query("slotMinutes") ?? "60");
    const startHour = Number(c2.req.query("startHour") ?? "9");
    const endHour = Number(c2.req.query("endHour") ?? "18");
    if (!connectionId || !date) {
      return c2.json({ success: false, error: "connectionId and date are required" }, 400);
    }
    const conn = await getCalendarConnectionById(c2.env.DB, connectionId);
    if (!conn) {
      return c2.json({ success: false, error: "Calendar connection not found" }, 404);
    }
    const dayStart = `${date}T${String(startHour).padStart(2, "0")}:00:00`;
    const dayEnd = `${date}T${String(endHour).padStart(2, "0")}:00:00`;
    const bookings = await getBookingsInRange(c2.env.DB, connectionId, dayStart, dayEnd);
    let googleBusyIntervals = [];
    if (conn.access_token) {
      try {
        const gcal = new GoogleCalendarClient({
          calendarId: conn.calendar_id,
          accessToken: conn.access_token
        });
        const timeMin = `${date}T${String(startHour).padStart(2, "0")}:00:00+09:00`;
        const timeMax = `${date}T${String(endHour).padStart(2, "0")}:00:00+09:00`;
        googleBusyIntervals = await gcal.getFreeBusy(timeMin, timeMax);
      } catch (err) {
        console.warn("Google FreeBusy API error (falling back to D1 only):", err);
      }
    }
    const slots = [];
    const baseDate = /* @__PURE__ */ new Date(`${date}T${String(startHour).padStart(2, "0")}:00:00+09:00`);
    for (let h = startHour; h < endHour; h += slotMinutes / 60) {
      const slotStart = new Date(baseDate);
      slotStart.setMinutes(slotStart.getMinutes() + (h - startHour) * 60);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + slotMinutes);
      const startStr = toJstString(slotStart);
      const endStr = toJstString(slotEnd);
      const isBookedInD1 = bookings.some((b) => {
        const bStart = new Date(b.start_at).getTime();
        const bEnd = new Date(b.end_at).getTime();
        return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
      });
      const isBookedInGoogle = googleBusyIntervals.some((interval) => {
        const gStart = new Date(interval.start).getTime();
        const gEnd = new Date(interval.end).getTime();
        return slotStart.getTime() < gEnd && slotEnd.getTime() > gStart;
      });
      slots.push({ startAt: startStr, endAt: endStr, available: !isBookedInD1 && !isBookedInGoogle });
    }
    return c2.json({ success: true, data: slots });
  } catch (err) {
    console.error("GET /api/integrations/google-calendar/slots error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
calendar.get("/api/integrations/google-calendar/bookings", async (c2) => {
  try {
    const connectionId = c2.req.query("connectionId");
    const friendId = c2.req.query("friendId");
    const items = await getCalendarBookings(c2.env.DB, { connectionId: connectionId ?? void 0, friendId: friendId ?? void 0 });
    return c2.json({
      success: true,
      data: items.map((b) => ({
        id: b.id,
        connectionId: b.connection_id,
        friendId: b.friend_id,
        eventId: b.event_id,
        title: b.title,
        startAt: b.start_at,
        endAt: b.end_at,
        status: b.status,
        metadata: b.metadata ? JSON.parse(b.metadata) : null,
        createdAt: b.created_at
      }))
    });
  } catch (err) {
    console.error("GET /api/integrations/google-calendar/bookings error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
calendar.post("/api/integrations/google-calendar/book", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.connectionId || !body.title || !body.startAt || !body.endAt) {
      return c2.json({ success: false, error: "connectionId, title, startAt, endAt are required" }, 400);
    }
    const booking = await createCalendarBooking(c2.env.DB, {
      ...body,
      metadata: body.metadata ? JSON.stringify(body.metadata) : void 0
    });
    const conn = await getCalendarConnectionById(c2.env.DB, body.connectionId);
    if (conn?.access_token) {
      try {
        const gcal = new GoogleCalendarClient({
          calendarId: conn.calendar_id,
          accessToken: conn.access_token
        });
        const { eventId } = await gcal.createEvent({
          summary: body.title,
          start: body.startAt,
          end: body.endAt,
          description: body.description
        });
        await updateCalendarBookingEventId(c2.env.DB, booking.id, eventId);
        booking.event_id = eventId;
      } catch (err) {
        console.warn("Google Calendar createEvent error (booking still created in D1):", err);
      }
    }
    return c2.json({
      success: true,
      data: {
        id: booking.id,
        connectionId: booking.connection_id,
        friendId: booking.friend_id,
        eventId: booking.event_id,
        title: booking.title,
        startAt: booking.start_at,
        endAt: booking.end_at,
        status: booking.status,
        createdAt: booking.created_at
      }
    }, 201);
  } catch (err) {
    console.error("POST /api/integrations/google-calendar/book error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
calendar.put("/api/integrations/google-calendar/bookings/:id/status", async (c2) => {
  try {
    const id = c2.req.param("id");
    const { status } = await c2.req.json();
    if (status === "cancelled") {
      const booking = await getCalendarBookingById(c2.env.DB, id);
      if (booking?.event_id && booking.connection_id) {
        const conn = await getCalendarConnectionById(c2.env.DB, booking.connection_id);
        if (conn?.access_token) {
          try {
            const gcal = new GoogleCalendarClient({
              calendarId: conn.calendar_id,
              accessToken: conn.access_token
            });
            await gcal.deleteEvent(booking.event_id);
          } catch (err) {
            console.warn("Google Calendar deleteEvent error (status still updated in D1):", err);
          }
        }
      }
    }
    await updateCalendarBookingStatus(c2.env.DB, id, status);
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("PUT /api/integrations/google-calendar/bookings/:id/status error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const reminders = new Hono();
reminders.get("/api/reminders", async (c2) => {
  try {
    const lineAccountId = c2.req.query("lineAccountId");
    let items;
    if (lineAccountId) {
      const result = await c2.env.DB.prepare(`SELECT * FROM reminders WHERE line_account_id = ? ORDER BY created_at DESC`).bind(lineAccountId).all();
      items = result.results;
    } else {
      items = await getReminders(c2.env.DB);
    }
    return c2.json({
      success: true,
      data: items.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isActive: Boolean(r.is_active),
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }))
    });
  } catch (err) {
    console.error("GET /api/reminders error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
reminders.get("/api/reminders/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const [reminder, steps] = await Promise.all([
      getReminderById(c2.env.DB, id),
      getReminderSteps(c2.env.DB, id)
    ]);
    if (!reminder) return c2.json({ success: false, error: "Reminder not found" }, 404);
    return c2.json({
      success: true,
      data: {
        id: reminder.id,
        name: reminder.name,
        description: reminder.description,
        isActive: Boolean(reminder.is_active),
        createdAt: reminder.created_at,
        updatedAt: reminder.updated_at,
        steps: steps.map((s) => ({
          id: s.id,
          reminderId: s.reminder_id,
          offsetMinutes: s.offset_minutes,
          messageType: s.message_type,
          messageContent: s.message_content,
          createdAt: s.created_at
        }))
      }
    });
  } catch (err) {
    console.error("GET /api/reminders/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
reminders.post("/api/reminders", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.name) return c2.json({ success: false, error: "name is required" }, 400);
    const item = await createReminder(c2.env.DB, body);
    if (body.lineAccountId) {
      await c2.env.DB.prepare(`UPDATE reminders SET line_account_id = ? WHERE id = ?`).bind(body.lineAccountId, item.id).run();
    }
    return c2.json({ success: true, data: { id: item.id, name: item.name, createdAt: item.created_at } }, 201);
  } catch (err) {
    console.error("POST /api/reminders error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
reminders.put("/api/reminders/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const body = await c2.req.json();
    await updateReminder(c2.env.DB, id, body);
    const updated = await getReminderById(c2.env.DB, id);
    if (!updated) return c2.json({ success: false, error: "Not found" }, 404);
    return c2.json({ success: true, data: { id: updated.id, name: updated.name, isActive: Boolean(updated.is_active) } });
  } catch (err) {
    console.error("PUT /api/reminders/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
reminders.delete("/api/reminders/:id", async (c2) => {
  try {
    await deleteReminder(c2.env.DB, c2.req.param("id"));
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/reminders/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
reminders.post("/api/reminders/:id/steps", async (c2) => {
  try {
    const reminderId = c2.req.param("id");
    const body = await c2.req.json();
    if (body.offsetMinutes === void 0 || !body.messageType || !body.messageContent) {
      return c2.json({ success: false, error: "offsetMinutes, messageType, messageContent are required" }, 400);
    }
    const step = await createReminderStep(c2.env.DB, { reminderId, ...body });
    return c2.json({
      success: true,
      data: { id: step.id, reminderId: step.reminder_id, offsetMinutes: step.offset_minutes, messageType: step.message_type, createdAt: step.created_at }
    }, 201);
  } catch (err) {
    console.error("POST /api/reminders/:id/steps error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
reminders.delete("/api/reminders/:reminderId/steps/:stepId", async (c2) => {
  try {
    await deleteReminderStep(c2.env.DB, c2.req.param("stepId"));
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/reminders/:reminderId/steps/:stepId error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
reminders.post("/api/reminders/:id/enroll/:friendId", async (c2) => {
  try {
    const reminderId = c2.req.param("id");
    const friendId = c2.req.param("friendId");
    const body = await c2.req.json();
    if (!body.targetDate) return c2.json({ success: false, error: "targetDate is required" }, 400);
    const enrollment = await enrollFriendInReminder(c2.env.DB, { friendId, reminderId, targetDate: body.targetDate });
    return c2.json({
      success: true,
      data: { id: enrollment.id, friendId: enrollment.friend_id, reminderId: enrollment.reminder_id, targetDate: enrollment.target_date, status: enrollment.status }
    }, 201);
  } catch (err) {
    console.error("POST /api/reminders/:id/enroll/:friendId error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
reminders.get("/api/friends/:friendId/reminders", async (c2) => {
  try {
    const friendId = c2.req.param("friendId");
    const items = await getFriendReminders(c2.env.DB, friendId);
    return c2.json({
      success: true,
      data: items.map((fr) => ({
        id: fr.id,
        friendId: fr.friend_id,
        reminderId: fr.reminder_id,
        targetDate: fr.target_date,
        status: fr.status,
        createdAt: fr.created_at
      }))
    });
  } catch (err) {
    console.error("GET /api/friends/:friendId/reminders error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
reminders.delete("/api/friend-reminders/:id", async (c2) => {
  try {
    await cancelFriendReminder(c2.env.DB, c2.req.param("id"));
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/friend-reminders/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const scoring = new Hono();
scoring.get("/api/scoring-rules", async (c2) => {
  try {
    const items = await getScoringRules(c2.env.DB);
    return c2.json({
      success: true,
      data: items.map((r) => ({
        id: r.id,
        name: r.name,
        eventType: r.event_type,
        scoreValue: r.score_value,
        isActive: Boolean(r.is_active),
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }))
    });
  } catch (err) {
    console.error("GET /api/scoring-rules error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
scoring.get("/api/scoring-rules/:id", async (c2) => {
  try {
    const item = await getScoringRuleById(c2.env.DB, c2.req.param("id"));
    if (!item) return c2.json({ success: false, error: "Not found" }, 404);
    return c2.json({
      success: true,
      data: { id: item.id, name: item.name, eventType: item.event_type, scoreValue: item.score_value, isActive: Boolean(item.is_active), createdAt: item.created_at }
    });
  } catch (err) {
    console.error("GET /api/scoring-rules/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
scoring.post("/api/scoring-rules", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.name || !body.eventType || body.scoreValue === void 0) {
      return c2.json({ success: false, error: "name, eventType, scoreValue are required" }, 400);
    }
    const item = await createScoringRule(c2.env.DB, body);
    return c2.json({ success: true, data: { id: item.id, name: item.name, eventType: item.event_type, scoreValue: item.score_value } }, 201);
  } catch (err) {
    console.error("POST /api/scoring-rules error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
scoring.put("/api/scoring-rules/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const body = await c2.req.json();
    await updateScoringRule(c2.env.DB, id, body);
    const updated = await getScoringRuleById(c2.env.DB, id);
    if (!updated) return c2.json({ success: false, error: "Not found" }, 404);
    return c2.json({ success: true, data: { id: updated.id, name: updated.name, eventType: updated.event_type, scoreValue: updated.score_value, isActive: Boolean(updated.is_active) } });
  } catch (err) {
    console.error("PUT /api/scoring-rules/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
scoring.delete("/api/scoring-rules/:id", async (c2) => {
  try {
    await deleteScoringRule(c2.env.DB, c2.req.param("id"));
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/scoring-rules/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
scoring.get("/api/friends/:id/score", async (c2) => {
  try {
    const friendId = c2.req.param("id");
    const [score, history] = await Promise.all([
      getFriendScore(c2.env.DB, friendId),
      getFriendScoreHistory(c2.env.DB, friendId)
    ]);
    return c2.json({
      success: true,
      data: {
        friendId,
        currentScore: score,
        history: history.map((h) => ({
          id: h.id,
          scoringRuleId: h.scoring_rule_id,
          scoreChange: h.score_change,
          reason: h.reason,
          createdAt: h.created_at
        }))
      }
    });
  } catch (err) {
    console.error("GET /api/friends/:id/score error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
scoring.post("/api/friends/:id/score", async (c2) => {
  try {
    const friendId = c2.req.param("id");
    const body = await c2.req.json();
    if (body.scoreChange === void 0) return c2.json({ success: false, error: "scoreChange is required" }, 400);
    await addScore(c2.env.DB, { friendId, scoreChange: body.scoreChange, reason: body.reason });
    const newScore = await getFriendScore(c2.env.DB, friendId);
    return c2.json({ success: true, data: { friendId, currentScore: newScore } }, 201);
  } catch (err) {
    console.error("POST /api/friends/:id/score error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const templates = new Hono();
templates.get("/api/templates", async (c2) => {
  try {
    const category = c2.req.query("category") ?? void 0;
    const items = await getTemplates(c2.env.DB, category);
    return c2.json({
      success: true,
      data: items.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        messageType: t.message_type,
        messageContent: t.message_content,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }))
    });
  } catch (err) {
    console.error("GET /api/templates error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
templates.get("/api/templates/:id", async (c2) => {
  try {
    const item = await getTemplateById(c2.env.DB, c2.req.param("id"));
    if (!item) return c2.json({ success: false, error: "Template not found" }, 404);
    return c2.json({
      success: true,
      data: { id: item.id, name: item.name, category: item.category, messageType: item.message_type, messageContent: item.message_content, createdAt: item.created_at, updatedAt: item.updated_at }
    });
  } catch (err) {
    console.error("GET /api/templates/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
templates.post("/api/templates", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.name || !body.messageType || !body.messageContent) {
      return c2.json({ success: false, error: "name, messageType, messageContent are required" }, 400);
    }
    const item = await createTemplate(c2.env.DB, body);
    return c2.json({ success: true, data: { id: item.id, name: item.name, category: item.category, messageType: item.message_type, createdAt: item.created_at } }, 201);
  } catch (err) {
    console.error("POST /api/templates error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
templates.put("/api/templates/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const body = await c2.req.json();
    await updateTemplate(c2.env.DB, id, body);
    const updated = await getTemplateById(c2.env.DB, id);
    if (!updated) return c2.json({ success: false, error: "Not found" }, 404);
    return c2.json({
      success: true,
      data: { id: updated.id, name: updated.name, category: updated.category, messageType: updated.message_type, messageContent: updated.message_content }
    });
  } catch (err) {
    console.error("PUT /api/templates/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
templates.delete("/api/templates/:id", async (c2) => {
  try {
    await deleteTemplate(c2.env.DB, c2.req.param("id"));
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/templates/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const chats = new Hono();
function clampLoadingSeconds(value) {
  const n = Number.isFinite(value) ? Math.floor(value) : 5;
  return Math.min(60, Math.max(5, n));
}
async function startLoadingAnimation(accessToken, chatId, loadingSeconds) {
  const response = await fetch("https://api.line.me/v2/bot/chat/loading/start", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ chatId, loadingSeconds })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      detail ? `LINE API error: ${response.status} - ${detail}` : `LINE API error: ${response.status}`
    );
  }
}
chats.get("/api/operators", async (c2) => {
  try {
    const items = await getOperators(c2.env.DB);
    return c2.json({
      success: true,
      data: items.map((o) => ({
        id: o.id,
        name: o.name,
        email: o.email,
        role: o.role,
        isActive: Boolean(o.is_active),
        createdAt: o.created_at,
        updatedAt: o.updated_at
      }))
    });
  } catch (err) {
    console.error("GET /api/operators error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
chats.post("/api/operators", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.name || !body.email) return c2.json({ success: false, error: "name and email are required" }, 400);
    const item = await createOperator(c2.env.DB, body);
    return c2.json({ success: true, data: { id: item.id, name: item.name, email: item.email, role: item.role } }, 201);
  } catch (err) {
    console.error("POST /api/operators error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
chats.put("/api/operators/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const body = await c2.req.json();
    await updateOperator(c2.env.DB, id, body);
    const updated = await getOperatorById(c2.env.DB, id);
    if (!updated) return c2.json({ success: false, error: "Not found" }, 404);
    return c2.json({ success: true, data: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, isActive: Boolean(updated.is_active) } });
  } catch (err) {
    console.error("PUT /api/operators/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
chats.delete("/api/operators/:id", async (c2) => {
  try {
    await deleteOperator(c2.env.DB, c2.req.param("id"));
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/operators/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
chats.get("/api/chats", async (c2) => {
  try {
    const status = c2.req.query("status") ?? void 0;
    const operatorId = c2.req.query("operatorId") ?? void 0;
    const lineAccountId = c2.req.query("lineAccountId") ?? void 0;
    let sql = `SELECT c.*, f.display_name, f.picture_url, f.line_user_id
               FROM chats c
               LEFT JOIN friends f ON c.friend_id = f.id`;
    const conditions = [];
    const bindings = [];
    if (status) {
      conditions.push("c.status = ?");
      bindings.push(status);
    }
    if (operatorId) {
      conditions.push("c.operator_id = ?");
      bindings.push(operatorId);
    }
    if (lineAccountId) {
      conditions.push("f.line_account_id = ?");
      bindings.push(lineAccountId);
    }
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY c.last_message_at DESC";
    const stmt = bindings.length > 0 ? c2.env.DB.prepare(sql).bind(...bindings) : c2.env.DB.prepare(sql);
    const result = await stmt.all();
    return c2.json({
      success: true,
      data: result.results.map((ch) => ({
        id: ch.id,
        friendId: ch.friend_id,
        friendName: ch.display_name || "名前なし",
        friendPictureUrl: ch.picture_url || null,
        operatorId: ch.operator_id,
        status: ch.status,
        notes: ch.notes,
        lastMessageAt: ch.last_message_at,
        createdAt: ch.created_at,
        updatedAt: ch.updated_at
      }))
    });
  } catch (err) {
    console.error("GET /api/chats error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
chats.get("/api/chats/:id", async (c2) => {
  try {
    const item = await getChatById(c2.env.DB, c2.req.param("id"));
    if (!item) return c2.json({ success: false, error: "Chat not found" }, 404);
    const friend = await c2.env.DB.prepare(`SELECT display_name, picture_url, line_user_id FROM friends WHERE id = ?`).bind(item.friend_id).first();
    const messages = await c2.env.DB.prepare(`SELECT id, friend_id, direction, message_type, content, created_at FROM messages_log WHERE friend_id = ? ORDER BY created_at ASC LIMIT 200`).bind(item.friend_id).all();
    return c2.json({
      success: true,
      data: {
        id: item.id,
        friendId: item.friend_id,
        friendName: friend?.display_name || "名前なし",
        friendPictureUrl: friend?.picture_url || null,
        operatorId: item.operator_id,
        status: item.status,
        notes: item.notes,
        lastMessageAt: item.last_message_at,
        createdAt: item.created_at,
        messages: messages.results.map((m) => ({
          id: m.id,
          direction: m.direction,
          messageType: m.message_type,
          content: m.content,
          createdAt: m.created_at
        }))
      }
    });
  } catch (err) {
    console.error("GET /api/chats/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
chats.post("/api/chats", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.friendId) return c2.json({ success: false, error: "friendId is required" }, 400);
    const item = await createChat(c2.env.DB, body);
    if (body.lineAccountId) {
      await c2.env.DB.prepare(`UPDATE chats SET line_account_id = ? WHERE id = ?`).bind(body.lineAccountId, item.id).run();
    }
    return c2.json({ success: true, data: { id: item.id, friendId: item.friend_id, status: item.status } }, 201);
  } catch (err) {
    console.error("POST /api/chats error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
chats.put("/api/chats/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const body = await c2.req.json();
    await updateChat(c2.env.DB, id, body);
    const updated = await getChatById(c2.env.DB, id);
    if (!updated) return c2.json({ success: false, error: "Not found" }, 404);
    return c2.json({
      success: true,
      data: { id: updated.id, friendId: updated.friend_id, operatorId: updated.operator_id, status: updated.status, notes: updated.notes }
    });
  } catch (err) {
    console.error("PUT /api/chats/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
chats.post("/api/chats/:id/loading", async (c2) => {
  try {
    const chatId = c2.req.param("id");
    const chat = await getChatById(c2.env.DB, chatId);
    if (!chat) return c2.json({ success: false, error: "Chat not found" }, 404);
    let loadingSecondsInput;
    try {
      const body = await c2.req.json();
      loadingSecondsInput = body.loadingSeconds;
    } catch {
      loadingSecondsInput = void 0;
    }
    const loadingSeconds = clampLoadingSeconds(loadingSecondsInput);
    const friend = await c2.env.DB.prepare(`SELECT * FROM friends WHERE id = ?`).bind(chat.friend_id).first();
    if (!friend) return c2.json({ success: false, error: "Friend not found" }, 404);
    await startLoadingAnimation(
      c2.env.LINE_CHANNEL_ACCESS_TOKEN,
      friend.line_user_id,
      loadingSeconds
    );
    return c2.json({ success: true, data: { started: true, loadingSeconds } });
  } catch (err) {
    console.error("POST /api/chats/:id/loading error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return c2.json({ success: false, error: message }, 500);
  }
});
chats.post("/api/chats/:id/send", async (c2) => {
  try {
    const chatId = c2.req.param("id");
    const chat = await getChatById(c2.env.DB, chatId);
    if (!chat) return c2.json({ success: false, error: "Chat not found" }, 404);
    const body = await c2.req.json();
    if (!body.content) return c2.json({ success: false, error: "content is required" }, 400);
    const friend = await c2.env.DB.prepare(`SELECT * FROM friends WHERE id = ?`).bind(chat.friend_id).first();
    if (!friend) return c2.json({ success: false, error: "Friend not found" }, 404);
    const { LineClient: LineClient2 } = await import("./index-NYpmBJRY.js");
    const lineClient = new LineClient2(c2.env.LINE_CHANNEL_ACCESS_TOKEN);
    const messageType = body.messageType ?? "text";
    if (messageType === "text") {
      await lineClient.pushTextMessage(friend.line_user_id, body.content);
    } else if (messageType === "flex") {
      const contents = JSON.parse(body.content);
      await lineClient.pushFlexMessage(friend.line_user_id, extractFlexAltText(contents), contents);
    }
    const logId = crypto.randomUUID();
    await c2.env.DB.prepare(`INSERT INTO messages_log (id, friend_id, direction, message_type, content, created_at) VALUES (?, ?, 'outgoing', ?, ?, ?)`).bind(logId, friend.id, messageType, body.content, jstNow()).run();
    await updateChat(c2.env.DB, chatId, { status: "in_progress", lastMessageAt: jstNow() });
    return c2.json({ success: true, data: { sent: true, messageId: logId } });
  } catch (err) {
    console.error("POST /api/chats/:id/send error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const notifications = new Hono();
notifications.get("/api/notifications/rules", async (c2) => {
  try {
    const lineAccountId = c2.req.query("lineAccountId");
    let items;
    if (lineAccountId) {
      const result = await c2.env.DB.prepare(`SELECT * FROM notification_rules WHERE line_account_id = ? ORDER BY created_at DESC`).bind(lineAccountId).all();
      items = result.results;
    } else {
      items = await getNotificationRules(c2.env.DB);
    }
    return c2.json({
      success: true,
      data: items.map((r) => ({
        id: r.id,
        name: r.name,
        eventType: r.event_type,
        conditions: JSON.parse(r.conditions),
        channels: JSON.parse(r.channels),
        isActive: Boolean(r.is_active),
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }))
    });
  } catch (err) {
    console.error("GET /api/notifications/rules error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
notifications.get("/api/notifications/rules/:id", async (c2) => {
  try {
    const item = await getNotificationRuleById(c2.env.DB, c2.req.param("id"));
    if (!item) return c2.json({ success: false, error: "Not found" }, 404);
    return c2.json({
      success: true,
      data: {
        id: item.id,
        name: item.name,
        eventType: item.event_type,
        conditions: JSON.parse(item.conditions),
        channels: JSON.parse(item.channels),
        isActive: Boolean(item.is_active),
        createdAt: item.created_at
      }
    });
  } catch (err) {
    console.error("GET /api/notifications/rules/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
notifications.post("/api/notifications/rules", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.name || !body.eventType) return c2.json({ success: false, error: "name and eventType are required" }, 400);
    const item = await createNotificationRule(c2.env.DB, body);
    return c2.json({
      success: true,
      data: { id: item.id, name: item.name, eventType: item.event_type, channels: JSON.parse(item.channels), createdAt: item.created_at }
    }, 201);
  } catch (err) {
    console.error("POST /api/notifications/rules error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
notifications.put("/api/notifications/rules/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const body = await c2.req.json();
    await updateNotificationRule(c2.env.DB, id, body);
    const updated = await getNotificationRuleById(c2.env.DB, id);
    if (!updated) return c2.json({ success: false, error: "Not found" }, 404);
    return c2.json({
      success: true,
      data: { id: updated.id, name: updated.name, eventType: updated.event_type, channels: JSON.parse(updated.channels), isActive: Boolean(updated.is_active) }
    });
  } catch (err) {
    console.error("PUT /api/notifications/rules/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
notifications.delete("/api/notifications/rules/:id", async (c2) => {
  try {
    await deleteNotificationRule(c2.env.DB, c2.req.param("id"));
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/notifications/rules/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
notifications.get("/api/notifications", async (c2) => {
  try {
    const status = c2.req.query("status") ?? void 0;
    const limit = Number(c2.req.query("limit") ?? "100");
    const lineAccountId = c2.req.query("lineAccountId") ?? void 0;
    let items;
    if (lineAccountId) {
      const conditions = ["line_account_id = ?"];
      const bindings = [lineAccountId];
      if (status) {
        conditions.push("status = ?");
        bindings.push(status);
      }
      bindings.push(limit);
      const result = await c2.env.DB.prepare(`SELECT * FROM notifications WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT ?`).bind(...bindings).all();
      items = result.results;
    } else {
      items = await getNotifications(c2.env.DB, { status, limit });
    }
    return c2.json({
      success: true,
      data: items.map((n) => ({
        id: n.id,
        ruleId: n.rule_id,
        eventType: n.event_type,
        title: n.title,
        body: n.body,
        channel: n.channel,
        status: n.status,
        metadata: n.metadata ? JSON.parse(n.metadata) : null,
        createdAt: n.created_at
      }))
    });
  } catch (err) {
    console.error("GET /api/notifications error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const stripe = new Hono();
stripe.get("/api/integrations/stripe/events", async (c2) => {
  try {
    const friendId = c2.req.query("friendId") ?? void 0;
    const eventType = c2.req.query("eventType") ?? void 0;
    const limit = Number(c2.req.query("limit") ?? "100");
    const items = await getStripeEvents(c2.env.DB, { friendId, eventType, limit });
    return c2.json({
      success: true,
      data: items.map((e) => ({
        id: e.id,
        stripeEventId: e.stripe_event_id,
        eventType: e.event_type,
        friendId: e.friend_id,
        amount: e.amount,
        currency: e.currency,
        metadata: e.metadata ? JSON.parse(e.metadata) : null,
        processedAt: e.processed_at
      }))
    });
  } catch (err) {
    console.error("GET /api/integrations/stripe/events error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
async function verifyStripeSignature(secret, rawBody, sigHeader) {
  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k, v.join("=")];
    })
  );
  const timestamp = parts.t;
  const expectedSig = parts.v1;
  if (!timestamp || !expectedSig) return false;
  const encoder = new TextEncoder();
  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const computedSig = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return computedSig === expectedSig;
}
stripe.post("/api/integrations/stripe/webhook", async (c2) => {
  try {
    const stripeSecret = c2.env.STRIPE_WEBHOOK_SECRET;
    let body;
    if (stripeSecret) {
      const sigHeader = c2.req.header("Stripe-Signature") ?? "";
      const rawBody = await c2.req.text();
      const valid = await verifyStripeSignature(stripeSecret, rawBody, sigHeader);
      if (!valid) {
        return c2.json({ success: false, error: "Stripe signature verification failed" }, 401);
      }
      body = JSON.parse(rawBody);
    } else {
      body = await c2.req.json();
    }
    const existing = await getStripeEventByStripeId(c2.env.DB, body.id);
    if (existing) {
      return c2.json({ success: true, data: { message: "Already processed" } });
    }
    const obj = body.data.object;
    const db = c2.env.DB;
    const friendId = obj.metadata?.line_friend_id ?? null;
    const event = await createStripeEvent(db, {
      stripeEventId: body.id,
      eventType: body.type,
      friendId: friendId ?? void 0,
      amount: obj.amount,
      currency: obj.currency,
      metadata: JSON.stringify(obj.metadata ?? {})
    });
    if (body.type === "payment_intent.succeeded" && friendId) {
      const { applyScoring: applyScoring2 } = await import("./index-BFY0hiw7.js");
      await applyScoring2(db, friendId, "purchase");
      const productId = obj.metadata?.product_id;
      if (productId) {
        const tag = await db.prepare(`SELECT id FROM tags WHERE name = ?`).bind(`purchased_${productId}`).first();
        if (tag) {
          await db.prepare(`INSERT OR IGNORE INTO friend_tags (friend_id, tag_id, assigned_at) VALUES (?, ?, ?)`).bind(friendId, tag.id, jstNow()).run();
        }
      }
      const { fireEvent: fireEvent2 } = await Promise.resolve().then(() => eventBus);
      await fireEvent2(db, "cv_fire", { friendId, eventData: { type: "purchase", amount: obj.amount, stripeEventId: body.id } });
    }
    if (body.type === "customer.subscription.deleted" && friendId) {
      const cancelledTag = await db.prepare(`SELECT id FROM tags WHERE name = 'subscription_cancelled'`).first();
      if (cancelledTag) {
        await db.prepare(`INSERT OR IGNORE INTO friend_tags (friend_id, tag_id, assigned_at) VALUES (?, ?, ?)`).bind(friendId, cancelledTag.id, jstNow()).run();
      }
    }
    return c2.json({
      success: true,
      data: { id: event.id, stripeEventId: event.stripe_event_id, eventType: event.event_type, processedAt: event.processed_at }
    });
  } catch (err) {
    console.error("POST /api/integrations/stripe/webhook error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const health = new Hono();
health.get("/api/accounts/:id/health", async (c2) => {
  try {
    const lineAccountId = c2.req.param("id");
    const [riskLevel, logs] = await Promise.all([
      getLatestRiskLevel(c2.env.DB, lineAccountId),
      getAccountHealthLogs(c2.env.DB, lineAccountId)
    ]);
    return c2.json({
      success: true,
      data: {
        lineAccountId,
        riskLevel,
        logs: logs.map((l) => ({
          id: l.id,
          errorCode: l.error_code,
          errorCount: l.error_count,
          checkPeriod: l.check_period,
          riskLevel: l.risk_level,
          createdAt: l.created_at
        }))
      }
    });
  } catch (err) {
    console.error("GET /api/accounts/:id/health error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
health.get("/api/accounts/migrations", async (c2) => {
  try {
    const items = await getAccountMigrations(c2.env.DB);
    return c2.json({
      success: true,
      data: items.map((m) => ({
        id: m.id,
        fromAccountId: m.from_account_id,
        toAccountId: m.to_account_id,
        status: m.status,
        migratedCount: m.migrated_count,
        totalCount: m.total_count,
        createdAt: m.created_at,
        completedAt: m.completed_at
      }))
    });
  } catch (err) {
    console.error("GET /api/accounts/migrations error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
health.post("/api/accounts/:id/migrate", async (c2) => {
  try {
    const fromAccountId = c2.req.param("id");
    const body = await c2.req.json();
    if (!body.toAccountId) return c2.json({ success: false, error: "toAccountId is required" }, 400);
    const db = c2.env.DB;
    const countResult = await db.prepare(`SELECT COUNT(*) as count FROM friends WHERE is_following = 1`).first();
    const totalCount = countResult?.count ?? 0;
    const migration = await createAccountMigration(db, {
      fromAccountId,
      toAccountId: body.toAccountId,
      totalCount
    });
    await updateAccountMigration(db, migration.id, {
      status: "in_progress"
    });
    return c2.json({
      success: true,
      data: {
        id: migration.id,
        fromAccountId: migration.from_account_id,
        toAccountId: migration.to_account_id,
        status: "in_progress",
        totalCount: migration.total_count,
        createdAt: migration.created_at
      }
    }, 201);
  } catch (err) {
    console.error("POST /api/accounts/:id/migrate error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
health.get("/api/accounts/migrations/:migrationId", async (c2) => {
  try {
    const item = await getAccountMigrationById(c2.env.DB, c2.req.param("migrationId"));
    if (!item) return c2.json({ success: false, error: "Migration not found" }, 404);
    return c2.json({
      success: true,
      data: {
        id: item.id,
        fromAccountId: item.from_account_id,
        toAccountId: item.to_account_id,
        status: item.status,
        migratedCount: item.migrated_count,
        totalCount: item.total_count,
        createdAt: item.created_at,
        completedAt: item.completed_at
      }
    });
  } catch (err) {
    console.error("GET /api/accounts/migrations/:migrationId error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const automations = new Hono();
automations.get("/api/automations", async (c2) => {
  try {
    const lineAccountId = c2.req.query("lineAccountId");
    let items;
    if (lineAccountId) {
      const result = await c2.env.DB.prepare(`SELECT * FROM automations WHERE line_account_id = ? ORDER BY priority DESC, created_at DESC`).bind(lineAccountId).all();
      items = result.results;
    } else {
      items = await getAutomations(c2.env.DB);
    }
    return c2.json({
      success: true,
      data: items.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        eventType: a.event_type,
        conditions: JSON.parse(a.conditions),
        actions: JSON.parse(a.actions),
        isActive: Boolean(a.is_active),
        priority: a.priority,
        createdAt: a.created_at,
        updatedAt: a.updated_at
      }))
    });
  } catch (err) {
    console.error("GET /api/automations error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
automations.get("/api/automations/:id", async (c2) => {
  try {
    const item = await getAutomationById(c2.env.DB, c2.req.param("id"));
    if (!item) return c2.json({ success: false, error: "Automation not found" }, 404);
    const logs = await getAutomationLogs(c2.env.DB, item.id, 50);
    return c2.json({
      success: true,
      data: {
        id: item.id,
        name: item.name,
        description: item.description,
        eventType: item.event_type,
        conditions: JSON.parse(item.conditions),
        actions: JSON.parse(item.actions),
        isActive: Boolean(item.is_active),
        priority: item.priority,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        logs: logs.map((l) => ({
          id: l.id,
          friendId: l.friend_id,
          eventData: l.event_data ? JSON.parse(l.event_data) : null,
          actionsResult: l.actions_result ? JSON.parse(l.actions_result) : null,
          status: l.status,
          createdAt: l.created_at
        }))
      }
    });
  } catch (err) {
    console.error("GET /api/automations/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
automations.post("/api/automations", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.name || !body.eventType || !body.actions) {
      return c2.json({ success: false, error: "name, eventType, actions are required" }, 400);
    }
    const item = await createAutomation(c2.env.DB, body);
    if (body.lineAccountId) {
      await c2.env.DB.prepare(`UPDATE automations SET line_account_id = ? WHERE id = ?`).bind(body.lineAccountId, item.id).run();
    }
    return c2.json({
      success: true,
      data: {
        id: item.id,
        name: item.name,
        eventType: item.event_type,
        actions: JSON.parse(item.actions),
        isActive: Boolean(item.is_active),
        priority: item.priority,
        createdAt: item.created_at
      }
    }, 201);
  } catch (err) {
    console.error("POST /api/automations error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
automations.put("/api/automations/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const body = await c2.req.json();
    await updateAutomation(c2.env.DB, id, body);
    const updated = await getAutomationById(c2.env.DB, id);
    if (!updated) return c2.json({ success: false, error: "Not found" }, 404);
    return c2.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        eventType: updated.event_type,
        conditions: JSON.parse(updated.conditions),
        actions: JSON.parse(updated.actions),
        isActive: Boolean(updated.is_active),
        priority: updated.priority
      }
    });
  } catch (err) {
    console.error("PUT /api/automations/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
automations.delete("/api/automations/:id", async (c2) => {
  try {
    await deleteAutomation(c2.env.DB, c2.req.param("id"));
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/automations/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
automations.get("/api/automations/:id/logs", async (c2) => {
  try {
    const automationId = c2.req.param("id");
    const limit = Number(c2.req.query("limit") ?? "100");
    const logs = await getAutomationLogs(c2.env.DB, automationId, limit);
    return c2.json({
      success: true,
      data: logs.map((l) => ({
        id: l.id,
        automationId: l.automation_id,
        friendId: l.friend_id,
        eventData: l.event_data ? JSON.parse(l.event_data) : null,
        actionsResult: l.actions_result ? JSON.parse(l.actions_result) : null,
        status: l.status,
        createdAt: l.created_at
      }))
    });
  } catch (err) {
    console.error("GET /api/automations/:id/logs error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const richMenus = new Hono();
richMenus.get("/api/rich-menus", async (c2) => {
  try {
    const lineClient = new LineClient(c2.env.LINE_CHANNEL_ACCESS_TOKEN);
    const result = await lineClient.getRichMenuList();
    return c2.json({ success: true, data: result.richmenus ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("GET /api/rich-menus error:", message);
    return c2.json({ success: false, error: `Failed to fetch rich menus: ${message}` }, 500);
  }
});
richMenus.post("/api/rich-menus", async (c2) => {
  try {
    const body = await c2.req.json();
    const lineClient = new LineClient(c2.env.LINE_CHANNEL_ACCESS_TOKEN);
    const result = await lineClient.createRichMenu(body);
    return c2.json({ success: true, data: result }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("POST /api/rich-menus error:", message);
    return c2.json({ success: false, error: `Failed to create rich menu: ${message}` }, 500);
  }
});
richMenus.delete("/api/rich-menus/:id", async (c2) => {
  try {
    const richMenuId = c2.req.param("id");
    const lineClient = new LineClient(c2.env.LINE_CHANNEL_ACCESS_TOKEN);
    await lineClient.deleteRichMenu(richMenuId);
    return c2.json({ success: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("DELETE /api/rich-menus/:id error:", message);
    return c2.json({ success: false, error: `Failed to delete rich menu: ${message}` }, 500);
  }
});
richMenus.post("/api/rich-menus/:id/default", async (c2) => {
  try {
    const richMenuId = c2.req.param("id");
    const lineClient = new LineClient(c2.env.LINE_CHANNEL_ACCESS_TOKEN);
    await lineClient.setDefaultRichMenu(richMenuId);
    return c2.json({ success: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("POST /api/rich-menus/:id/default error:", message);
    return c2.json({ success: false, error: `Failed to set default rich menu: ${message}` }, 500);
  }
});
richMenus.post("/api/friends/:friendId/rich-menu", async (c2) => {
  try {
    const friendId = c2.req.param("friendId");
    const body = await c2.req.json();
    if (!body.richMenuId) {
      return c2.json({ success: false, error: "richMenuId is required" }, 400);
    }
    const db = c2.env.DB;
    const friend = await getFriendById(db, friendId);
    if (!friend) {
      return c2.json({ success: false, error: "Friend not found" }, 404);
    }
    const lineClient = new LineClient(c2.env.LINE_CHANNEL_ACCESS_TOKEN);
    await lineClient.linkRichMenuToUser(friend.line_user_id, body.richMenuId);
    return c2.json({ success: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("POST /api/friends/:friendId/rich-menu error:", message);
    return c2.json({ success: false, error: `Failed to link rich menu to friend: ${message}` }, 500);
  }
});
richMenus.delete("/api/friends/:friendId/rich-menu", async (c2) => {
  try {
    const friendId = c2.req.param("friendId");
    const db = c2.env.DB;
    const friend = await getFriendById(db, friendId);
    if (!friend) {
      return c2.json({ success: false, error: "Friend not found" }, 404);
    }
    const lineClient = new LineClient(c2.env.LINE_CHANNEL_ACCESS_TOKEN);
    await lineClient.unlinkRichMenuFromUser(friend.line_user_id);
    return c2.json({ success: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("DELETE /api/friends/:friendId/rich-menu error:", message);
    return c2.json({ success: false, error: `Failed to unlink rich menu from friend: ${message}` }, 500);
  }
});
richMenus.post("/api/rich-menus/:id/image", async (c2) => {
  try {
    const richMenuId = c2.req.param("id");
    const contentType = c2.req.header("content-type") ?? "";
    let imageData;
    let imageContentType = "image/png";
    if (contentType.includes("application/json")) {
      const body = await c2.req.json();
      if (!body.image) {
        return c2.json({ success: false, error: "image (base64) is required" }, 400);
      }
      const base64 = body.image.replace(/^data:image\/\w+;base64,/, "");
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      imageData = bytes.buffer;
      if (body.contentType === "image/jpeg") imageContentType = "image/jpeg";
    } else if (contentType.includes("image/")) {
      imageData = await c2.req.arrayBuffer();
      imageContentType = contentType.includes("jpeg") || contentType.includes("jpg") ? "image/jpeg" : "image/png";
    } else {
      return c2.json({ success: false, error: "Content-Type must be application/json (with base64) or image/png or image/jpeg" }, 400);
    }
    const lineClient = new LineClient(c2.env.LINE_CHANNEL_ACCESS_TOKEN);
    await lineClient.uploadRichMenuImage(richMenuId, imageData, imageContentType);
    return c2.json({ success: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("POST /api/rich-menus/:id/image error:", message);
    return c2.json({ success: false, error: `Failed to upload rich menu image: ${message}` }, 500);
  }
});
const trackedLinks = new Hono();
function serializeTrackedLink(row, baseUrl) {
  const trackingUrl = `${baseUrl}/t/${row.id}`;
  return {
    id: row.id,
    name: row.name,
    originalUrl: row.original_url,
    trackingUrl,
    tagId: row.tag_id,
    scenarioId: row.scenario_id,
    isActive: Boolean(row.is_active),
    clickCount: row.click_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function getBaseUrl(c2) {
  const url = new URL(c2.req.url);
  return `${url.protocol}//${url.host}`;
}
trackedLinks.get("/api/tracked-links", async (c2) => {
  try {
    const items = await getTrackedLinks(c2.env.DB);
    const base = getBaseUrl(c2);
    return c2.json({ success: true, data: items.map((item) => serializeTrackedLink(item, base)) });
  } catch (err) {
    console.error("GET /api/tracked-links error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
trackedLinks.get("/api/tracked-links/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const link = await getTrackedLinkById(c2.env.DB, id);
    if (!link) {
      return c2.json({ success: false, error: "Tracked link not found" }, 404);
    }
    const clicks = await getLinkClicks(c2.env.DB, id);
    const base = getBaseUrl(c2);
    return c2.json({
      success: true,
      data: {
        ...serializeTrackedLink(link, base),
        clicks: clicks.map((click) => ({
          id: click.id,
          friendId: click.friend_id,
          friendDisplayName: click.friend_display_name,
          clickedAt: click.clicked_at
        }))
      }
    });
  } catch (err) {
    console.error("GET /api/tracked-links/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
trackedLinks.post("/api/tracked-links", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.name || !body.originalUrl) {
      return c2.json({ success: false, error: "name and originalUrl are required" }, 400);
    }
    const link = await createTrackedLink(c2.env.DB, {
      name: body.name,
      originalUrl: body.originalUrl,
      tagId: body.tagId ?? null,
      scenarioId: body.scenarioId ?? null
    });
    const base = getBaseUrl(c2);
    return c2.json({ success: true, data: serializeTrackedLink(link, base) }, 201);
  } catch (err) {
    console.error("POST /api/tracked-links error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
trackedLinks.delete("/api/tracked-links/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const link = await getTrackedLinkById(c2.env.DB, id);
    if (!link) {
      return c2.json({ success: false, error: "Tracked link not found" }, 404);
    }
    await deleteTrackedLink(c2.env.DB, id);
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/tracked-links/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const APP_LINK_DOMAINS = /* @__PURE__ */ new Set([
  "x.com",
  "twitter.com",
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "facebook.com",
  "github.com"
]);
function isAppLinkDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return APP_LINK_DOMAINS.has(hostname);
  } catch {
    return false;
  }
}
const ANDROID_PACKAGES = {
  "x.com": "com.twitter.android",
  "twitter.com": "com.twitter.android",
  "instagram.com": "com.instagram.android",
  "youtube.com": "com.google.android.youtube",
  "youtu.be": "com.google.android.youtube",
  "tiktok.com": "com.zhiliaoapp.musically",
  "facebook.com": "com.facebook.katana",
  "github.com": "com.github.android"
};
function getAndroidPackage(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return ANDROID_PACKAGES[hostname] ?? null;
  } catch {
    return null;
  }
}
function buildAppRedirectHtml(destinationUrl) {
  const escaped = destinationUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const androidPackage = getAndroidPackage(destinationUrl);
  const intentUrl = androidPackage ? `intent://${destinationUrl.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=${androidPackage};S.browser_fallback_url=${encodeURIComponent(destinationUrl)};end` : null;
  const intentEscaped = intentUrl ? intentUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;") : "";
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Redirecting...</title>
<style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui;color:#64748b;background:#f8fafc}p{font-size:14px}</style>
</head><body>
<p>Opening app...</p>
<script>
(function(){
  var isAndroid = /Android/i.test(navigator.userAgent);
  if(isAndroid && "${intentEscaped}"){
    window.location.href="${intentEscaped}";
  } else {
    window.location.href="${escaped}";
  }
})();
<\/script>
<noscript><meta http-equiv="refresh" content="0;url=${escaped}"></noscript>
</body></html>`;
}
trackedLinks.get("/t/:linkId", async (c2) => {
  const linkId = c2.req.param("linkId");
  const lineUserId = c2.req.query("lu") ?? null;
  let friendId = c2.req.query("f") ?? null;
  const link = await getTrackedLinkById(c2.env.DB, linkId);
  if (!link || !link.is_active) {
    return c2.json({ success: false, error: "Link not found" }, 404);
  }
  const useAppRedirect = isAppLinkDomain(link.original_url);
  const ua = c2.req.header("user-agent") || "";
  const isLineApp = /\bLine\b/i.test(ua);
  if (!useAppRedirect && !lineUserId && !friendId && isLineApp && c2.env.LIFF_URL) {
    const directUrl = `${c2.env.WORKER_URL || new URL(c2.req.url).origin}/t/${linkId}`;
    const liffRedirect = `${c2.env.LIFF_URL}?redirect=${encodeURIComponent(directUrl)}`;
    return c2.redirect(liffRedirect, 302);
  }
  if (!friendId && lineUserId) {
    const friend = await getFriendByLineUserId(c2.env.DB, lineUserId);
    if (friend) {
      friendId = friend.id;
    }
  }
  const ctx = c2.executionCtx;
  ctx.waitUntil(
    (async () => {
      try {
        await recordLinkClick(c2.env.DB, linkId, friendId);
        if (friendId) {
          const actions = [];
          if (link.tag_id) {
            actions.push(addTagToFriend(c2.env.DB, friendId, link.tag_id));
          }
          if (link.scenario_id) {
            actions.push(enrollFriendInScenario(c2.env.DB, friendId, link.scenario_id));
          }
          if (actions.length > 0) {
            await Promise.allSettled(actions);
          }
        }
      } catch (err) {
        console.error(`/t/${linkId} async tracking error:`, err);
      }
    })()
  );
  if (useAppRedirect) {
    return c2.html(buildAppRedirectHtml(link.original_url));
  }
  return c2.redirect(link.original_url, 302);
});
const forms = new Hono();
function serializeForm(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    fields: JSON.parse(row.fields || "[]"),
    onSubmitTagId: row.on_submit_tag_id,
    onSubmitScenarioId: row.on_submit_scenario_id,
    saveToMetadata: Boolean(row.save_to_metadata),
    isActive: Boolean(row.is_active),
    submitCount: row.submit_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function serializeSubmission(row) {
  return {
    id: row.id,
    formId: row.form_id,
    friendId: row.friend_id,
    friendName: row.friend_name || null,
    data: JSON.parse(row.data || "{}"),
    createdAt: row.created_at
  };
}
forms.get("/api/forms", async (c2) => {
  try {
    const items = await getForms(c2.env.DB);
    return c2.json({ success: true, data: items.map(serializeForm) });
  } catch (err) {
    console.error("GET /api/forms error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
forms.get("/api/forms/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const form = await getFormById(c2.env.DB, id);
    if (!form) {
      return c2.json({ success: false, error: "Form not found" }, 404);
    }
    return c2.json({ success: true, data: serializeForm(form) });
  } catch (err) {
    console.error("GET /api/forms/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
forms.post("/api/forms", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.name) {
      return c2.json({ success: false, error: "name is required" }, 400);
    }
    const form = await createForm(c2.env.DB, {
      name: body.name,
      description: body.description ?? null,
      fields: JSON.stringify(body.fields ?? []),
      onSubmitTagId: body.onSubmitTagId ?? null,
      onSubmitScenarioId: body.onSubmitScenarioId ?? null,
      saveToMetadata: body.saveToMetadata
    });
    return c2.json({ success: true, data: serializeForm(form) }, 201);
  } catch (err) {
    console.error("POST /api/forms error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
forms.put("/api/forms/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const body = await c2.req.json();
    const updated = await updateForm(c2.env.DB, id, {
      name: body.name,
      description: body.description,
      fields: body.fields !== void 0 ? JSON.stringify(body.fields) : void 0,
      onSubmitTagId: body.onSubmitTagId,
      onSubmitScenarioId: body.onSubmitScenarioId,
      saveToMetadata: body.saveToMetadata,
      isActive: body.isActive
    });
    if (!updated) {
      return c2.json({ success: false, error: "Form not found" }, 404);
    }
    return c2.json({ success: true, data: serializeForm(updated) });
  } catch (err) {
    console.error("PUT /api/forms/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
forms.delete("/api/forms/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const form = await getFormById(c2.env.DB, id);
    if (!form) {
      return c2.json({ success: false, error: "Form not found" }, 404);
    }
    await deleteForm(c2.env.DB, id);
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/forms/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
forms.get("/api/forms/:id/submissions", async (c2) => {
  try {
    const id = c2.req.param("id");
    const form = await getFormById(c2.env.DB, id);
    if (!form) {
      return c2.json({ success: false, error: "Form not found" }, 404);
    }
    const submissions = await getFormSubmissions(c2.env.DB, id);
    return c2.json({ success: true, data: submissions.map(serializeSubmission) });
  } catch (err) {
    console.error("GET /api/forms/:id/submissions error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
forms.post("/api/forms/:id/submit", async (c2) => {
  try {
    const formId = c2.req.param("id");
    const form = await getFormById(c2.env.DB, formId);
    if (!form) {
      return c2.json({ success: false, error: "Form not found" }, 404);
    }
    if (!form.is_active) {
      return c2.json({ success: false, error: "This form is no longer accepting responses" }, 400);
    }
    const body = await c2.req.json();
    const submissionData = body.data ?? {};
    const fields = JSON.parse(form.fields || "[]");
    for (const field of fields) {
      if (field.required) {
        const val = submissionData[field.name];
        if (val === void 0 || val === null || val === "") {
          return c2.json(
            { success: false, error: `${field.label} は必須項目です` },
            400
          );
        }
      }
    }
    let friendId = body.friendId ?? null;
    if (!friendId && body.lineUserId) {
      const friend = await getFriendByLineUserId(c2.env.DB, body.lineUserId);
      if (friend) {
        friendId = friend.id;
      }
    }
    const submission = await createFormSubmission(c2.env.DB, {
      formId,
      friendId: friendId || null,
      data: JSON.stringify(submissionData)
    });
    if (friendId) {
      const db = c2.env.DB;
      const now = jstNow();
      const sideEffects = [];
      if (form.save_to_metadata) {
        sideEffects.push(
          (async () => {
            const friend = await getFriendById(db, friendId);
            if (!friend) return;
            const existing = JSON.parse(friend.metadata || "{}");
            const merged = { ...existing, ...submissionData };
            await db.prepare(`UPDATE friends SET metadata = ?, updated_at = ? WHERE id = ?`).bind(JSON.stringify(merged), now, friendId).run();
          })()
        );
      }
      if (form.on_submit_tag_id) {
        sideEffects.push(addTagToFriend(db, friendId, form.on_submit_tag_id));
      }
      if (form.on_submit_scenario_id) {
        sideEffects.push(enrollFriendInScenario(db, friendId, form.on_submit_scenario_id));
      }
      sideEffects.push(
        (async () => {
          console.log("Form reply: starting for friendId", friendId);
          const friend = await getFriendById(db, friendId);
          if (!friend?.line_user_id) {
            console.log("Form reply: no line_user_id");
            return;
          }
          console.log("Form reply: sending to", friend.line_user_id);
          const { LineClient: LineClient2 } = await import("./index-NYpmBJRY.js");
          let accessToken = c2.env.LINE_CHANNEL_ACCESS_TOKEN;
          if (friend.line_account_id) {
            const { getLineAccountById: getLineAccountById2 } = await import("./index-BFY0hiw7.js");
            const account = await getLineAccountById2(db, friend.line_account_id);
            if (account) accessToken = account.channel_access_token;
          }
          const lineClient = new LineClient2(accessToken);
          const entries = Object.entries(submissionData);
          const answerRows = entries.map(([key, value]) => {
            const field = form.fields ? JSON.parse(form.fields).find((f) => f.name === key) : null;
            const label = field?.label || key;
            const val = Array.isArray(value) ? value.join(", ") : value !== null && value !== void 0 && value !== "" ? String(value) : "-";
            return {
              type: "box",
              layout: "vertical",
              margin: "md",
              contents: [
                { type: "text", text: label, size: "xxs", color: "#64748b" },
                { type: "text", text: val, size: "sm", color: "#1e293b", weight: "bold", wrap: true }
              ]
            };
          });
          const flex = {
            type: "bubble",
            size: "giga",
            header: {
              type: "box",
              layout: "vertical",
              contents: [
                { type: "text", text: "診断結果", size: "lg", weight: "bold", color: "#1e293b" },
                { type: "text", text: `${friend.display_name || ""}さんのプロフィール`, size: "xs", color: "#64748b", margin: "sm" }
              ],
              paddingAll: "20px",
              backgroundColor: "#f0fdf4"
            },
            body: {
              type: "box",
              layout: "vertical",
              contents: [
                ...answerRows,
                { type: "separator", margin: "lg" },
                ...form.save_to_metadata ? [{
                  type: "box",
                  layout: "vertical",
                  margin: "lg",
                  backgroundColor: "#eff6ff",
                  cornerRadius: "md",
                  paddingAll: "12px",
                  contents: [
                    { type: "text", text: "メタデータに自動保存済み。今後の配信があなたに最適化されます。", size: "xxs", color: "#2563EB", wrap: true }
                  ]
                }] : []
              ],
              paddingAll: "20px"
            },
            footer: {
              type: "box",
              layout: "vertical",
              paddingAll: "16px",
              contents: [
                { type: "button", action: { type: "message", label: "アカウント連携を見る", text: "アカウント連携を見る" }, style: "primary", color: "#14b8a6" }
              ]
            }
          };
          const { buildMessage: buildMessage2 } = await Promise.resolve().then(() => stepDelivery);
          await lineClient.pushMessage(friend.line_user_id, [buildMessage2("flex", JSON.stringify(flex))]);
        })()
      );
      if (sideEffects.length > 0) {
        const results = await Promise.allSettled(sideEffects);
        for (const r of results) {
          if (r.status === "rejected") console.error("Form side-effect failed:", r.reason);
        }
      }
    }
    return c2.json({ success: true, data: serializeSubmission(submission) }, 201);
  } catch (err) {
    console.error("POST /api/forms/:id/submit error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
function maskConfig(config) {
  const masked = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string" && value.length > 8) {
      masked[key] = value.slice(0, 4) + "****" + value.slice(-4);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}
const adPlatforms = new Hono();
adPlatforms.get("/api/ad-platforms", async (c2) => {
  try {
    const items = await getAdPlatforms(c2.env.DB);
    return c2.json({
      success: true,
      data: items.map((p) => ({
        id: p.id,
        name: p.name,
        displayName: p.display_name,
        config: maskConfig(JSON.parse(p.config)),
        isActive: !!p.is_active,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }))
    });
  } catch (err) {
    console.error("GET /api/ad-platforms error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
adPlatforms.post("/api/ad-platforms", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.name || !body.config) {
      return c2.json({ success: false, error: "name and config are required" }, 400);
    }
    const validNames = ["meta", "x", "google", "tiktok"];
    if (!validNames.includes(body.name)) {
      return c2.json({ success: false, error: `name must be one of: ${validNames.join(", ")}` }, 400);
    }
    const platform = await createAdPlatform(c2.env.DB, {
      name: body.name,
      displayName: body.displayName,
      config: body.config
    });
    return c2.json({
      success: true,
      data: {
        id: platform.id,
        name: platform.name,
        displayName: platform.display_name,
        config: JSON.parse(platform.config),
        isActive: !!platform.is_active,
        createdAt: platform.created_at,
        updatedAt: platform.updated_at
      }
    }, 201);
  } catch (err) {
    console.error("POST /api/ad-platforms error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
adPlatforms.put("/api/ad-platforms/:id", async (c2) => {
  try {
    const id = c2.req.param("id");
    const body = await c2.req.json();
    const platform = await updateAdPlatform(c2.env.DB, id, body);
    if (!platform) {
      return c2.json({ success: false, error: "Not found" }, 404);
    }
    return c2.json({
      success: true,
      data: {
        id: platform.id,
        name: platform.name,
        displayName: platform.display_name,
        config: JSON.parse(platform.config),
        isActive: !!platform.is_active,
        createdAt: platform.created_at,
        updatedAt: platform.updated_at
      }
    });
  } catch (err) {
    console.error("PUT /api/ad-platforms/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
adPlatforms.post("/api/ad-platforms/test", async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.platform || !body.eventName) {
      return c2.json({ success: false, error: "platform and eventName are required" }, 400);
    }
    const platform = await getAdPlatformByName(c2.env.DB, body.platform);
    if (!platform) {
      return c2.json({ success: false, error: `Platform "${body.platform}" not found or inactive` }, 404);
    }
    if (body.friendId) {
      await sendAdConversions(c2.env.DB, body.friendId, body.eventName);
      return c2.json({ success: true, data: { message: "Test conversion sent via full pipeline" } });
    }
    return c2.json({
      success: true,
      data: {
        message: `Platform "${body.platform}" is configured and active. Provide friendId to send a test conversion.`
      }
    });
  } catch (err) {
    console.error("POST /api/ad-platforms/test error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
adPlatforms.delete("/api/ad-platforms/:id", async (c2) => {
  try {
    await deleteAdPlatform(c2.env.DB, c2.req.param("id"));
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/ad-platforms/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
adPlatforms.get("/api/ad-platforms/:id/logs", async (c2) => {
  try {
    const id = c2.req.param("id");
    const limit = Number(c2.req.query("limit") ?? "50");
    const logs = await getAdConversionLogs(c2.env.DB, id, limit);
    return c2.json({
      success: true,
      data: logs.map((l) => ({
        id: l.id,
        adPlatformId: l.ad_platform_id,
        friendId: l.friend_id,
        eventName: l.event_name,
        clickId: l.click_id,
        clickIdType: l.click_id_type,
        status: l.status,
        errorMessage: l.error_message,
        createdAt: l.created_at
      }))
    });
  } catch (err) {
    console.error("GET /api/ad-platforms/:id/logs error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const staff = new Hono();
function maskApiKey(key) {
  return `lh_****${key.slice(-4)}`;
}
function serializeStaff(row, masked = true) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    apiKey: masked ? maskApiKey(row.api_key) : row.api_key,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
staff.get("/api/staff/me", async (c2) => {
  try {
    const currentStaff = c2.get("staff");
    if (currentStaff.id === "env-owner") {
      return c2.json({
        success: true,
        data: {
          id: "env-owner",
          name: "Owner",
          role: "owner",
          email: null
        }
      });
    }
    const member = await getStaffById(c2.env.DB, currentStaff.id);
    if (!member) {
      return c2.json({ success: false, error: "Staff member not found" }, 404);
    }
    return c2.json({
      success: true,
      data: {
        id: member.id,
        name: member.name,
        role: member.role,
        email: member.email
      }
    });
  } catch (err) {
    console.error("GET /api/staff/me error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
staff.get("/api/staff", requireRole("owner"), async (c2) => {
  try {
    const members = await getStaffMembers(c2.env.DB);
    return c2.json({ success: true, data: members.map((m) => serializeStaff(m, true)) });
  } catch (err) {
    console.error("GET /api/staff error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
staff.get("/api/staff/:id", requireRole("owner"), async (c2) => {
  try {
    const id = c2.req.param("id");
    const member = await getStaffById(c2.env.DB, id);
    if (!member) {
      return c2.json({ success: false, error: "Staff member not found" }, 404);
    }
    return c2.json({ success: true, data: serializeStaff(member, true) });
  } catch (err) {
    console.error("GET /api/staff/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
staff.post("/api/staff", requireRole("owner"), async (c2) => {
  try {
    const body = await c2.req.json();
    if (!body.name) {
      return c2.json({ success: false, error: "name is required" }, 400);
    }
    const validRoles = ["owner", "admin", "staff"];
    if (!body.role || !validRoles.includes(body.role)) {
      return c2.json({ success: false, error: "role must be owner, admin, or staff" }, 400);
    }
    const member = await createStaffMember(c2.env.DB, {
      name: body.name,
      email: body.email ?? null,
      role: body.role
    });
    return c2.json({ success: true, data: serializeStaff(member, false) }, 201);
  } catch (err) {
    console.error("POST /api/staff error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
staff.patch("/api/staff/:id", requireRole("owner"), async (c2) => {
  try {
    const id = c2.req.param("id");
    const body = await c2.req.json();
    const validRoles = ["owner", "admin", "staff"];
    if (body.role !== void 0 && !validRoles.includes(body.role)) {
      return c2.json({ success: false, error: "role must be owner, admin, or staff" }, 400);
    }
    const target = await getStaffById(c2.env.DB, id);
    if (!target) {
      return c2.json({ success: false, error: "Staff member not found" }, 404);
    }
    if (target.role === "owner" && target.is_active === 1) {
      const willLoseOwner = body.role !== void 0 && body.role !== "owner" || body.isActive === false;
      if (willLoseOwner) {
        const ownerCount = await countActiveStaffByRole(c2.env.DB, "owner");
        if (ownerCount <= 1) {
          return c2.json({ success: false, error: "オーナーは最低1人必要です" }, 400);
        }
      }
    }
    const updated = await updateStaffMember(c2.env.DB, id, {
      name: body.name,
      email: body.email,
      role: body.role,
      is_active: body.isActive !== void 0 ? body.isActive ? 1 : 0 : void 0
    });
    if (!updated) {
      return c2.json({ success: false, error: "Staff member not found" }, 404);
    }
    return c2.json({ success: true, data: serializeStaff(updated, true) });
  } catch (err) {
    console.error("PATCH /api/staff/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
staff.delete("/api/staff/:id", requireRole("owner"), async (c2) => {
  try {
    const id = c2.req.param("id");
    const currentStaff = c2.get("staff");
    if (id === currentStaff.id) {
      return c2.json({ success: false, error: "自分自身は削除できません" }, 400);
    }
    const target = await getStaffById(c2.env.DB, id);
    if (!target) {
      return c2.json({ success: false, error: "Staff member not found" }, 404);
    }
    if (target.role === "owner" && target.is_active === 1) {
      const ownerCount = await countActiveStaffByRole(c2.env.DB, "owner");
      if (ownerCount <= 1) {
        return c2.json({ success: false, error: "オーナーは最低1人必要です" }, 400);
      }
    }
    await deleteStaffMember(c2.env.DB, id);
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/staff/:id error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
staff.post("/api/staff/:id/regenerate-key", requireRole("owner"), async (c2) => {
  try {
    const id = c2.req.param("id");
    const exists = await getStaffById(c2.env.DB, id);
    if (!exists) {
      return c2.json({ success: false, error: "Staff member not found" }, 404);
    }
    const newKey = await regenerateStaffApiKey(c2.env.DB, id);
    return c2.json({ success: true, data: { apiKey: newKey } });
  } catch (err) {
    console.error("POST /api/staff/:id/regenerate-key error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const images = new Hono();
images.post("/api/images", async (c2) => {
  try {
    const contentType = c2.req.header("Content-Type") || "";
    let data;
    let mimeType;
    let filename;
    if (contentType.includes("application/json")) {
      const body = await c2.req.json();
      if (!body.data) {
        return c2.json({ success: false, error: "data (base64) is required" }, 400);
      }
      let base64 = body.data;
      if (base64.startsWith("data:")) {
        const match2 = base64.match(/^data:([^;]+);base64,(.+)$/);
        if (match2) {
          mimeType = match2[1];
          base64 = match2[2];
        }
      }
      mimeType ??= body.mimeType ?? "image/png";
      filename = body.filename;
      const binary = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
      data = binary.buffer;
    } else {
      data = await c2.req.arrayBuffer();
      mimeType = contentType.split(";")[0] || "image/png";
    }
    if (data.byteLength > 5 * 1024 * 1024) {
      return c2.json({ success: false, error: "Image too large (max 5MB)" }, 400);
    }
    const allowedTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    if (!allowedTypes.includes(mimeType)) {
      return c2.json({ success: false, error: `Unsupported image type: ${mimeType}. Allowed: ${allowedTypes.join(", ")}` }, 400);
    }
    const ext = mimeType.split("/")[1] === "jpeg" ? "jpg" : mimeType.split("/")[1];
    const id = crypto.randomUUID();
    const key = `${id}.${ext}`;
    await c2.env.IMAGES.put(key, data, {
      httpMetadata: { contentType: mimeType },
      customMetadata: { originalFilename: filename ?? key }
    });
    const workerUrl = c2.env.WORKER_URL || new URL(c2.req.url).origin;
    const url = `${workerUrl}/images/${key}`;
    return c2.json({
      success: true,
      data: { id, key, url, mimeType, size: data.byteLength }
    }, 201);
  } catch (err) {
    console.error("POST /api/images error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
images.get("/images/:key", async (c2) => {
  const key = c2.req.param("key");
  const object = await c2.env.IMAGES.get(key);
  if (!object) {
    return c2.json({ success: false, error: "Image not found" }, 404);
  }
  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType || "image/png");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", object.etag);
  return new Response(object.body, { headers });
});
images.delete("/api/images/:key", async (c2) => {
  try {
    const key = c2.req.param("key");
    await c2.env.IMAGES.delete(key);
    return c2.json({ success: true, data: null });
  } catch (err) {
    console.error("DELETE /api/images/:key error:", err);
    return c2.json({ success: false, error: "Internal server error" }, 500);
  }
});
const app = new Hono();
app.use("*", cors({ origin: "*" }));
app.use("*", rateLimitMiddleware);
app.use("*", authMiddleware);
app.route("/", webhook);
app.route("/", friends);
app.route("/", tags);
app.route("/", scenarios);
app.route("/", broadcasts);
app.route("/", users);
app.route("/", lineAccounts);
app.route("/", conversions);
app.route("/", affiliates);
app.route("/", openapi);
app.route("/", liffRoutes);
app.route("/", webhooks);
app.route("/", calendar);
app.route("/", reminders);
app.route("/", scoring);
app.route("/", templates);
app.route("/", chats);
app.route("/", notifications);
app.route("/", stripe);
app.route("/", health);
app.route("/", automations);
app.route("/", richMenus);
app.route("/", trackedLinks);
app.route("/", forms);
app.route("/", adPlatforms);
app.route("/", staff);
app.route("/", images);
app.get("/r/:ref", (c2) => {
  const ref = c2.req.param("ref");
  const liffUrl = c2.env.LIFF_URL;
  if (!liffUrl) {
    return c2.json({ error: "LIFF_URL is not configured. Set it via wrangler secret put LIFF_URL." }, 500);
  }
  const target = `${liffUrl}?ref=${encodeURIComponent(ref)}`;
  return c2.html(`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LINE Harness</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Hiragino Sans',system-ui,sans-serif;background:#0d1117;color:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh}
.card{text-align:center;max-width:400px;width:90%;padding:48px 24px}
h1{font-size:28px;font-weight:800;margin-bottom:8px}
.sub{font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:40px}
.btn{display:block;width:100%;padding:18px;border:none;border-radius:12px;font-size:18px;font-weight:700;text-decoration:none;text-align:center;color:#fff;background:#06C755;transition:opacity .15s}
.btn:active{opacity:.85}
.note{font-size:12px;color:rgba(255,255,255,0.3);margin-top:24px;line-height:1.6}
</style>
</head>
<body>
<div class="card">
<h1>LINE Harness</h1>
<p class="sub">L社 / U社 の無料代替 OSS</p>
<a href="${target}" class="btn">LINE で体験する</a>
<p class="note">友だち追加するだけで<br>ステップ配信・フォーム・自動返信を体験できます</p>
</div>
</body>
</html>`);
});
app.get("/book", (c2) => c2.redirect("/?page=book"));
app.notFound((c2) => {
  const path = new URL(c2.req.url).pathname;
  if (path.startsWith("/api/") || path === "/webhook" || path === "/docs" || path === "/openapi.json") {
    return c2.json({ success: false, error: "Not found" }, 404);
  }
  return c2.notFound();
});
async function scheduled(_event, env, _ctx) {
  const dbAccounts = await getLineAccounts(env.DB);
  const activeTokens = /* @__PURE__ */ new Set();
  activeTokens.add(env.LINE_CHANNEL_ACCESS_TOKEN);
  for (const account of dbAccounts) {
    if (account.is_active) {
      activeTokens.add(account.channel_access_token);
    }
  }
  const lineClients = /* @__PURE__ */ new Map();
  for (const account of dbAccounts) {
    if (account.is_active) {
      lineClients.set(account.id, new LineClient(account.channel_access_token));
    }
  }
  const defaultLineClient = new LineClient(env.LINE_CHANNEL_ACCESS_TOKEN);
  const jobs = [];
  for (const token of activeTokens) {
    const lineClient = new LineClient(token);
    jobs.push(
      processStepDeliveries(env.DB, lineClient, env.WORKER_URL),
      processScheduledBroadcasts(env.DB, lineClient, env.WORKER_URL),
      processReminderDeliveries(env.DB, lineClient)
    );
  }
  jobs.push(checkAccountHealth(env.DB));
  jobs.push(refreshLineAccessTokens(env.DB));
  await Promise.allSettled(jobs);
  try {
    await processInsightFetch(env.DB, lineClients, defaultLineClient);
  } catch (e) {
    console.error("Insight fetch error:", e);
  }
}
const index = {
  fetch: app.fetch,
  scheduled
};
const workerEntry = index ?? {};
export {
  deleteConversionPoint as $,
  createChat as A,
  createConversionPoint as B,
  createEntryRoute as C,
  createForm as D,
  createFormSubmission as E,
  createIncomingWebhook as F,
  createLineAccount as G,
  createNotification as H,
  createNotificationRule as I,
  createOperator as J,
  createOutgoingWebhook as K,
  LineClient as L,
  createReminder as M,
  createReminderStep as N,
  createScenario as O,
  createScenarioStep as P,
  createScoringRule as Q,
  createStaffMember as R,
  createStripeEvent as S,
  createTag as T,
  createTemplate as U,
  createUser as V,
  deleteAdPlatform as W,
  deleteAffiliate as X,
  deleteAutomation as Y,
  deleteBroadcast as Z,
  deleteCalendarConnection as _,
  getScenarios as a,
  getFriendScoreHistory as a$,
  deleteEntryRoute as a0,
  deleteForm as a1,
  deleteIncomingWebhook as a2,
  deleteLineAccount as a3,
  deleteNotificationRule as a4,
  deleteOperator as a5,
  deleteOutgoingWebhook as a6,
  deleteReminder as a7,
  deleteReminderStep as a8,
  deleteScenario as a9,
  getAutomations as aA,
  getBookingsInRange as aB,
  getBroadcastById as aC,
  getBroadcasts as aD,
  getCalendarBookingById as aE,
  getCalendarBookings as aF,
  getCalendarConnectionById as aG,
  getCalendarConnections as aH,
  getChatByFriendId as aI,
  getChatById as aJ,
  getChats as aK,
  getConversionEvents as aL,
  getConversionPointById as aM,
  getConversionPoints as aN,
  getConversionReport as aO,
  getDueReminderDeliveries as aP,
  getEntryRouteByRefCode as aQ,
  getEntryRoutes as aR,
  getFormById as aS,
  getFormSubmissions as aT,
  getForms as aU,
  getFriendById as aV,
  getFriendByLineUserId as aW,
  getFriendCount as aX,
  getFriendReminders as aY,
  getFriendScenariosDueForDelivery as aZ,
  getFriendScore as a_,
  deleteScenarioStep as aa,
  deleteScoringRule as ab,
  deleteStaffMember as ac,
  deleteTag as ad,
  deleteTemplate as ae,
  deleteTrackedLink as af,
  deleteUser as ag,
  enrollFriendInReminder as ah,
  getAccountHealthLogs as ai,
  getAccountMigrationById as aj,
  getAccountMigrations as ak,
  getActiveAdPlatforms as al,
  getActiveAutomationsByEvent as am,
  getActiveNotificationRulesByEvent as an,
  getActiveOutgoingWebhooksByEvent as ao,
  getActiveRulesByEvent as ap,
  getAdConversionLogs as aq,
  getAdPlatformById as ar,
  getAdPlatformByName as as,
  getAdPlatforms as at,
  getAffiliateByCode as au,
  getAffiliateById as av,
  getAffiliateReport as aw,
  getAffiliates as ax,
  getAutomationById as ay,
  getAutomationLogs as az,
  getScenarioSteps as b,
  updateEntryRoute as b$,
  getFriendTags as b0,
  getFriends as b1,
  getFriendsByTag as b2,
  getIncomingWebhookById as b3,
  getIncomingWebhooks as b4,
  getLatestRiskLevel as b5,
  getLineAccountByChannelId as b6,
  getLineAccounts as b7,
  getLinkClicks as b8,
  getNotificationRuleById as b9,
  getUserByEmail as bA,
  getUserById as bB,
  getUserByPhone as bC,
  getUserFriends as bD,
  getUsers as bE,
  isTimeBefore as bF,
  linkFriendToUser as bG,
  logAdConversion as bH,
  markInsightFailed as bI,
  markReminderStepDelivered as bJ,
  recordAffiliateClick as bK,
  recordLinkClick as bL,
  recordRefTracking as bM,
  regenerateStaffApiKey as bN,
  removeTagFromFriend as bO,
  toJstString as bP,
  trackConversion as bQ,
  updateAccountMigration as bR,
  updateAdPlatform as bS,
  updateAffiliate as bT,
  updateAutomation as bU,
  updateBroadcast as bV,
  updateBroadcastLineRequestId as bW,
  updateBroadcastStatus as bX,
  updateCalendarBookingEventId as bY,
  updateCalendarBookingStatus as bZ,
  updateChat as b_,
  getNotificationRules as ba,
  getNotifications as bb,
  getOperatorById as bc,
  getOperators as bd,
  getOutgoingWebhookById as be,
  getOutgoingWebhooks as bf,
  getPendingInsights as bg,
  getRefTrackingByFriend as bh,
  getRefTrackingStats as bi,
  getRefTrackingWithClickIds as bj,
  getReminderById as bk,
  getReminderSteps as bl,
  getReminders as bm,
  getScenarioById as bn,
  getScoringRuleById as bo,
  getScoringRules as bp,
  getStaffByApiKey as bq,
  getStaffById as br,
  getStaffMembers as bs,
  getStripeEventByStripeId as bt,
  getStripeEvents as bu,
  getTags as bv,
  getTemplateById as bw,
  getTemplates as bx,
  getTrackedLinkById as by,
  getTrackedLinks as bz,
  createTrackedLink as c,
  updateForm as c0,
  updateFriendFollowStatus as c1,
  updateIncomingWebhook as c2,
  updateInsightResult as c3,
  updateLineAccount as c4,
  updateNotificationRule as c5,
  updateNotificationStatus as c6,
  updateOperator as c7,
  updateOutgoingWebhook as c8,
  updateReminder as c9,
  updateScenario as ca,
  updateScenarioStep as cb,
  updateScoringRule as cc,
  updateStaffMember as cd,
  updateTemplate as ce,
  updateUser as cf,
  upsertChatOnMessage as cg,
  upsertFriend as ch,
  workerEntry as ci,
  addTagToFriend as d,
  enrollFriendInScenario as e,
  applyScoring as f,
  getLineAccountById as g,
  addScore as h,
  advanceFriendScenario as i,
  jstNow as j,
  cancelFriendReminder as k,
  completeFriendScenario as l,
  completeReminderIfDone as m,
  countActiveStaffByRole as n,
  countStaffByRole as o,
  createAccountHealthLog as p,
  createAccountMigration as q,
  createAdPlatform as r,
  createAffiliate as s,
  createAutomation as t,
  createAutomationLog as u,
  verifySignature as v,
  createBroadcast as w,
  createBroadcastInsight as x,
  createCalendarBooking as y,
  createCalendarConnection as z
};
