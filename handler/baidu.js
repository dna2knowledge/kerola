const hUtil = require('./util');

async function extractSearchResults(page) {
   await page.waitForSelector('#content_left', { timeout: 0 });
   const r = [];
   const elRs = await page.$$('.c-container[id]');
   for (let i = 0, n = elRs.length; i < n; i++) {
      const elR = elRs[i];
      const item = {};
      const elTitle = await elR.$('.c-title');
      if (elTitle) {
         const title = await page.evaluate(z => z.textContent, elTitle);
         const desc = await page.evaluate(z => z.parentElement && z.parentElement.textContent, elTitle);
         const elA = await elTitle.$('a');
         item.title = title;
         item.desc = desc;
         if (elA) {
            item.href = await page.evaluate(z => z.href, elA);
            await elA.dispose();
         }
         await elTitle.dispose();
      }
      await elR.dispose();
      r.push(item);
   }
   return r;
}

async function dumpDom(page) {
   await page.waitForSelector('#result-stats', { timeout: 0 });
   return await page.content();
}

async function fetch(page, query, flags) {
  console.error(`[I] using Baidu`);
  await page.goto(`https://www.baidu.com/s?wd=${encodeURIComponent(query)}`);
  // Set screen size
  await page.setViewport({width: 1080, height: 1024});
  // notice that we set timeout to 0 in case we meet robot check
  await page.waitForSelector('#content_left', { timeout: 0 });
  // TODO: if meet robot check, need manually bypass it

  if (flags.needExtract) {
     const baiduResults = await extractSearchResults(page);
     console.log(JSON.stringify(baiduResults));
  } else {
     console.log(await dumpDom(page));
  }
}

const api = {
   fetch,
};

module.exports = api;
