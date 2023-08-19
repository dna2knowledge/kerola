const i_es = require('../es');

async function main() {
   await i_es.createTrigramIndex(i_es.config.index.req);
   await i_es.createTrigramIndex(i_es.config.index.cooked);
   await i_es.createTrigramIndex(i_es.config.index.ref);
}

main().then(() => {
   console.log('Done.');
}).catch((err) => {
   console.error(err);
});
