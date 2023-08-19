const i_path = require('path');

function buildCmd(task) {
   return [
      'node',
      i_path.join(__dirname, '..', 'scripts', 'fetch_generic.js'),
      task.url,
      '--headless'
   ];
}

module.exports = {
   buildCmd,
};
