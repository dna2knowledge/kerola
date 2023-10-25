const i_path = require('path');
const i_curl = require('./curl');
const i_chrome = require('./chrome');

function buildCmd(task) {
   if (task?.param?.curl) return i_curl.buildCmd(task);
   if (task?.param?.chrome) return i_chrome.buildCmd(task);
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
