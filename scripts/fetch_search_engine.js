const puppeteer = require('puppeteer');

const hUtil = require('../handler/util');
const hGoogle = require('../handler/google');
const hBing = require('../handler/bing');

const flags = {};

if (require.main === module) {
(async () => {
  const query = process.argv[2];
  if (!query) return;
  console.error(`[I] search for "${query}" ...`);

  flags.needExtract = process.argv.includes('--extract');
  flags.needHeadless = process.argv.includes('--headless');
  if (flags.needHeadless) console.error(`[I] running in headless mode ...`);
  flags.keepAlive = process.argv.includes('--keepalive');
  if (flags.keepAlive) console.error(`[I] need to close browser manually ...`);

  flags.fromBaidu = process.argv.includes('--baidu');
  flags.fromBingCN = process.argv.includes('--bing-cn');
  // by default, use google, the former should be !(flags.fromA || flags.fromB || ...)
  flags.fromGoogle = !(
     flags.fromBaidu || flags.fromBingCN
  ) || process.argv.includes('--google');

  await hUtil.act(async (page) => {
     if (flags.fromGoogle) await hGoogle.fetch(page, companyName, flags);
     if (flags.fromBingCN) await hBing.fetchCN(page, companyName, flags);
  }, flags);
})();
}
