'use strict';

const path = require('path');
const cp = require('child_process');
const Package = require('@gtm-cli/package');
const log = require('@gtm-cli/log');
const utils = require('@gtm-cli/utils');
const { chdir } = require('process');

module.exports = exec;

// 命令所对应的包名称
const SETTINGS = {
	init: '@gtm-cli/init',
};

const CACHE_DIR = 'dependencies';

/**
 * 
 * @param {String} name 命令参数
 * @param {Object} options 全局参数
 * @param {Object} command 命令对象
 */
async function exec(name, options, command) {
	const homePath = process.env.CLI_HOME_PATH;
	// 是否指定路径
	let targetPath = process.env.CLI_TARGET_PATH;
	// 缓存路径
	let storeDir = '';
	// 包加载实例
	let pkg = null;
	// 输出debug模式日志
	log.verbose('targetPath', targetPath);
	log.verbose('homepath', homePath);
	// 通过command获取命令名称映射包名
	const packageName = SETTINGS[command.name()];
	const packageVersion = 'latest';

	// 如果用户米有输入模块目标路径
	if (!targetPath) {
		// 计算出缓存的路径
		targetPath = path.resolve(homePath, CACHE_DIR);
		// 计算缓存所在的具体目录即缓存的node_modules目录
		storeDir = path.resolve(targetPath, 'node_modules');
		// 调试模式输出
		log.verbose('targetpath', this.targetPath);
		log.verbose('storeDir', this.storeDir);

		// 创建一个包加载实例
		pkg = new Package({
			targetPath,
			storeDir,
			packageName,
			packageVersion,
		});

		// 如果当前package在缓存中存在
		if (await pkg.exists()) {
			// 更新package
			await pkg.update();
		} else { // 如果在缓存中不存在
			// 安装package
			await pkg.install();
		}
	} else { // 如果指定了具体的package路径
		// 创建包加载实例，直接通过
		pkg = new Package({
			targetPath,
			packageName,
			packageVersion,
		});
	}
	// 1. 把targetPath -> modulePath
	// 2. modulePath -> package(npm模块)
	// 3. Package.getRootFile(获取入口文件)
	pkg.getRootFilePath().then((rootFile) => {
		if (rootFile) {
			try {
				// 创建command空对象
				const o = Object.create(null);
				// 将不需要的command参数剥离
				Object.keys(command).forEach((key) => {
					if (command.hasOwnProperty(key) && !key.startsWith('_') && key !== 'parent') {
						o[key] = command[key];
					}
				});
				// 拼接出要执行的js代码
				const code = `require('${rootFile}')('${name}', ${JSON.stringify(options)}, ${JSON.stringify(o)})`;
				// 开启子进程执行
				const child = utils.exec('node', ['-e', code], {
					cwd: process.cwd(),
					stdio: 'inherit', // inherit方式直接执输出到父进程，不需要在child.studio中以管道的方式监听
				});

				child.on('error', () => {
					log.error(e.message);
					process.exit();
				});

				child.on('exit', (e) => {
					log.verbose('命令执行成功:' + e);
					process.exit(e);
				});
			} catch (e) {
				log.error(e.message);
			}
		}
	});
}


