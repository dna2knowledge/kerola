// version 1.0.1

const i_fs = require('fs');
const i_path = require('path');
const i_url = require('url');
const i_crypto = require('crypto');
const i_config = require('./config');

const i_env = {
   debug: i_config.TINY_DEBUG,
   server: {
      host: i_config.TINY_HOST,
      port: i_config.TINY_PORT,
      httpsCADir: i_config.TINY_HTTPS_CA_DIR,
      hostAllow: i_config.HOSTALLOW,
      maxPayload: i_config.MAX_PAYLOAD_SIZE,
      userpassF: i_config.AUTH_USERPASS_FILE,
   },
};

function basicRoute (req, res, router) {
   const r = i_url.parse(req.url);
   const originPath = r.pathname.split('/');
   const path = originPath.slice();
   const query = {};
   let f = router;
   if (r.query) r.query.split('&').forEach((one) => {
      let key, val;
      let i = one.indexOf('=');
      if (i < 0) {
         key = one;
         val = '';
      } else {
         key = one.substring(0, i);
         val = one.substring(i+1);
      }
      if (key in query) {
         if(Array.isArray(query[key])) {
            query[key].push(val);
         } else {
            query[key] = [query[key], val];
         }
      } else {
         query[key] = val;
      }
   });
   path.shift();
   if (typeof(f) === 'function') {
      return f(req, res, {
         path: path,
         query: query
      });
   }
   while (path.length > 0) {
      let key = path.shift();
      f = f[key];
      if (!f) break;
      if (typeof(f) === 'function' && key !== 'constructor') {
         return f(req, res, {
            path: path,
            query: query
         });
      }
   }
   return serveCode(req, res, 404, 'Not Found');
}

function serveCode(req, res, code, text) {
   res.writeHead(code || 500, text || '');
   res.end();
}

function createServer(router) {
   let server = null;
   if (typeof(router) !== 'function') {
     router = Object.assign({}, router);
   }
   if (i_env.server.httpsCADir) {
      const i_https = require('https');
      const https_config = {
         // openssl req -newkey rsa:2048 -new -nodes -x509 -days 365 -keyout ca.key -out ca.crt
         key: i_fs.readFileSync(i_path.join(i_env.server.httpsCADir, 'ca.key')),
         cert: i_fs.readFileSync(i_path.join(i_env.server.httpsCADir, 'ca.crt')),
      };
      server = i_https.createServer(https_config, (req, res) => {
         basicRoute(req, res, router);
      });
   } else {
      const i_http = require('http');
      server = i_http.createServer((req, res) => {
         basicRoute(req, res, router);
      });
   }
   return server;
}

const env = {
   passmap: JSON.parse(i_fs.readFileSync(i_env.server.userpassF)),
   session: {},
};
const util = {
   sendJson: (res, json) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(json)); },
   readRequestJson: (req) => {
      return new Promise((resolve, reject) => {
         let size = 0;
         let over = false;
         const body = [];
         req.on('data', (chunk) => {
            if (over) return;
            size += chunk.length;
            if (size > i_env.server.maxPayload) {
               over = true;
               reject(new Error('payload too large'));
               return;
            }
            body.push(chunk);
         });
         req.on('end', () => {
            if (over) return;
            const bodyraw = Buffer.concat(body).toString();
            try {
               const body0 = JSON.parse(bodyraw);
               resolve(body0);
            } catch(e) {
               resolve(null);
            }
         })
      });
   },
   login: (user, pass) => {
      return new Promise((r) => {
         if (!pass || env.passmap[user] !== pass) return r(null);
         const uuid = i_crypto.randomUUID();
         env.session[user] = uuid;
         r(uuid);
      });
   },
   logout: (user) => new Promise((r) => {
      delete env.session[user];
      r();
   }),
}

async function auth(reqJson, res) {
   try {
      const user = reqJson.user;
      const token = reqJson.token;
      if (!token || !user || env.session[user] !== token) throw 'unauthenticated';
      return true;
   } catch(err) {
      res.writeHead(401);
      res.end();
      return false;
   }
}

function requireLogin(fn) {
   return async function(req, res, opt) {
      try {
         const json = await util.readRequestJson(req);
         opt = opt || {};
         opt.json = json;
         const loggedin = await auth(opt.json, res);
         if (!loggedin) return;
         fn(req, res, opt);
      } catch(err) {
         res.writeHead(500);
         res.end();
      }
   };
}

function cors(res) {
   res.setHeader('Access-Control-Allow-Origin', '*');
   res.setHeader('Access-Control-Allow-Headers', '*');
   return true;
}

function buildQuery(req) {
   const q = req.url.split('?')[1];
   const obj = {};
   if (!q) return obj;
   q.split('&').forEach((z) => {
      const parts = z.split('=');
      obj[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
   });
   return obj;
}

const i_adapter = require('./adapter/index');
const i_crawler = require('./crawler');
const i_pagelink = require('./analysis/pagelink');

const server = createServer({
   api: {
      ping: (req, res, opt) => res.end('pong'),
      login: async (req, res, opt) => {
         try {
            const json = await util.readRequestJson(req);
            const user = json.user;
            const pass = json.pass;
            const token = await util.login(user, pass);
            if (!token) {
               res.writeHead(401); res.end();
               return;
            }
            util.sendJson(res, { token, });
         } catch(err) {
            res.writeHead(500); res.end();
         }
      },
      authcheck: requireLogin((req, res, opt) => {
         util.sendJson(res, { ok: 1 });
      }),
      logout: requireLogin((req, res, opt) => {
         util.logout(opt.json.user);
         util.sendJson(res, { ok: 1 });
      }),
      crawler: {
         req: requireLogin((req, res, opt) => {
            const q = opt.json.q;
            const pr = opt.json.pr; // priority
            const memo = opt.json.memo;
            // mode = null, "curl", "chrome", "wrapper"
            // null / "wrapper": use chrome wrapper script
            // curl: use curl
            // chrome: use direct chrome + "--dump-dom" direct
            const mode = opt.json.mode;
            const isRecursive = opt.json.nest;
            const isOverwrite = opt.json.overwrite;
            const timeoutMs = opt.json.timeout;
            if (!q) { res.writeHead(400); return res.end(); }
            if (q.startsWith('http://') || q.startsWith('https://')) {
               (async () => {
                  try {
                     const param = {
                        memo,
                        recursive: isRecursive,
                     };
                     if (mode === 'curl') param.curl = true;
                     else if (mode === 'chrome') param.chromium = true;
                     else if (mode === 'puppeteer') param.puppeteer = true;
                     else if (mode === 'webkit') param.webkit = true;
                     // else mode = 'firefox'
                     if (isOverwrite) param.once = Object.assign({ overwrite: true }, param.once);
                     if (timeoutMs) {
                        param.timeout = parseInt(timeoutMs);
                        if (isNaN(param.timeout) || param.timeout <= 0) delete param.timeout;
                     }
                     await i_crawler.request(q, pr, param);
                     util.sendJson(res, { ok: 1 });
                  } catch(err) {
                     res.writeHead(500); res.end();
                  }
               })();
            } else if (q.startsWith('bing://') || q.startsWith('google://') || q.startsWith('baidu://') || q.startsWith('bingcn://')) {
               (async () => {
                  try {
                     // should not do recursively; currently it only has uppeteer impl
                     await i_crawler.request(q, pr, { memo, puppeteer: true });
                     util.sendJson(res, { ok: 1 });
                  } catch(err) {
                     res.writeHead(500); res.end();
                  }
               })();
            } else {
               // TODO: start a search in bing/google/baidu...
               res.writeHead(501); return res.end();
            }
         }),
         stat: requireLogin((req, res, opt) => {
            (async () => {
               try {
                  const stat = await i_crawler.collectStat();
                  util.sendJson(res, stat);
               } catch (err) {
                  res.writeHead(500); res.end();
               }
            })();
         }),
         get: requireLogin((req, res, opt) => {
            const id = opt.json.id;
            if (!id) { res.writeHead(400); return res.end(); }
            (async () => {
               try {
                  const item = await i_adapter.logic.getReqById(id);
                  util.sendJson(res, item);
               } catch (err) {
                  res.writeHead(500); res.end();
               }
            })();
         }),
         search: requireLogin((req, res, opt) => {
            const q = opt.json.q;
            const from = opt.json.from || 0;
            const size = 10;
            if (!q) { res.writeHead(400); return res.end(); }
            (async () => {
               try {
                  const items = await i_adapter.logic.searchReqs(q, from, size);
                  util.sendJson(res, items);
               } catch (err) {
                  res.writeHead(500); res.end();
               }
            })();
         }),
      },
      raw: {
         get: requireLogin((req, res, opt) => {
            const url = opt.json.url;
            if (!url) { res.writeHead(400); return res.end(); }
            (async () => {
               try {
                  const item = await i_adapter.logic.getRawByUrl(url);
                  util.sendJson(res, Object.assign({ url: item?.url }, item?.raw));
               } catch (err) {
                  res.writeHead(500); res.end();
               }
            })();
         }),
         uet: requireLogin((req, res, opt) => {
            const url = opt.json.url;
            const tag = opt.json.tag || '';
            const extracted = !!opt.json.extracted;
            if (!url) { res.writeHead(400); return res.end(); }
            (async () => {
               try {
                  const item = await i_adapter.logic.getRawByUrl(url, tag);
                  if (item && item.raw && extracted) {
                     item.raw.extracted = i_pagelink.extractBasicInfo(item.raw.dom, item.url);
                  }
                  util.sendJson(res, Object.assign({ url: item?.url }, item?.raw));
               } catch (err) {
                  res.writeHead(500); res.end();
               }
            })();
         }),
         search: requireLogin((req, res, opt) => {
            const q = opt.json.q;
            const from = opt.json.from || 0;
            const size = 10;
            if (!q) { res.writeHead(400); return res.end(); }
            (async () => {
               try {
                  const rs = await i_adapter.logic.searchReqs(q, from, size);
                  const items = rs.items;
                  for (let i = 0, n = items?.length || 0; i < n; i++) {
                     const item = items[i];
                     const url = item.url;
                     try {
                        const obj = JSON.parse((await i_adapter.logic.getRawByUrl(url)).raw);
                        item.dom = obj.dom;
                     } catch (err) {
                     }
                  }
                  util.sendJson(res, rs);
               } catch (err) {
                  res.writeHead(500); res.end();
               }
            })();
         }),
         extract: requireLogin((req, res, opt) => {
            res.writeHead(501); res.end();
         }),
      },
      cooked: {
         get: requireLogin((req, res, opt) => {
            const id = opt.json.id;
            if (!id) { res.writeHead(400); return res.end(); }
            (async () => {
               try {
                  const item = await i_adapter.logic.getCookedById(id);
                  const ref = item ? (await i_adapter.logic.getRefById(id)) : null;
                  util.sendJson(res, { truth: item, ref, });
               } catch (err) {
                  res.writeHead(500); res.end();
               }
            })();
         }),
         search: requireLogin((req, res, opt) => {
            const q = opt.json.q;
            const from = opt.json.from || 0;
            const size = 10;
            if (!q) { res.writeHead(400); return res.end(); }
            (async () => {
               try {
                  const items = await i_adapter.logic.searchCookeds(q, from, size);
                  util.sendJson(res, items);
               } catch (err) {
                  res.writeHead(500); res.end();
               }
            })();
         }),
         update: requireLogin((req, res, opt) => {
            const id = opt.json.id || null;
            const obj = opt.json.obj;
            if (!obj || !obj.name) { res.writeHead(400); return res.end(); }
            (async () => {
               try {
                  const rs = await i_adapter.logic.updateCooked(id, obj);
                  const resObj = { ok : 1 };
                  if (rs && rs._id) resObj.id = rs._id;
                  util.sendJson(res, resObj);
               } catch (err) {
                  res.writeHead(500); res.end();
               }
            })();
         }),
         getRef: requireLogin((req, res, opt) => {
            const id = opt.json.id;
            if (!id) { res.writeHead(400); return res.end(); }
            (async () => {
               try {
                  const item = await i_adapter.logic.getRefById(id);
                  util.sendJson(res, item);
               } catch (err) {
                  res.writeHead(500); res.end();
               }
            })();
         }),
         updateRef: requireLogin((req, res, opt) => {
            const id = opt.json.id || null;
            const name = opt.json.name || null;
            const obj = opt.json.obj;
            if ((!id && !name) || !obj) { res.writeHead(400); return res.end(); }
            (async () => {
               try {
                  const rs = await i_adapter.logic.updateRef(id, name, obj);
                  const resObj = { ok : 1 };
                  if (rs && rs._id) resObj.id = rs._id;
                  util.sendJson(res, resObj);
               } catch (err) {
                  res.writeHead(500); res.end();
               }
            })();
         }),
      },
   },
});
// start crawler
i_crawler.schedule();
server.listen(i_env.server.port, i_env.server.host, () => {
   console.log(`KEROLA SERVER is listening at ${i_env.server.host}:${i_env.server.port} ...`);
});
