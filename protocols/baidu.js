const i_path = require('path');

function buildCmd(task) {
   // task.url = baidu://
   const searchQuery = task.url.substring('baidu://'.length);
   return [
      'node',
      i_path.join(__dirname, '..', 'scripts', 'fetch_search_engine.js'),
      searchQuery,
      '--baidu', '--headless'
   ];
}

module.exports = {
   buildCmd,
};
