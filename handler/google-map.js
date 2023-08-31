const hUtil = require('./util');

async function fetch(page, address, flags) {
  console.error(`[I] using Google Maps`);
  const env = {};
  await page.goto(`https://www.google.com/maps/place/${encodeURIComponent(address)}`);
  // Set screen size
  await page.setViewport({width: 1080, height: 1024});
  await hUtil.waitFor(async () => {
     const href = await page.evaluate(_ => window.location.href);
     if (!href) return false;
     if (href.split('/').length <= 6) return false;
     env.href = href;
     return true;
  }, 20);
  let parts = env.href ? env.href.split('/') : [];
  if (!parts[5]) {
     const searchBtn = await page.$('#searchbox-searchbutton');
     await searchBtn.click();
     searchBtn.dispose();
     await hUtil.slient(page.waitForNetworkIdle({ idleTime: 1000, timeout: 5000 }));
     env.href = await page.evaluate(_ => window.location.href);
  }
  parts = env.href ? env.href.split('/') : [];
  console.log(parts[6] || '(no info)');
}

const api = {
   fetch,
};

module.exports = api;
