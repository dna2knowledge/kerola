const jsdom = require('jsdom');

function removeAllTags(html, tag) {
   const elems = html.querySelectorAll(tag);
   for (let i = 0; i < elems.length; i++) {
      const elem = elems[i];
      const p = elem.parentNode;
      if (p) p.removeChild(elem);
   }
}

function distinctUrls(urls) {
   if (!urls) return urls;
   const map = {};
   urls.forEach(hrefObj => {
      if (!map[hrefObj.href]) map[hrefObj.href] = [];
      if (!hrefObj.text) return;
      if (map[hrefObj.href].includes(hrefObj.text)) return;
      map[hrefObj.href].push(hrefObj.text);
   });
   return Object.keys(map).map(url => ({ href: url, text: map[url].join(', ') }));
}

function extractBasicInfo(dom, url) {
   if (!dom || !url) return undefined;
   const r = {};
   const html = new jsdom.JSDOM(dom);
   const doc = html.window.document;
   removeAllTags(doc, 'script');
   removeAllTags(doc, 'style');
   const as = doc.querySelectorAll('a');
   const nextHrefs = [];
   for (let i = 0; i < as.length; i++) {
      const a = as[i];
      const obj = {};
      obj.href = a.getAttribute('href');
      if (obj.href && !/^(\w+:)?\/\//.test(obj.href)) {
         if (obj.href.startsWith('javascript:')) continue;
         if (obj.href.startsWith('/')) {
            obj.href = url.split('/').slice(0, 3).join('/') + obj.href;
         } else if (obj.href.startsWith('#')) {
            obj.href = url + obj.href;
         } else if (obj.href.startsWith('?')) {
            obj.href = url.split('?')[0] + obj.href;
         } else if (obj.href.startsWith('tel:') || obj.href.startsWith('mailto:')) {
         } else {
            const ps = url.split('/');
            const base = ps.slice(0, 3).join('/');
            ps.splice(0, 3);
            ps.pop();
            const hash = obj.href.split('#')[1] || '';
            const query = obj.href.split('?')[1] || '';
            obj.href.split('?')[0].split('/').forEach(z => z === '..' ? ps.pop() : (z !== '.' && ps.push(z)));
            obj.href = base + '/' + ps.join('/') + (query ? query : hash);
         }
      } else {
         if (obj.href && obj.href.startsWith('//')) {
            obj.href = `${getProtocol(url)}${obj.href}`;
         }
      }
      obj.text = a.textContent;
      obj.href && nextHrefs.push(obj);
   }
   r.text = doc.textContent;
   r.hrefs = distinctUrls(nextHrefs.filter(z => z.href.startsWith('https://') || z.href.startsWith('http://')));
   return r;
}

function getRootDomain(url) {
   if (!url) return '';
   const hostname = url.split('/')[2]
   if (!hostname) return '';
   const ps = hostname.split(':')[0].split('.');
   if (ps.length === 2) return ps.join('.');
   return ps.slice(1).join('.');
}

function groupLinks(links) {
   const groups = {};
   links.forEach(item => {
      const domain = getRootDomain(item.href);
      if (!domain) return;
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(item);
   });
   return groups;
}

module.exports = {
   extractBasicInfo,
   getRootDomain,
   groupLinks,
};
