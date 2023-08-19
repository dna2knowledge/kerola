const i_path = require('path');

function buildCmd(task) {
   // task.url = bingcn://
   const searchQuery = task.url.substring('bingcn://'.length);
   return [
      'node',
      i_path.join(__dirname, '..', 'scripts', 'fetch_search_engine.js'),
      searchQuery,
      '--bing-cn', '--headless'
   ];
}

module.exports = {
   buildCmd,
};
