import filesize = require('filesize');
import path = require('path');
import flatten = require('lodash/flatten');
import isEqual = require('lodash/isEqual');
import uniqWith = require('lodash/uniqWith');
import webpack_stats = require('./webpack_stats');

/**
 * A node in the package size tree
 */
export interface ModuleNode {
	/** Package import chains from root to this node. */
	chains: PackageChainNode[],
}

export type MaybeModuleNode = 'partial' | ModuleNode;

export interface Package {
	packageName: string;
	size: number;
	sharedSize: number;
	sharedParents: string[];
}

export interface PackageChainNode {
	chain: string;
	packageName: string;
	parent: null | PackageChainNode;
	children: PackageChainNode[];
	size: number;
	uniqueSize: number;
}

export interface RootPackageNode extends PackageChainNode {
	bundleName?: string;
}

/**
 * Walk a dependency size tree produced by dependencySizeTree() and output the
 * size contributed to the bundle by each package's own code plus those
 * of its dependencies.
 */
export function printDependencySizeTree(node: PackageChainNode, shareStats: boolean, depth: number = 0,
																				outputFn: (str: string) => void = console.log) {

	if (node.hasOwnProperty('bundleName')) {
		const rootNode = node as RootPackageNode;
		outputFn(`Bundle: ${rootNode.bundleName}`);
	}

	const childrenBySize = node.children.sort((a, b) => {
		return b.uniqueSize - a.uniqueSize;
	});

	const totalSize = node.uniqueSize;
	let remainder = totalSize;
	let includedCount = 0;

	let prefix = '';
	for (let i = 0; i < depth; i++) {
		prefix += '  ';
	}

	for (const child of childrenBySize) {
		++includedCount;
		let out = `${prefix}${child.packageName}: ${filesize(child.uniqueSize)}`;
		if (shareStats) {
			const percentage = ((child.uniqueSize/totalSize) * 100).toPrecision(3);
			out = `${out} (${percentage}%)`;
		}
		outputFn(out);

		printDependencySizeTree(child, shareStats, depth + 1, outputFn);

		remainder -= child.uniqueSize;

		if (remainder < 0.01 * totalSize) {
			break;
		}
	}

	if (depth === 0 || remainder !== totalSize) {
		let out = `${prefix}<self>: ${filesize(remainder)}`;
		if (shareStats) {
			const percentage = ((remainder/totalSize) * 100).toPrecision(3);
			out = `${out} (${percentage}%)`
		}
		outputFn(out);
	}
}

function bundleSizeTree(stats: webpack_stats.WebpackCompilation) {
	const modules = new Map<number, MaybeModuleNode>();
	const packages = new Map<string, PackageChainNode>();
	const rootPackage = {
		chain: '.',
		parent: null,
		packageName: '<root>',
		children: [],
		size: 0,
		uniqueSize: 0,
	};

	function getModule(id: number): ModuleNode {
		let module = modules.get(id);
		const statModule = stats.modules[id];

		if (module) {
			if (module === 'partial') {
				throw new Error(`Circular module dependency detected in ${statModule.name}.`);
			}
			return module
		}

		modules.set(id, 'partial');
		module = {
			chains: findPackageChains(statModule),
		};
		modules.set(id, module);
		updatePackages(module.chains, statModule);

		return module
	}

	/**
	 * Finds all chains of packages that include this module.
	 */
	function findPackageChains(module: webpack_stats.WebpackModule) {
		const packageName = getPackageName(module);
		if (module.reasons.length === 0) {
			return [rootPackage];
		}

		let packageChains = module.reasons.map(reason =>
			getModule(reason.moduleId).chains.map(parentPackage => {
				if (parentPackage.packageName === packageName) {
					return parentPackage
				}
				const chain = `${parentPackage.chain}|${packageName}`;
				const existingPackage = packages.get(chain);
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
				};
				parentPackage.children.push(newPackage);
				packages.set(chain, newPackage);
				return newPackage
			})
		);
		return uniqWith(flatten(packageChains), isEqual);
	}

	/**
	 * Adds a module's size to each package in it's chains.
	 *
	 * Additionally it searches for package nodes that exist in all chains. As opposed
	 * to modules that are used by multiple packages. This helps determine the full
	 * weight of a package, including all sub-packages that are not used elsewhere.
	 */
	function updatePackages(packageChains: PackageChainNode[], statModule: webpack_stats.WebpackModule) {
		const chainsPerPackage = new Map<PackageChainNode, number>();
		let packageNode: null | PackageChainNode;
		for (packageNode of packageChains) {
			while (packageNode) {
				packageNode.size += statModule.size;
				chainsPerPackage.set(packageNode, (chainsPerPackage.get(packageNode) || 0) + 1);

				packageNode = packageNode.parent;
			}
		}

		for (const [packageNode, chains] of chainsPerPackage) {
			if (chains === packageChains.length) {
				packageNode.uniqueSize += statModule.size;
			}
		}
	}

	stats.modules.forEach(module => getModule(module.id));
	return removeParentRefs(rootPackage);
}

function removeParentRefs(packageNode: PackageChainNode) {
	packageNode.parent = null;
	packageNode.children.forEach(removeParentRefs);
	return packageNode
}

function getPackageName(module: webpack_stats.WebpackModule) {
	const match = module.name.match( /^\.(.+~\/[^/]+)?/);
	return match ? match[0].slice(4) : '(internal)';
}

/** Takes the output of 'webpack --json', and returns
  * an array of trees of require()'d package names and sizes.
  *
  * There is one entry in the array for each bundle specified
  * in the Webpack compilation.
  */
export function dependencySizeTree(stats: webpack_stats.WebpackStats) {
	if (webpack_stats.isMultiCompilation(stats)) {
		return stats.children.map(bundleSizeTree);
	} else {
		return [bundleSizeTree(stats)];
	}
}
