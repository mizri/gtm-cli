// cjs module
const path = require('path');
const commander = require('commander');
const { homedir } = require('os');
const colors = require('colors/safe');
const log = require('@gtm-cli/log');
const exec = require('@gtm-cli/exec');
const { getNpmSemverVersion } = require('@gtm-cli/get-npm-info');
const constant = require('./const');
const pkg = require('../package.json');


// esm module
async function loadEsm() {
  return await Promise.all([
    import('path-exists'),
  ]);
}

// 命令行参数
let args;
// 环境变量配置
let config;
// 用户主目录
let userHome;
// esmmodules
let pathExists;

// 实例化program
const program = new commander.Command();

async function core() {

  // 加载esm模块
  [pathExists] = await loadEsm();
  try {
    // 准备阶段
    await prepare();
    // 命令行注册
    registryCommand();
  } catch(e) {
    log.error(e.message);
    // 判断是否输出错误的执行栈
    if (process.evn.LOG_LEVEL === 'verbose') {
      console.log(e);
    }
  }
}

/**
 * 检查版本号
 */
function checkPkgVersion() {
  // log.success('version', pkg.version);
}

/**
 * 检查当前登录用户
 * 如果是root登录降级
 */
async function checkRoot() {
  // esm模块
  const rootCheck = (await import('root-check')).default;
  // 对用户降级
  rootCheck();
  // 核心调用
  // process.getuid();
}

/**
 * 获取用户主目录
 */
function checkUserHome() {
  // 获取用户主目录
  userHome = homedir();
  // 如果用户主目录不存在
  if (!userHome || !pathExists.pathExistsSync(userHome)) {
    throw new Error(colors.red('userHome is not exists'));
  }
}

/**
 * 检查env环境变量
 */
function checkEnv() {
  const dotenv = require('dotenv');
  const dotenvPath = path.resolve(userHome, '.env');
  if (pathExists.pathExistsSync(dotenvPath)) {
    // 解析环境变量并且放入process.env中
    config = dotenv.config({
      path: dotenvPath
    });
  }
  config = createDefaultConfig();
}

/**
 * 创建默认配置文件
 */
function createDefaultConfig() {
  const cliConfig = {
    home: userHome,
  }
  // 设置默认环境变量
  let cliHome = process.env.CLI_HOME || constant.DEFAULT_CLI_HOME;
  cliConfig['cliHome'] = path.join(userHome, cliHome);
  // 重新设置环境变量
  process.env.CLI_HOME_PATH = cliConfig.cliHome;

  return cliConfig;
}

/**
 * 检查当前脚手架版本更新
 */
async function checkGloablUpdate() {
  // 1. 获取当前的版本号和模块名称
  const currentVersion = pkg.version;
  const npmName = pkg.name;
  // 如果检查版本号遇到网络等问题捕获
  try {
    // 2. 调用npm API,获取所有版本号
    const latestVersion = await getNpmSemverVersion(currentVersion, currentVersion);
    if (latestVersion && semver.gt(latestVersion, currentVersion)) {
      log.warn(colors.yellow(
        `please update ${npmName}, 
        current version: ${currentVersion}, 
        latest version: ${latestVersion}, 
        run \`npm install -g ${npmName}\``
      ));
    }
  } catch (e) {
    log.warn(`check \`${npmName}\` version failed`);
  }
}

/**
 * 注册命令行
 */
function registryCommand() {
  program
    .name(Object.keys(pkg.bin)[0])
    .usage('<command> [options]')
    .version(pkg.version)
    .option('-d, --debug', 'whether to enable debug mode', false) // 添加全局参数debug
    .option('-tp, --targetPath <targetPath>', '是否指定本地调试文件路径', false) // 添加全局参数targetPath
  
  // 初始化项目
  program
    .command('init [projectName]')
    .option('-f, --force', 'whether to force the initialization of the project')
    .action(exec);

  // 监听targetPath
  program.on('option:targetPath', () => {
    process.env.CLI_TARGET_PATH = program.opts().targetPath;
  });
  
  // 监听debug参数输入
  program.on('option:debug', () => {
    const opts = program.opts();
    // 修改日志输入级别
    process.env.LOG_LEVEL = opts.debug ? 'verbose' : 'info';
    // 调整npmlog日志级别
    log.level = process.env.LOG_LEVEL;
  });

  
  // 监听注册命令,*表示监听所有未知输入命令
  program.on('command:*', (cmdList) => {
    // 获取所有可用命令
    const availableCommands = program.commands.map(cmd => cmd.name());
    // 提示未知命令 列出可用命令
    log.error(`
      unknown command \`${cmdList[0]}\`
      available commands: \`${availableCommands.join(',')}\`
    `);
  });
  
  // 解析参数
  program.parse(process.argv);

  // 如果没有输入任何命令或参数
  if (program.args && program.args.length < 1) {
    program.outputHelp();
    console.log();
  }
}

/**
 * 脚手架准备阶段
 */
async function prepare() {
  checkPkgVersion();
  checkRoot();
  checkUserHome();
  checkEnv();
  await checkGloablUpdate();
}

module.exports = core;