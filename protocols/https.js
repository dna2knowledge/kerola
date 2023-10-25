const i_path = require('path');
const i_curl = require('./curl');

function buildCmd(task) {
   if (task?.param?.curl) return i_curl.buildCmd(task);
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
