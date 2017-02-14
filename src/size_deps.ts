import filesize = require('filesize');
import path = require('path');
import union = require('lodash/union');
import uniq = require('lodash/uniq');
import { soleAncestor } from './ancestor';
import webpack_stats = require('./webpack_stats');

/**
 * A node in the package size tree
 */
export interface PackageNode {
	name: string;
	parent: null | PackageNode;
	children: PackageNode[];
	chains: PackageNode[];
	modules: webpack_stats.WebpackModule[];
	size: number;
}

export interface ResultNode {
	name: string;
	children: ResultNode[];
	usedBy: string[];
	modules: string[];
	size: number;
}

export interface RootResultNode extends ResultNode {
	bundleName?: string;
}

/**
 * Walk a dependency size tree produced by dependencySizeTree() and output the
 * size contributed to the bundle by each package's own code plus those
 * of its dependencies.
 */
export function printDependencySizeTree(node: ResultNode, shareStats: boolean, depth: number = 0,
																				outputFn: (str: string) => void = console.log) {

	if (node.hasOwnProperty('bundleName')) {
		const rootNode = node as RootResultNode;
		outputFn(`Bundle: ${rootNode.bundleName}`);
	}

	const childrenBySize = node.children.sort((a, b) => {
		return b.size - a.size;
	});

	const totalSize = node.size;
	let remainder = totalSize;
	let includedCount = 0;

	let prefix = '';
	for (let i = 0; i < depth; i++) {
		prefix += '  ';
	}

	for (const child of childrenBySize) {
		++includedCount;
		let out = `${prefix}${child.name}: ${filesize(child.size)}`;
		if (shareStats) {
			const percentage = ((child.size/totalSize) * 100).toPrecision(3);
			out = `${out} (${percentage}%)`;
		}
		if (child.usedBy.length > 1) {
			out = `${out} - shared by ${formatList(child.usedBy, 3)}`
		}
		outputFn(out);

		printDependencySizeTree(child, shareStats, depth + 1, outputFn);

		remainder -= child.size;

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

function formatList(list: string[], count: number) {
	let output = '';
	count = Math.min(count, list.length);
	for (let i = 0, remaining = count - 1; i < count; i++, remaining--) {
		if (remaining === 0 && count < list.length) {
			output += `${list.length - count} more`;
		} else {
			output += list[i];
		}

		if (remaining > 1) {
			output += ', ';
		} else if (remaining > 0) {
			output += ' & ';
		}
	}
	return output;
}

function bundleSizeTree(stats: webpack_stats.WebpackCompilation): RootResultNode {
	const packageByModule = new Map<number, PackageNode>();
	const rootPackage: PackageNode = {
		name: '<root>',
		parent: null,
		chains: [],
		children: [],
		modules: [],
		size: 0,
	};

	function getPackageForModule(id: number): PackageNode {
		let packageNode = packageByModule.get(id);
		const statModule = stats.modules[id];

		if (packageNode) {
			return packageNode;
		}

		if (statModule.reasons.length === 0) {
			packageNode = rootPackage;
		} else {
			const name = getPackageName(statModule);
			const chains = union(...
				statModule.reasons
					.map(reason => getPackageForModule(reason.moduleId))
					.map(node => node.name === name ? node.chains : [node])
			);
			const parent = soleAncestor(chains, node => node.chains) || rootPackage;

			if (parent.name === name) {
				packageNode = parent;
			} else {
				packageNode = parent.children.find(node => node.name === name);
			}

			if (packageNode) {
				// Merge into existing package node.
				packageNode.chains = union(packageNode.chains, chains);
			} else {
				// Create a new package node.
				if (parent == null) {
					throw new Error(`Unexpected orphaned package ${name} for ${statModule.name}`);
				}

				packageNode = {
					name,
					parent: parent || null,
					chains,
					children: [],
					modules: [],
					size: 0,
				};
				if (parent) {
					parent.children.push(packageNode);
				}
			}
		}

		packageNode.modules.push(statModule);
		packageByModule.set(id, packageNode);
		updatePackages(packageNode, statModule);
		return packageNode;
	}

	/**
	 * Adds a module's size to each package in it's chains.
	 *
	 * Additionally it searches for package nodes that exist in all chains. As opposed
	 * to modules that are used by multiple packages. This helps determine the full
	 * weight of a package, including all sub-packages that are not used elsewhere.
	 */
	function updatePackages(packageNode: PackageNode, statModule: webpack_stats.WebpackModule) {
		let node : PackageNode | null = packageNode;
		while (node) {
			node.size += statModule.size;
			node = node.parent;
		}
	}

	stats.modules.forEach(module => getPackageForModule(module.id));
	const result = formatResult(rootPackage) as RootResultNode;
	if (stats.name) {
		result.bundleName = stats.name;
	}
	return result;
}

function formatResult(node: PackageNode): ResultNode {
	return {
		name: node.name,
		children: node.children.map(formatResult),
		usedBy: uniq(node.chains.map(parent => parent.name)),
		modules: node.modules.map(m => m.name),
		size: node.size,
	};
}

function getPackageName(module: webpack_stats.WebpackModule) {
	const match = module.name.match( /^\.\/(.*~\/[^/]+)?/);
	return !match ? '(internal)' :
		match[1] ? match[0].slice(4) :
		'<root>';
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
