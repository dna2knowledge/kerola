const hUtil = require('./util');

async function dumpDomCN(page) {
   await page.waitForSelector('#b_results', { timeout: 0 });
   await hUtil.wait(5000);
   return await page.content();
}
async function extractCNSearchResults(page) {
   await page.waitForSelector('#b_results', { timeout: 0 });
   const r = [];
   await hUtil.wait(1500);
   const elSearchResults = await page.$$('#b_results');
   if (!elSearchResults) return null;
   for (let k = 0, m = elSearchResults.length; k < m; k++) {
   const elSearchResult = elSearchResults[k];
   const elRs = await elSearchResult.$$('li');
   for (let i = 0, n = elRs.length; i < n; i++) {
      const elR = elRs[i];
      const item = {};
      const elT = await elR.$('h2');
      if (elT) {
         item.name = await page.evaluate(z => z.textContent, elT);
         item.href = await page.evaluate(z => z.children[0] && z.children[0].href, elT);
         //const a = elT.$('a');
         //item.href = await page.evaluate(z => z && z.href, a);
         //await a.dispose();
         await elT.dispose();
      }
      const elD = await elR.$('.b_caption > p');
      if (elD) {
         item.desc = await page.evaluate(z => z.textContent, elD);
         await elD.dispose();
      }
      await elR.dispose();
      if (item.name && item.href) r.push(item);
   }
   await elSearchResult.dispose();
   }
   return r;
}

async function fetchCN(page, companyName, flags) {
  console.error(`[I] using Bing`);
  await page.goto('https://cn.bing.com/');
  await page.setViewport({width: 1080, height: 1024});

  // ensure CN mode
  await page.waitForSelector('#est_cn', { timeout: 0 });
  const estSwitch = await page.$('#est_cn');
  await estSwitch.click();
  estSwitch.dispose();

  await page.focus('input[name="q"]');
  await page.type('input[name="q"]', companyName);
  await page.keyboard.press('Enter');
  await page.waitForSelector('#b_results', { timeout: 0 });
  // TODO: if meet robot check, need manually bypass it

  if (flags.needExtract) {
     const bingCNResults = await extractCNSearchResults(page);
     console.log(JSON.stringify(bingCNResults));
  } else {
     console.log(await dumpDomCN(page));
  }
}

const api = {
   extractCNSearchResults,
   fetchCN,
};

module.exports = api;
