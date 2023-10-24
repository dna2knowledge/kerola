const i_fs = require('fs');
const i_path = require('path');
const i_crypto = require('crypto');
const i_sp = require('child_process').spawn;
const i_adapter = require('./adapter/index');
const i_config = require('./config');

function run(cmd, args, opt) {
   return new Promise((r, e) => {
      opt = opt || {};
      opt.timeout = (opt.timeout && opt.timeout !== 0) ? opt.timeout : 0;
      const env = {};
      env.end = false;
      env.timeout = false;
      env.error = null;
      const popt = {};
      if (!opt.stdout && !opt.stderr) popt.stdio = 'ignore';
      const p = i_sp(cmd, args, popt);
      if (opt.stdout) p.stdout.pipe(i_fs.createWriteStream(opt.stdout));
      if (opt.stderr) p.stderr.pipe(i_fs.createWriteStream(opt.stderr));
      if (opt.timeout) {
         env.timer = setTimeout((env) => {
            env.timer = 0;
            if (env.error || env.end) return;
            console.log('timeout', cmd, JSON.stringify(args));
            if (p) p.kill();
            env.timeout = true;
            env.end = true;
            e('timeout');
         }, opt.timeout, env);
      }
      // XXX: p.stdout.on('data'), p.stderr
      p.on('error', (err) => {
         if (env.timeout || env.end) return;
         if (env.timer) clearTimeout(env.timer);
         env.error = true;
         console.log('error', cmd, JSON.stringify(args));
         e(err);
      });
      p.on('exit', (code) => {
         if (env.end || env.timeout || env.error) return;
         if (env.timer) clearTimeout(env.timer);
         env.end = true;
         r(code);
      });
      // XXX: p.on('close', (code) => { ... });
      // start -> exit -> close
      //     \---> timeout (error)
   });
}

const env = {
   buildCmd: {
      google: require('./protocols/google').buildCmd,
      bing: require('./protocols/bing').buildCmd,
      bingcn: require('./protocols/bingcn').buildCmd,
      baidu: require('./protocols/baidu').buildCmd,
      _default: require('./protocols/https').buildCmd,
   },
   actAvailable: i_config.CR_ACT_N,
   tmpDir: i_config.CR_TMP_DIR,
   queueMax: i_config.CR_QUEUE_MAX,
   queue: [],
   queueMap: {},
   currentTask: {},
};

function cleanupParam(param) {
   if (param) {
      Object.keys(param).forEach(k => {
         if (!param[k]) delete param[k];
      });
      if (Object.keys(param).length === 0) param = undefined;
   }
   return param;
}

async function request(url, priority, param) {
   if (!url) return;
   const reqObj = await i_adapter.logic.getReqByUrl(url);
   param = cleanupParam(param);
   if (reqObj) {
      await i_adapter.logic.updateReq(reqObj.id, {
         url, param,
         pr: priority || 0,
         ok: 0,
         ts: new Date().getTime(),
      });
   } else {
      await i_adapter.logic.updateReq(null, {
         url, param,
         pr: priority || 0,
         ok: 0,
         ts: new Date().getTime(),
      });
   }
}

async function requestObj(obj, priority) {
   if (!obj || !obj.url) return;
   const url = obj.url;
   if (!url) return;
   const param = cleanupParam(Object.assign({}, obj));
   delete param.url;
   const reqObj = await i_adapter.logic.getReqByUrl(url);
   if (reqObj) {
      await i_adapter.logic.updateReq(reqObj.id, {
         url, param,
         pr: priority || 0,
         ok: 0,
         ts: new Date().getTime(),
      });
   } else {
      await i_adapter.logic.updateReq(null, {
         url, param,
         pr: priority || 0,
         ok: 0,
         ts: new Date().getTime(),
      });
   }
}

async function scheduleOnce() {
   const qN = env.queue.length;
   const quota = env.queueMax - qN;
   if (quota <= 0) return false;
   const reqs = await i_adapter.logic.getSomeTodoReqs(quota);
   if (!reqs || !reqs.items) {
      console.log(`[E] schedule failed ...`);
      return;
   }
   reqs.items.forEach(z => {
      if (env.queueMap[z.url]) return;
      env.queueMap[z.url] = 1;
      env.queue.push(z);
   });
   if (env.queue.length > 0) {
      console.log('schedule', qN, '->', env.queue.length);
      act();
   }
}

async function schedule() {
   await scheduleOnce();
   next();

   function next() {
      setTimeout(schedule, 5000);
   }
}

function getProtocol(url) {
   if (!url) return null;
   const p = url.split('/');
   if (!p[0]) return 'file';
   return p[0].split(':')[0];
}

async function buildCmd(task) {
   const proto = getProtocol(task.url);
   const buildCmdFn = env.buildCmd[proto] || env.buildCmd._default;
   const cmd = buildCmdFn(task);
   console.log('task.cmd', JSON.stringify(cmd));
   return cmd;
}

async function act() {
   if (!env.queue.length) return;
   if (!env.actAvailable) return;
   env.actAvailable --;
   const task = env.queue.shift();
   console.log('task', task.url);
   let tid;
   while(!tid || env.currentTask[tid]) tid = i_crypto.randomUUID();
   env.currentTask[tid] = task;
   const taskobj = Object.assign({}, task);
   delete taskobj.id;
   try {
      const cmd = await buildCmd(task);
      const outF = i_path.join(env.tmpDir, `${task.id}.out`);
      const code = await run(cmd[0], cmd.slice(1), { stdout: outF, timeout: 60 * 1000 });
      if (code) throw 'abnormal-exit';
      delete env.queueMap[task.url];
      await i_adapter.logic.updateReq(task.id, Object.assign(taskobj, {
         ok: 1,
         ts: new Date().getTime(),
      }));
      const dom = i_fs.readFileSync(outF).toString();
      i_fs.unlinkSync(outF);
      await i_adapter.logic.updateRaw(task.url, JSON.stringify({
         url: task.url,
         dom,
         ok: 0,
         ts: new Date().getTime(),
      }));
      // async run, no wait
      if (task.param?.recursive) recursiveRequest(taskobj, dom);
   } catch(err) {
      delete env.queueMap[task.url];
      await i_adapter.logic.updateReq(task.id, Object.assign(taskobj, {
         ok: -1,
         ts: new Date().getTime(),
      }));
   }
   delete env.currentTask[tid];
   env.actAvailable ++;
   next();

   function next() {
      setTimeout(act, 1000);
   }
}

const jsdom = require('jsdom');

function compileHrefs(as, url) {
   const hrefs = [];
   for (let i = 0; i < as.length; i++) {
      const a = as[i];
      const obj = {};
      obj.href = a.getAttribute('href');
      if (obj.href && !/^(\w+:)?\/\//.test(obj.href)) {
         if (obj.href.startsWith('javascript:')) continue;
         if (obj.href.startsWith('/')) {
            obj.href = url.split('/').slice(0, 3).join('/') + obj.href;
         } else if (obj.href.startsWith('#')) {
            // TODO: detect if it is an anchor or a page (e.g. url hash mode)
            obj.href = url.split('#')[0] + obj.href;
         } else if (obj.href.startsWith('?')) {
            obj.href = url.split('?')[0] + obj.href;
         } else if (obj.href.startsWith('tel:') || obj.href.startsWith('mailto:')) {
            continue;
         } else {
            const ps = url.split('/');
            const base = ps.slice(0, 3).join('/');
            ps.splice(0, 3);
            ps.pop();
            const hash = obj.href.split('#')[1] || '';
            const query = obj.href.split('?')[1] || '';
            obj.href.split('?')[0].split('/').forEach(z => z === '..' ? ps.pop() : (z !== '.' && ps.push(z)));
            obj.href = base + '/' + ps.join('/') + (query ? query : hash);
         }
      }
      obj.text = a.textContent;
      obj.href && hrefs.push(obj);
   }
   return hrefs;
}
function distinctHrefs(hrefs) {
   const map = {};
   hrefs.forEach(hrefObj => {
      if (!map[hrefObj.href]) map[hrefObj.href] = [];
      if (!hrefObj.text) return;
      map[hrefObj.href].push(hrefObj.text);
   });
   return Object.keys(map).map(url => ({ href: url, text: map[url].join(', ') }));
}

function matchHost(url, host) {
   if (!url) return false;
   return url.split('/')[2] === host;
}
function matchRootHost(url, rootHost) {
   if (!url) return false;
   const host = url.split('/')[2].split(':')[0];
   if (host === rootHost) return true;
   if (host.endsWith(rootHost)) {
      // a.b.c, b.c -> true
      if (host.charAt(host.length - rootHost.length - 1) === '.') return true;
      // ab.c, b.c -> false
   }
   return false;
}
function getRootHost(host) {
   const parts = host.split(':')[0].split('.');
   if (parts.length <= 2) return parts.join('.');
   return parts.slice(parts.length-2).join('.');
}

async function recursiveRequest(taskobj, dom) {
   // recursive: crawl recursively with the same host (e.g. sub.root.region:8080)
   // recursiveGroup: crawl recursively with the same root host (e.g. root.region)
   if (!taskobj || !taskobj.param?.recursive) return;
   const url = taskobj.url;
   console.log('recursive', url);
   const ps = url.split('/');
   const protocol = ps[0];
   if (protocol !== 'http:' && protocol !== 'https:') return;
   const domain = ps[2]; // abc.def:1234
   const html = new jsdom.JSDOM(dom);
   const doc = html.window.document;
   const matchFn = taskobj.param?.recursiveGroup ? matchRootHost : matchHost;
   const host = taskobj.param?.recursiveGroup ? getRootHost(domain) : domain;
   const hrefs = distinctHrefs(compileHrefs(doc.querySelectorAll('a'), url)).filter(z => {
      const link = z.href;
      return matchFn(z.href, host);
   });
   for(let i = 0; i < hrefs.length; i++) {
      const linkobj = hrefs[i];
      try {
         const data = await i_adapter.logic.getRawByUrl(linkobj.href);
         if (data) continue;
      } catch(err) { }
      await request(linkobj.href, taskobj.pr || 0, taskobj.param);
      console.log('recursive_pick', linkobj.href);
   }
}

async function collectStat() {
   const obj = {};
   obj.running = Object.values(env.currentTask);
   obj.queue = env.queue.map(z => Object.assign({}, z));
   return obj;
}

module.exports = {
   run,
   request,
   requestObj,
   schedule,
   scheduleOnce,
   act,
   collectStat,
};
