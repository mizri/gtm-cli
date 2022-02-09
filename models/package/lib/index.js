'use strict';
const path = require('path');
const npminstall = require('npminstall')
const fse = require('fs-extra');
const utils = require('@gtm-cli/utils');
const formatPath = require('@gtm-cli/format-path');
const { getDefaultRegistry, getNpmLatestVersion } = require('@gtm-cli/get-npm-info');

const esmLoaderPathExists = import('path-exists');
const esmLoaderPkgDir = import('pkg-dir');

class Package {
	constructor(options) {
		if (!options) {
			throw new Error('package options参数不能为空')
		};

		if (!utils.isPlainObject(options)) {
			throw new Error('参数必须为对象');
		}
		// package目标路径
		this.targetPath = options.targetPath;
		// package缓存路径
		this.storeDir = options.storeDir;
		// package的name
		this.packageName = options.packageName;
		// package 版本
		this.packageVersion = options.packageVersion;
		// package缓存目录前缀
		this.cacheFilePathPrefix = this.packageName.replace('/', '_');
	}

	async prepare() {
		const pathExists = await esmLoaderPathExists;
		// 如果缓存目录实际文件是不存在的
		if (this.storeDir && !pathExists.pathExistsSync(this.storeDir)) {
			// 创建目录
			fse.mkdirpSync(this.storeDir);
		}
		// 获取当前包的最新版本
		if (this.packageVersion === 'latest') {
			this.packageVersion = await getNpmLatestVersion(this.packageName);
		}
	}

	// 获取缓存文件最新版本的真实路径存
	get cacheFilePath() {
		return this.getSpeficCacheFilePath(this.packageVersion);
	}

	/**
	 * 获取指定版本缓存路径
	 * @param {String} packageVersion 
	 * @returns 
	 */
	getSpeficCacheFilePath(packageVersion) {
		return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${packageVersion}@${this.packageName}`);
	}

	/**
	 * 判断当前package是否存在
	 * @returns 
	 */
	async exists() {
		const pathExists = await esmLoaderPathExists;
		if (this.storeDir) {
			await this.prepare();
			return pathExists.pathExistsSync(this.cacheFilePath);
		}
		return pathExists.pathExistsSync(this.targetPath);
	}

	// 更新package
	async update() {
		await this.prepare();
		const pathExists = await esmLoaderPathExists;
		// 1. 获取最新的npm版本号
		const latestPackageVersion = await getNpmLatestVersion(this.packageName);
		// 2. 查询最新版本好对应的路径是否存在
		const latestFilePath = this.getSpeficCacheFilePath(latestPackageVersion);
		// 3. 如果不存在就直接安装最新版本
		if (!pathExists.pathExistsSync(latestFilePath)) {
			await this.install(latestPackageVersion);
			// 更新当前版本号
			this.packageVersion = latestPackageVersion;
		} else {
			// 更新当前版本号
			this.packageVersion = latestPackageVersion;
		}
	}

	/**
	 * 安装package
	 */
	async install(packageVersion) {
		await this.prepare();

		return npminstall({
			root: this.targetPath,
			storeDir: this.storeDir,
			registry: getDefaultRegistry(),
			pkgs: [
				{
					name: this.packageName,
					version: packageVersion || this.packageVersion,
				}
			]
		});
	}

	/**
	 * 获取入口文件路径
	 */
	async getRootFilePath() {
		// 1. 获取package.json 所在目录
		const pkgDir = await esmLoaderPkgDir;

		function _getRootFile(targetPath) {
			const dir = pkgDir.packageDirectorySync({ cwd: targetPath });
			if (dir) {
				// 2. 读取package.json
				const pkgFile = require(path.resolve(dir, 'package.json'));
				// 3. 查询package.(main | lib)
				if (pkgFile && (pkgFile.main)) {
					// 4. 路径兼容（macOS/windows）
					return formatPath(path.resolve(dir, pkgFile.main));
				}
			}
			return null;
		}

		if (this.storeDir) {
			return _getRootFile(this.cacheFilePath);
		}

		return _getRootFile(this.targetPath);
	}
}
module.exports = Package;