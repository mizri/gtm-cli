'use strict';
const request = require('@gtm-cli/request');

module.exports = function() {
  return request({
    url: '/project/template',
  });
}