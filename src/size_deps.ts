import filesize = require('filesize');
import path = require('path');
import isEqual = require('lodash/isEqual');
import uniqWith = require('lodash/uniqWith');

import webpack_stats = require('./webpack_stats');

function modulePath(identifier: string) {
	// the format of module paths is
	//   '(<loader expression>!)?/path/to/module.js'
	let loaderRegex = /.*!/;
	return identifier.replace(loaderRegex, '');
}

/** A node in the package size tree
  */
export interface ModuleNode {
	/** Package import chains from root to this node. */
	packages: PackageNode[],
}

export interface PackageNode {
	chain: string;
	packageName: string;
	parent: PackageNode;
	children: PackageNode[];
	size: number;
	uniqueSize: number;
}

export interface RootStatsNode extends ModuleNode {
	bundleName?: string;
}


function doStuff(stats: webpack_stats.WebpackCompilation) {
	const modules = new Map<number, ModuleNode>()
	const packages = new Map<string, PackageNode>()
	const rootPackage = {
		chain: '.',
		packageName: '.',
		children: [],
		size: 0,
		uniqueSize: 0,
	}

	function getModule(id: number) {
		let module = modules.get(id)
		if (module) {
			return module
		}
		const statModule = stats.modules[id]
		module = {
			packages: getPackages(statModule),
		}
		modules.set(id, module)
		return module
	}

	function getPackages(module: webpack_stats.WebpackModule) {
		const packageName = getPackageName(module)
		const chains = module.reasons.map(reason => {
			const packages = getModule(reason.moduleId).packages.map(parentPackage => {
				if (parentPackage.packageName === packageName) {
					return parentPackage
				}
				const chain = `${parentPackage.chain}|${packageName}`
				const existingPackage = packages.get(chain)
				if (existingPackage) {
					return existingPackage
				}
				const newPackage = {
					chain,
					parent: parentPackage,
					packageName,
					children: [],
					size: 0,
					uniqueSize: 0,
				}
				parentPackage.children.push(newPackage)
				packages.set(chain, newPackage)
				return newPackage
			})
		})
		return uniqWith(chains, isEqual)
	}

	function getPackageChains(module: webpack_stats.WebpackModule) {
		const packageName = getPackageName(module)
		const chains = module.reasons.map(reason => {
			const chain = getModule(reason.moduleId).packageChains.slice()
			if (chain[chain.length - 1] !== packageName) {
				chain.push(packageName)
			}
			return chain.join('|')
		})
		return uniqWith(chains, isEqual)
	}

	stats.modules.forEach(module => getModule(module.id))
}

function getPackageName(module: webpack_stats.WebpackModule) {
	const match = module.name.match( /^\.(.+~\/[^/]+)?/)
	return match ? match[0] : '.'
}

/** Takes the output of 'webpack --json', and returns
  * an array of trees of require()'d package names and sizes.
  *
  * There is one entry in the array for each bundle specified
  * in the Webpack compilation.
  */
export function dependencySizeTree(stats: webpack_stats.WebpackStats) {
	if (webpack_stats.isMultiCompilation(stats)) {
		return stats.children.map(doStuff);
	} else {
		return [doStuff(stats)];
	}
}
