const i_db = require('../../../adapter/sqlite3');

async function main() {
   await i_db.createTables();
}

main().then(() => {
   console.log('Done.');
}).catch((err) => {
   console.error(err);
});
