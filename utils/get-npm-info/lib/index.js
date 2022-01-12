'use strict';

const axios = require('axios');
const semver = require('semver');
const urlJoin = require('url-join');

/**
 * 查询npm包信息
 * @param {Stirng} npmName 包名
 * @param {String} registry 仓库源
 */
function getNpmInfo(npmName, registry) {
  if (!npmName) {
		return null;
	}
	const registryUrl = registry || getDefaultRegistry();
	// 拼接url
	const npmInfoUrl = urlJoin(registryUrl, npmName);
	// 从npm仓库获取包的信息
	return axios.get(npmInfoUrl).then((respone) => {
		if (respone.status === 200) {
			return respone.data;
		}
		return null;
	}).catch(err => {
		return Promise.reject(err);
	});
}

/**
 * 获取源
 * @param {String}} isOriginal 
 */
function getDefaultRegistry(isOriginal = false) {
	return isOriginal ? 'https://registry.npmjs.org/' : 'https://registry.npm.taobao.org/';
}

/**
 * 查询查询版本号
 * @param {Stirng} npmName 包名
 * @param {String} registry 仓库源
 */
 async function getNpmVersions(npmName, registry) {
  const data = await getNpmInfo(npmName, registry);
  if (data) {
    return Object.keys(data.versions);
  }

	return [];
}

/**
 * 获取比当前版本号大的版本号
 * @param {String} baseVersion 
 * @param {Array<string>} versions 
 */
function getSemverVersions(baseVersion, versions) {
	return versions
		.filter(version => semver.satisfies(version, `^${baseVersion}`))
		.sort((a, b) => semver.gt(b, a));
}

/**
 * 获取最新的版本号
 * @param {String} baseVersion 当前版本号
 * @param {String} npmName 包名
 * @param {String} registry 查询源
 * @returns 
 */
async function getNpmSemverVersion(baseVersion, npmName, registry) {
	const versions = await getNpmVersions(npmName, registry);
	const newVersions = getSemverVersions(baseVersion, versions);
	if (newVersions && newVersions.length) {
		return newVersions[0];
	}
}

/**
 * 获取最新的版本
 * @param {String} npmName 包名
 * @param {String} registry 查询源
 * @returns 
 */
async function getNpmLatestVersion(npmName, registry) {
	const versions = await getNpmVersions(npmName, registry);

	if (versions) {
		return versions.sort((a, b) => semver.gt(b, a))[0];
	}

	return null;
}

exports.getNpmInfo = getNpmInfo;
exports.getNpmVersions = getNpmVersions;
exports.getSemverVersions = getSemverVersions;
exports.getNpmSemverVersion = getNpmSemverVersion;
exports.getDefaultRegistry = getDefaultRegistry;
exports.getNpmLatestVersion = getNpmLatestVersion;

