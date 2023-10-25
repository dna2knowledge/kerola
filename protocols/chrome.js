const i_path = require('path');

function buildCmd(task) {
   return [
      'google-chrome',
      '--headless',
      '--dump-dom',
      task.url,
   ];
}

module.exports = {
   buildCmd,
};
