'use strict';



var log = require('npmlog');
// 根据环境变量决定日志输出级别,判断debug模式
log.level = process.env.LOG_LEVEL || 'info';
// 定义输出前缀
log.heading = 'gtm';
log.headingStyle = { fg: 'grey' };
// 添加成功方法
log.addLevel('success', 2000, { fg: 'green', bold: true });


module.exports = log;