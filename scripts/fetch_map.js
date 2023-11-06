const puppeteer = require('puppeteer');

const hGoogleMap = require('../handler/google-map');
const hUtil = require('../handler/util');
const config = require('../config');

const flags = {};

if (require.main === module) {
(async () => {
  const addr = process.argv[2];
  if (!addr) return;
  console.error(`[I] fetch "${addr}" ...`);

  flags.needExtract = process.argv.includes('--extract');
  flags.needHeadless = process.argv.includes('--headless');
  if (flags.needHeadless) console.error(`[I] running in headless mode ...`);
  flags.keepAlive = process.argv.includes('--keepalive');
  if (flags.keepAlive) console.error(`[I] need to close browser manually ...`);
  flags.userDir = config.CR_USERDIR;

  await hUtil.act(async (page) => {
     console.error(`[I] map info`);
     await hGoogleMap.fetch(page, addr, flags);
  }, flags);
})();
}
