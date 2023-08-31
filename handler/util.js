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

async function act(asyncFn, opt) {
  opt = Object.assign({
     needHeadless: false,
     keepAlive: false,
  }, opt);
  const browser = await puppeteer.launch({ headless: opt.needHeadless ? 'new' : false, });
  const page = await browser.newPage();
  await asyncFn(page, browser, opt);

  // XXX: if want to debug, we can keep browser open
  if (opt.keepAlive) {
     await waitUntilBrowserClose(browser);
  } else {
     await browser.close();
  }
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
