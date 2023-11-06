const puppeteer = require('puppeteer');

const hUtil = require('../handler/util');
const config = require('../config');

const flags = {};

if (require.main === module) {
(async () => {
  const url = process.argv[2];
  if (!url) return;
  console.error(`[I] fetch "${url}" ...`);

  flags.needExtract = process.argv.includes('--extract');
  flags.needHeadless = process.argv.includes('--headless');
  if (flags.needHeadless) console.error(`[I] running in headless mode ...`);
  flags.keepAlive = process.argv.includes('--keepalive');
  if (flags.keepAlive) console.error(`[I] need to close browser manually ...`);
  flags.userDir = config.CR_USERDIR;

  await hUtil.act(async (page) => {
     console.error(`[I] generic`);
     await page.goto(url);
     await page.setViewport({width: 1080, height: 1024});
     await hUtil.slient(page.waitForNetworkIdle({ idleTime: 1000, timeout: 5000 }));
     try {
        console.log(await page.content());
     } catch (err) {
        console.error(err);
     }
  }, flags);
})();
}
