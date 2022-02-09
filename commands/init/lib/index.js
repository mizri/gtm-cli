'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const ejs = require('ejs');
const glob = require('glob');
const fse = require('fs-extra');
const inquirer = require('inquirer');
const semver = require('semver');
const Command = require('@gtm-cli/command');
const log = require('@gtm-cli/log');
const utils = require('@gtm-cli/utils');
const Package = require('@gtm-cli/package');
const getProjectTemplate = require('./getProjectTemplate');
const { start } = require('repl');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

const TEMPLATE_TYPE_NORMAL = 'normal';
const TEMPLATE_TYPE_CUSTOM = 'custom';

const WHITE_COMMAND = ['npm', 'cnpm', 'yarn'];

/**
 * init 命令
 * 通过命令式交互创建初始化模板
 * 以供分为三个阶段
 * 1、准备阶段
 * 2、下载阶段
 * 3、安装阶段
 */
class InitCommand extends Command {
	
	init() {
		// 设置创建的工程名称
		this.projectName = this._argv[0] || null;
		// 是否强制清空目录
		this.force = this._opts.force;

		log.verbose('projectName', this.projectName);
		log.verbose('force', this.force);
	}

	async exec() {
		try {
			// 1. 准备阶段
			const projectInfo = await this.prepare();
			if (projectInfo) {
				// 2. 下载模板
				log.verbose('projectInfo', projectInfo);
				// 保存项目信息
				this.projectInfo = projectInfo;
				// 下载模板
				await this.downloadTemplate();
				// 3. 安装模板
				await this.installTemplte();
			}
		} catch(e) {
			log.error(e.message);
			if (process.env.LOG_LEVEL === 'verbose') {
				console.log(e);
			}
		}
	}

	/**
	 * 安装模板
	 */
	async installTemplte() {
		if (this.templateInfo) {
			// 兼容模板类型
			if (!this.templateInfo.type) {
				this.templateInfo.type = TEMPLATE_TYPE_NORMAL;
			}

			if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
				// 标准模板安装
				this.installNormalTemplate();
			} else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
				// 自定义模板安装
				this.installCustomTemplate();
			} else {
				throw new Error('项目模板类型无法识别');
			}
		} else {
			throw new Error('项目模板信息不存在');
		}
	}

	/**
	 * 命令检测
	 * @param {*} command 
	 * @returns 
	 */
	checkCommand(command) {
		return WHITE_COMMAND.indexOf(command) > -1 ? command : null;
	}

	/**
	 * 执行命令
	 * @param {}} command 
	 */
	async execCommand(command, errMsg) {
		let ret;
		if (command) {
			const exeuCmd = command.split(/\s+/g);
			const cmd = this.checkCommand(exeuCmd[0]);

			if (!cmd) {
				throw new Error('命令不存在！ 命令：' + command);
			}
			const args = exeuCmd.slice(1);
			// 执行
			ret = await utils.execAsync(cmd, args, { stdio: 'inherit', cwd: process.cwd() });
		}

		if (ret !== 0) {
			throw new Error(errMsg);
		}

		return ret;
	}

	/**
	 * ejs渲染
	 * @param {*} ignore 忽略的文件
	 * @returns 
	 */
	async ejsRender(options = {}) {
		const dir = process.cwd();
		return new Promise((resolve, reject) => {
			glob('**', {
				cwd: dir,
				nodir: true,
				ignore: options.ignore || ''
			}, (err, files) => {
				if (err) {
					return reject(err);
				}
				// 处理所有的文件
				Promise.all(files.map((file) => {
					const filePath = path.join(dir, file);
					return new Promise((resolve1, reject1) => {
						ejs.renderFile(filePath, this.projectInfo, {}, (err, result) => {
							if (err) {
								reject1(err);
							} else {
								// 重新写入文件
								fse.writeFileSync(filePath, result);
								resolve1(result);
							}
						});
					});
				})).then(() => {
					resolve();
				}).catch((e) => {
					log.verbose(e.message);
					if (process.env.LOG_LEVEL === 'verbose') {
						console.log(e);
					}
				});
			});
		});
	}

	/**
	 * 标准模板安装
	 */
	async installNormalTemplate() {
		// 拷贝模板代码到当前目录
		// 模板缓存路径
		let spinner = utils.spinnerStart('正在安装模板...');
		await utils.sleep(2000);
		try {
			const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template');
			// 当前需要拷贝的路径
			const targetPath = process.cwd();
			log.verbose('templatePath', templatePath);
			log.verbose('targetPath', targetPath)
			// 确保目录存在
			fse.ensureDirSync(templatePath);
			fse.ensureDirSync(targetPath);
			// 拷贝目录
			fse.copySync(templatePath, targetPath);

			spinner.stop(true);
			log.success('模板安装成功');
		} catch(e) {
			spinner.stop(true);
			throw e;
		}

		// 渲染ejs模板
		const ignore = ['**/node_modules/**', '**/*.png', ...(this.templateInfo.ignore || [])];
		await this.ejsRender({ ignore });

		log.verbose('templateNpm', this.templateNpm);
		const { installCommand, startCommand } = this.templateInfo;
		// 依赖安装
		await this.execCommand(installCommand, '依赖安装过程失败');
		// 启动命令执行
		await this.execCommand(startCommand, '启动失败');
	}

	/**
	 * 自定义模板安装
	 */
	async installCustomTemplate() {
		// 查询自定义模板的入库文件
		if (await this.templateNpm.exists()) {
			const rootFile = this.templateNpm.getRootFilePath();
			if (fs.existsSync(rootFile)) {
				log.notice('开始执行自义定模板安装');
				const options = {
					...this.templateInfo,
					cwd: process.cwd(),
					sourcePath: path.resolve(this.templateNpm.cacheFilePath, 'template'),
					targetPath: process.cwd(),
				};
	
				const code = `require('${rootFile}')(${JSON.stringify(options)})`;
				log.verbose('code', code);
	
				await execAsync('node', ['-e', code], { studio: 'inherit', cwd: process.cwd() });
	
				log.success('自定义模板安装成功');
	
			} else {
				throw new Error(`自定义模板入口文件不存在`);
			}
		}
	}

	async downloadTemplate() {
		// 1. 通过项目模板API获取项目模板信息
		// 1.1 通过egg.js搭建一套后端系统
		// 1.2 通过npm存储模板
		// 1.3 将项目模板信息存储到mongodb
		// 1.4 通过egg.js获取mongodb中的数据并且通过api返回
		const userHome = os.homedir();
		const { projectTemplate } = this.projectInfo;
		const templateInfo = this.template.find(item => item.npmName === projectTemplate);
		// 下载npm包
		const targetPath = path.resolve(userHome, '.gtm-cli/template');
		const storeDir = path.resolve(userHome, '.gtm-cli/template', 'node_modules');
		const { npmName, version } = templateInfo;
		// 创建包实例
		const templateNpm = new Package({
			targetPath,
			storeDir,
			packageName: npmName,
			packageVersion: version,
		});
		// 判断是否存在然后开始下载
		let spinner;
		if (!await templateNpm.exists()) {
			try {
				spinner = utils.spinnerStart('正在下载模板');
				// loading框
				await utils.sleep(2000);
				await templateNpm.install();
				spinner.stop(true);
				log.success('下载模板成功');
			} catch(e) {
				spinner.stop(true);
				log.error(e);
			}
		} else {
			try {
				spinner = utils.spinnerStart('正在更新模板');
				await utils.sleep(2000);
				await templateNpm.update();
				spinner.stop(true);
				log.success('更新模板成功');
			} catch(e) {
				spinner.stop(true);
				log.error(e);
			}
		}
		// 设置选中的模板信息
		this.templateInfo = templateInfo;
		// 缓存模板包信息
		this.templateNpm = templateNpm;
	}

	/**
	 * 准备阶段
	 */
	async prepare() {
		// 0. 判断项目模板是否存在
		const template = await getProjectTemplate();
		if (!template || !template.length) {
			throw new Error('项目模板不存在');
		}

		this.template = template;
		// 当前命令执行目录
		const localPath = process.cwd(); // path.resolve('.');
		// 1. 判断当前目录是否为空
		if (!this.isDirEmpty(localPath)) { // 判断目录是否为空
			// 是否继续创建项目
			let ifContinue = false;

			if (!this.force) {
				// 1.1 询问是否继续创建
				ifContinue = (await inquirer.prompt({
					type: 'confirm',
					name: 'ifContinue',
					default: false,
					message: '当前文件夹不为空，是否继续创建项目',
				})).ifContinue;
			}
			// 选择否继续创建
			if (!ifContinue) {
				return;
			}

			// 2. 是否启动强制更新
			if (ifContinue || this.force) {
				// 给用户做二次确认
				const { confirmDelete } = await inquirer.prompt({
					type: 'confirm',
					name: 'confirmDelete',
					default: false,
					message: '是否确认清空当前目录下的文件'
				})

				if (confirmDelete) {
					// 清空当前目录
					fse.emptyDirSync(localPath);
				}
			}
		}
		

		return this.getProjectInfo();
	}

	/**
	 * 获取项目的基本信息
	 */
	async getProjectInfo() {
		// 是否是可以用的项目名称
		function isValidName(value) {
			return /^[a-zA-Z]+([-_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(value);
		}
		// 项目信息
		let projectInfo = {};
		// 用户输入的项目名称是否可用
		let isProjectNameValid = false;
		if (isValidName(this.projectName)) {
			isProjectNameValid = true;
			// 设置项目名称
			projectInfo.projectName = this.projectName;
		}

		// 1. 选择创建项目或组件
		const { type } = await (inquirer.prompt({
			type: 'list',
			message: '请选择初始化类型',
			default: TYPE_PROJECT,
			name: 'type',
			choices: [{
				name: '项目',
				value: TYPE_PROJECT,
			}, {
				name: '组件',
				value: TYPE_COMPONENT,
			}]
		}));

		// 输出debug日志
		log.verbose('type：项目或组件', type);
		// 根据用户选择从this.template中筛选出项目或组件
		this.template = this.template.filter(item => item.tag.indexOf(type) > -1);
		// 判断当前title是组件还是项目，项目与组件复用一段逻辑
		const title = type === TYPE_PROJECT ? '项目' : '组件';
		// 2. 获取项目的基本信息
		const projectNamePrompt = {
			type: 'input',
			name: 'projectName',
			message: `请输入${title}名称`,
			default: '',
			validate: function (value) {
				const done = this.async();

				setTimeout(function () {
					// 1. 输入的首字符必须为因为字符
					// 2. 尾字符必须为英文或数字
					// 3. 中间字符为'-_'
					if (!isValidName(value)) {
						return done(`${title}名称不合法`);
					}
					done(null, true)
				}, 0);
				return ;
			},
			filter: function (value) {
				return value;
			}
		};

		// 确认步骤
		const promptList = [{
			type: 'input',
			name: 'projectVersion',
			message: `请输入${title}版本号`,
			default: '1.0.0',
			validate: function (value) {
				const done = this.async();
				// 判断版本号是否合法
				setTimeout(function () {
					if (!semver.valid(value)) {
						return done(`${title}版本号不合法`);
					}
					done(null, true)
				}, 0);
			},
			filter: function (value) {
				// 格式化版本号
				if (semver.valid(value)) {
					return semver.valid(value);
				}
				return value;
			}
		}, {
			type: 'list',
			name: 'projectTemplate',
			message: `请选择{title}模板`,
			choices: this.createTemplateChoices(),
		}];

		// 如果用户选择的是创建项目
		if (type === TYPE_PROJECT) {
			// 判断是否需要出现项目命令行提示
			if (!isProjectNameValid) {
				promptList.unshift(projectNamePrompt);
			}
			// 执行命令行交互,获取项目基本信息
			const project = await inquirer.prompt(promptList);
			// 返回项目信息
			projectInfo = {
				...projectInfo,
				type,
				...project,
			}
		} else if (type === TYPE_COMPONENT) {
			// 组件描述信息命令行交互
			const descriptionPrompt = {
				type: 'input',
				name: 'componentDescription',
				message: '请输入组件描述信息',
				default: '',
				validate: function (value) {
					const done = this.async();

					setTimeout(function () {
						if (!value) {
							return done('请输入组件描述信息');
						}
						done(null, true)
					}, 0);
					return ;
				},
				filter: function (value) {
					return value;
				}
			}
			
			promptList.push(descriptionPrompt);
			// 获取组件基本信息
			const component = await inquirer.prompt(promptList);
			// 返回项目信息
			projectInfo = {
				...projectInfo,
				type,
				...component,
			}
		}

		// 以下数据用于模板渲染esjRender中使用
		// 生成className,将用户输入的驼峰名称修改为a-b-c形式
		if (projectInfo.projectName) {
			projectInfo.name = projectInfo.projectName;
			projectInfo.className = require('kebab-case')(projectInfo.projectName).replace(/^-/, '');
		}

		if (projectInfo.projectVersion) {
			projectInfo.version = projectInfo.projectVersion;
		}
		// 组件描述信息
		if (projectInfo.componentDescription) {
			projectInfo.description = projectInfo.componentDescription;
		}

		return projectInfo;
	}

	/**
	 * 创建模板的选择列表
	 */
	createTemplateChoices() {
		return this.template.map((item) => {
			return {
				name: item.name,
				value: item.npmName,
			}
		});
	}

	/**
	 * 判断文件目录是否为空
	 * @param {String} 当前命名执行目录
	 * @returns Boolean
	 */
	isDirEmpty(localPath) {
		// 获取当前目录所有文件
		let fileList = fs.readdirSync(localPath);
		// 过滤文件
		fileList.filter((file) => {
			return file.startsWith('.') && ['node_modules'].indexOf(file) < 0;
		});
		
		return !fileList || !fileList.length;
	}
}

/**
 * init命令工厂方法
 * @param {String}} name 命令参数
 * @param {Object} options 命令全局参数
 * @param {*} command 命令对象
 * @returns 
 */
function init(name, options, command) {
	return new InitCommand(name, options, command);
}

module.exports = init;
