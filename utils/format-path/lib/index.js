'use strict';

const path= require('path');

/**
 * 跨平台路径兼容
 * @param {string} p 
 */
module.exports = function formatPath(p) {
  // TODO
	if (p) {
		const sep = path.sep;
		// 如果是非windows
		if (sep === '/') {
			return p;
		}

		return p.replace(/\\/g, '/');
	}

	return p;
}
