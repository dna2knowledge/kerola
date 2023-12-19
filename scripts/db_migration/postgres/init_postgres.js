const i_db = require('../../../adapter/postgres');

async function main() {
   await i_db.createTables();
}

main().then(() => {
   console.log('Done.');
   process.exit(0);
}).catch((err) => {
   console.error(err);
   process.exit(0);
});
