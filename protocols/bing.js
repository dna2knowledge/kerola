const i_path = require('path');

function buildCmd(task) {
   // task.url = bing://
   const searchQuery = task.url.substring('bing://'.length);
   return [
      'node',
      i_path.join(__dirname, '..', 'scripts', 'fetch_search_engine.js'),
      searchQuery,
      '--bing', '--headless'
   ];
}

module.exports = {
   buildCmd,
};
