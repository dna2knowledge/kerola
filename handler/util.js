const fs = require('fs');
const path = require('path');
const crypto = require('crypto')
const EventEmitter = require('events').EventEmitter;
const puppeteer = require('puppeteer');

function buildQueryObject(query) {
   const obj = {};
   query.split('&').forEach(keyval => {
      const parts = keyval.split('=');
      const k = decodeURIComponent(parts[0]);
      const v = parts[1] ? decodeURIComponent(parts[1]) : undefined;
      obj[k] = v;
   });
   return obj;
}

function waitUntilBrowserClose(browser) {
   return new Promise((r) => {
      wait(browser, r);

      function wait(browser, rx) {
         if (!browser || !browser.isConnected()) return rx();
         setTimeout(wait, 1000, browser, rx);
      }
   });
}

function wait(ms) {
   return new Promise((r) => {
      setTimeout(r, ms);
   });
}

function waitFor(asyncFn, max) {
   return new Promise((r, e) => {
      once(asyncFn, max, 0, r, e);
      async function once(asyncFn, max, acc, r, e) {
         if (acc > max) return e('timeout');
         try {
            const x = asyncFn && await asyncFn();
            if (x) return r(true);
            setTimeout(once, 500, asyncFn, max, acc+1, r, e);
         } catch(err) {
            e(err);
         }
      }
   });
}

function addLaunchArgs(launchOpt, args) {
   if (!args || !args.length) return;
   if (!launchOpt.args) launchOpt.args = [];
   args.forEach(z => launchOpt.args.push(z));
}

async function useProxyServer(launchOpt, opt) {
   // addLaunchArgs(launchOpt, [`--proxy-server="http://localhost:3128"`])
   // XXX currently no proxy
   // XXX if opt.userDirRandom = false, can only use one proxy;
   //     which means userDir different, chrome can be launched with different args
   return;
}

async function act(asyncFn, opt) {
  opt = Object.assign({
     needHeadless: false,
     keepAlive: false,
     userDir: null,
     userDirRandom: true,
     keepUserDir: false,
  }, opt);
  // if disable userDirRandom, should keepUserDir in case parallel instance problems
  if (!opt.userDirRandom) opt.keepUserDir = true;
  const userDir = opt.userDir ? (opt.userDirRandom ? `${path.join(opt.userDir, crypto.randomUUID())}` : opt.userDir): null;

  const launchOpt = {};
  launchOpt.headless = opt.needHeadless ? 'new' : false;
  await useProxyServer(launchOpt, opt);
  if (opt.userDir) addLaunchArgs(launchOpt, [`--user-data-dir=${userDir}`]);

  const browser = await puppeteer.launch(launchOpt);
  const page = await browser.newPage();
  await asyncFn(page, browser, opt);

  // XXX: if want to debug, we can keep browser open
  if (opt.keepAlive) {
     await waitUntilBrowserClose(browser);
  } else {
     await browser.close();
  }

  if (userDir && !opt.keepUserDir) fs.rmSync(opt.userDir, { recursive: true });
}

async function slient(p, needPrint) {
   try { await p; } catch(err) { if (needPrint) console.log(`[E] ${err.message}`); }
}

async function hookOnRequest(page, emitter) {
   emitter = emitter || new EventEmitter();
   await page.setRequestInterception(true);
   page.on('request', request => {
      emitter.emit('init', { request });
      request.continue()
   });
   page.on('requestfinished', async (request) => {
      const response = await request.response();
      const url = request.url();
      try {
         const body = request.redirectChain().length === 0 ? await response.buffer() : null;
         emitter.emit('done', { request, response, body, url, });
      } catch(err) {
         emitter.emit('done', { request, response, url, });
      }
   });
   return emitter;
}

module.exports = {
   act,
   slient,
   wait,
   waitFor,
   waitUntilBrowserClose,
   hookOnRequest,
   buildQueryObject,
};
