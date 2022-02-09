'use strict';
const semver = require('semver');
const colors = require('colors');
const log = require('@gtm-cli/log');

// node最低版本号限制
const LEWEST_NODE_VERSION = '13.0.0';

class Command {
    /**
     * init命令工厂方法
     * @param {String}} name 命令参数
     * @param {Object} options 命令全局参数
     * @param {*} command 命令对象
     * @returns 
     */
    constructor(name, options, command) {
			let runner = new Promise((resolve, reject) => {
				let chain = Promise.resolve();
				// 校验node版本
				chain = chain.then(() => this.checkNodeVersion());
				// 初始化参数
				chain = chain.then(() => this.initArgs(name, options, command));
				// 执行init逻辑
				chain = chain.then(() => this.init());
				chain = chain.then(() => this.exec());
				chain.catch((err) => {
					log.error(err.message);
				});
			});
    }

		/**
		 * 解析参数
		 */
		initArgs(name, options, command) {
			this._cmd = command;
			this._argv = [name];
			this._opts = options;
		}

    init() {
			throw new Error('init 必须实现');
    }

    exec() {
			throw new Error('exec 必须实现');
    }

		/**
		 * 检查node版本号
		 */
		checkNodeVersion() {
			// 获取当前版本号
			const currentVersion = process.version;
			// 比对当前最低版本号
			const lowestVersion = LEWEST_NODE_VERSION;
			// 判断版本号
			if (!semver.gte(currentVersion, lowestVersion)) {
				throw new Error(colors.red(`gtm-cli need node version >= ${lowestVersion}`));
			}
		}
}

module.exports = Command;
