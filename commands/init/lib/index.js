'use strict';

module.exports = init;

function init(name, options, command) {
  // TODO
  console.log(name, options, command.parent.opts(), process.env.CLI_TARGET_PATH);
}
