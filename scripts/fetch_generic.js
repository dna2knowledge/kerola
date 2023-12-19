const hUtil = require('../handler/util');
const config = require('../config');

const flags = {};

if (require.main === module) {
(async () => {
  const url = process.argv[2];
  if (!url) return;
  console.error(`[I] fetch "${url}" ...`);

  flags.needPlaywright = process.argv.includes('--playwright');
  flags.needExtract = process.argv.includes('--extract');
  flags.needHeadless = process.argv.includes('--headless');
  if (flags.needHeadless) console.error(`[I] running in headless mode ...`);
  flags.keepAlive = process.argv.includes('--keepalive');
  if (flags.keepAlive) console.error(`[I] need to close browser manually ...`);
  flags.userDir = config.CR_USERDIR;

  if (flags.needPlaywright) {
     await hUtil.actPlaywright(async (page) => {
        console.error(`[I] generic (playwright)`);
        await page.setViewportSize({width: 1080, height: 1024});
        await page.goto(url);
        await hUtil.slient(page.waitForLoadState('networkidle', { timeout: 5000 }));
        try {
           console.log(await page.content());
        } catch (err) {
           console.error(err);
        }
     }, flags);
  } else {
     await hUtil.actPlaywright(async (page) => {
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
  }

  async function action(page) {
  }
})();
}
