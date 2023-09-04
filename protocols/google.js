const i_path = require('path');

function buildCmd(task) {
   // task.url = google://
   const searchQuery = task.url.substring('google://'.length);
   return [
      'node',
      i_path.join(__dirname, '..', 'scripts', 'fetch_search_engine.js'),
      searchQuery,
      '--google', '--headless'
   ];
}

module.exports = {
   buildCmd,
};
