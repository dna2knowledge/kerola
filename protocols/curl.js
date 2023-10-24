const i_path = require('path');

function buildCmd(task) {
   return [
      'curl',
      task.url,
   ];
}

module.exports = {
   buildCmd,
};
