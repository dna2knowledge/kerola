const i_fs = require('fs');
const i_path = require('path');
const i_url = require('url');
const i_crypto = require('crypto');
const i_sp = require('child_process').spawn;
const i_es = require('./es');
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
      bingcn: require('./protocols/bingcn').buildCmd,
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
   const reqObj = await i_es.logic.getReqByUrl(url);
   param = cleanupParam(param);
   if (reqObj) {
      await i_es.logic.updateReq(reqObj.id, {
         url, param,
         pr: priority || 0,
         ok: 0,
         ts: new Date().getTime(),
      });
   } else {
      await i_es.logic.updateReq(null, {
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
   const reqObj = await i_es.logic.getReqByUrl(url);
   if (reqObj) {
      await i_es.logic.updateReq(reqObj.id, {
         url, param,
         pr: priority || 0,
         ok: 0,
         ts: new Date().getTime(),
      });
   } else {
      await i_es.logic.updateReq(null, {
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
   const reqs = await i_es.logic.getSomeTodoReqs(quota);
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

async function buildCmd(task) {
   const uobj = i_url.parse(task.url);
   const proto = uobj.protocol.split(':')[0];
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
      await i_es.logic.updateReq(task.id, Object.assign(taskobj, {
         ok: 1,
         ts: new Date().getTime(),
      }));
      const dom = i_fs.readFileSync(outF).toString();
      i_fs.unlinkSync(outF);
      await i_es.logic.updateRaw(task.url, JSON.stringify({
         url: task.url,
         dom,
         ok: 0,
         ts: new Date().getTime(),
      }));
   } catch(err) {
      delete env.queueMap[task.url];
      await i_es.logic.updateReq(task.id, Object.assign(taskobj, {
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
