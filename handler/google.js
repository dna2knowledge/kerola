const hUtil = require('./util');

async function isAtGoogleSearchResult(page) {
   const href = await page.evaluate('window.location.href');
   return (
      href?.indexOf('https://www.google.com') === 0 &&
      href?.indexOf('/search?') > 0
   );
}

async function extractSearchResultPagination(page) {
   const elSearchPagination = await page.$('#botstuff div[role="navigation"]');
   if (!elSearchPagination) return null;
   const pagination = {};
   const elAs = elSearchPagination.$$('a');
   for (let i = 0, n = elAs.length; i < n; i++) {
      const elA = elAs[i];
      const ariaLable = await page.evaluate(z => z && z.getAttribute('aria-label'), elA);
      if (ariaLable) {
         const aHref = await page.evaluate(z => z && z.href, elA);
         if (aHref) pagination[ariaLable] = aHref;
      }
      elA.dispose();
   }
   await elSearchPagination.dispose();
   return pagination;
}

async function extractSearchResults(page) {
   await page.waitForSelector('#result-stats', { timeout: 0 });
   const r = [];
   const elSearchResult = await page.$('#search');
   if (!elSearchResult) return null;
   const elRs = await elSearchResult.$$('.g');
   for (let i = 0, n = elRs.length; i < n; i++) {
      const elR = elRs[i];
      const item = {};
      const lang = await page.evaluate(z => z && z.getAttribute('lang'), elR);
      if (lang) item.lang = lang;
      const a = await elR.$('a');
      const aHref = await page.evaluate(z => z && z.href, a);
      if (aHref) item.href = aHref;
      const elTitle = await a.$('h3');
      const title = await page.evaluate(z => z && z.textContent, elTitle);
      if (title) item.title = title;
      await elTitle.dispose();
      await a.dispose();
      const elDesc = await elR.$('div[data-sncf="1"]');
      const desc = await page.evaluate(z => z && z.textContent, elDesc);
      if (desc) {
         item.desc = desc;
         const elEms = await elDesc.$$('em');
         if (elEms.length) {
            item.descEm = await Promise.all(elEms.map(el => page.evaluate(z => z && z.textContent, el)));
            await Promise.all(elEms.map(el => el.dispose()));
         }
      }
      if (elDesc) elDesc.dispose();
      await elR.dispose();
      r.push(item);
   }
   await elSearchResult.dispose();
   return r;
}

async function extractGoogleKnowledgeTab(page) {
   console.error(`[I] using google knowledgeTab`);
   await hUtil.slient(page.waitForSelector('.kp-hc', { timeout: 8000 }));
   const kphc = await page.$('.kp-hc');
   if (!kphc) return false;
   await hUtil.slient(page.waitForNetworkIdle({ idleTime: 1000, timeout: 8000 }));
   //await hUtil.slient(page.waitForSelector('.kp-wp-tab-cont-overview', { timeout: 6000 }), true);
   const obj = {};
   obj.name = await page.evaluate(z => z && z.textContent, await kphc.$('h2'));
   obj.logo = await page.evaluate(z => z && z.src, await kphc.$('img'));
   if (obj.logo) console.error(`[I] got logo from google`);
   obj.officialurl = await page.evaluate(z => z && z.href, ((await kphc.$$('a')) || [])[0]);
   const kpinfo = await page.$('#kp-wp-tab-cont-overview');
   const infotabs = kpinfo ? (await kpinfo.$$('.wp-ms')) : null;
   if (infotabs?.length) {
      const infotab1st = infotabs[0];
      const addrEls = await infotab1st.$$("div[data-attrid='kc:/location/location:address'] span");
      obj.addr = await page.evaluate(z => z && z.textContent, addrEls?.[2]);
      const phEls = await infotab1st.$$("div[data-attrid='kc:/collection/knowledge_panels/has_phone:phone'] span");
      obj.phone = await page.evaluate(z => z && z.textContent, phEls?.[2]);
   }

   if (obj.officialurl) {
      page.goto(obj.officialurl);
      await hUtil.slient(page.waitForNetworkIdle({ idleTime: 1000, timeout: 20000 }));
      const primaryLogo = await page.evaluate(z => z && z.src, await page.$('img'));
      if (obj.logo) {
         obj.logo = [primaryLogo, obj.logo];
      } else {
         obj.logo = primaryLogo;
      }
      if (obj.logo) console.error(`[I] got logo from official site`);
   }
   console.log(JSON.stringify(obj));
   return true;
}

async function dumpDom(page) {
   await page.waitForSelector('#result-stats', { timeout: 0 });
   return await page.content();
}

async function fetch(page, query, flags) {
  console.error(`[I] using Google`);
  await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
  // Set screen size
  await page.setViewport({width: 1080, height: 1024});
  // Type into search box
  // Wait for Google result
  // notice that we set timeout to 0 in case we meet robot check
  await page.waitForSelector('#result-stats', { timeout: 0 });
  // TODO: if meet robot check, need manually bypass it

  if (flags.needExtract) {
     const googleResults = await extractSearchResults(page);
     console.log(JSON.stringify(googleResults));

     const ret = (
        (await extractGoogleKnowledgeTab(page)) ||
        false
     );

     if (!ret) console.error(`[E] no data`);
  } else {
     console.log(await dumpDom(page));
  }
}

const api = {
   isAtGoogleSearchResult,
   extractSearchResultPagination,
   extractSearchResults,
   extractGoogleKnowledgeTab,
   fetch,
};

module.exports = api;
