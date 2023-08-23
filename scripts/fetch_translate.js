const puppeteer = require('puppeteer');

const hUtil = require('../handler/util');

const flags = {};

async function bingTranslate(page, flags) {
     console.error(`[I] translate by Bing`);
     await page.goto('https://www.bing.com/translator');
     await page.setViewport({width: 1080, height: 1024});
     await hUtil.slient(page.waitForNetworkIdle({ idleTime: 1000, timeout: 5000 }));
     await page.waitForSelector('#tta_input_ta', { timeout: 0 });
     await page.waitForSelector('#tta_srcsl', { timeout: 0 });
     await page.waitForSelector('#tta_tgtsl', { timeout: 0 });
     const srcLang = await page.$('#tta_srcsl');
     const tgtLang = await page.$('#tta_tgtsl');
     await page.evaluate(z => { window._fetchTranslateFlags = z.flags; }, { flags });
     await page.evaluate(z => { z.value = window._fetchTranslateFlags.source; }, srcLang);
     await page.evaluate(z => { z.value = window._fetchTranslateFlags.target; }, tgtLang);
     srcLang.dispose();
     tgtLang.dispose();
     await page.focus('#tta_input_ta');
     await page.type('#tta_input_ta', flags.text);
     await hUtil.slient(page.waitForNetworkIdle({ idleTime: 1000, timeout: 5000 }));
     await page.waitForSelector('#tta_copyIcon', { timeout: 0 });
     const tgtText = await page.$('#tta_output_ta');
     console.log(`[R] ${await page.evaluate(z => z.value, tgtText)}`);
     tgtText.dispose();
}

if (require.main === module) {
(async () => {
  flags.text = process.argv[2];
  flags.target = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'en';
  flags.source = process.argv[4] && !process.argv[4].startsWith('--') ? process.argv[4] : 'auto-detect';
  if (!flags.text) return;
  console.error(`[I] translate "${flags.text}" from "${flags.source}" to "${flags.target}" ...`);

  flags.needExtract = process.argv.includes('--extract');
  flags.needHeadless = process.argv.includes('--headless');
  if (flags.needHeadless) console.error(`[I] running in headless mode ...`);
  flags.keepAlive = process.argv.includes('--keepalive');
  if (flags.keepAlive) console.error(`[I] need to close browser manually ...`);

  flags.useBing = process.argv.includes('--bing');

  await hUtil.act(async (page) => {
     if (flags.useBing) {
        await bingTranslate(page, flags);
     }
  }, flags);
})();
}
