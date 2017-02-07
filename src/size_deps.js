"use strict";
var filesize = require("filesize");
var flatten = require("lodash/flatten");
var isEqual = require("lodash/isEqual");
var uniqWith = require("lodash/uniqWith");
var webpack_stats = require("./webpack_stats");
function modulePath(identifier) {
    // the format of module paths is
    //   '(<loader expression>!)?/path/to/module.js'
    var loaderRegex = /.*!/;
    return identifier.replace(loaderRegex, '');
}
/** Walk a dependency size tree produced by dependencySizeTree() and output the
 * size contributed to the bundle by each package's own code plus those
 * of its dependencies.
 */
function printDependencySizeTree(node, shareStats, depth, outputFn) {
    if (depth === void 0) { depth = 0; }
    if (outputFn === void 0) { outputFn = console.log; }
    if (node.hasOwnProperty('bundleName')) {
        var rootNode = node;
        outputFn("Bundle: " + rootNode.bundleName);
    }
    var childrenBySize = node.children.sort(function (a, b) {
        return b.size - a.size;
    });
    var totalSize = node.size;
    var remainder = totalSize;
    var includedCount = 0;
    var prefix = '';
    for (var i = 0; i < depth; i++) {
        prefix += '  ';
    }
    for (var _i = 0, childrenBySize_1 = childrenBySize; _i < childrenBySize_1.length; _i++) {
        var child = childrenBySize_1[_i];
        ++includedCount;
        var out = "" + prefix + child.packageName + ": " + filesize(child.size);
        if (shareStats) {
            var percentage = ((child.size / totalSize) * 100).toPrecision(3);
            out = out + " (" + percentage + "%)";
        }
        outputFn(out);
        printDependencySizeTree(child, shareStats, depth + 1, outputFn);
        remainder -= child.size;
        if (remainder < 0.01 * totalSize) {
            break;
        }
    }
    if (depth === 0 || remainder !== totalSize) {
        var out = prefix + "<self>: " + filesize(remainder);
        if (shareStats) {
            var percentage = ((remainder / totalSize) * 100).toPrecision(3);
            out = out + " (" + percentage + "%)";
        }
        outputFn(out);
    }
}
exports.printDependencySizeTree = printDependencySizeTree;
function bundleSizeTree(stats) {
    var modules = new Map();
    var packages = new Map();
    var rootPackage = {
        chain: '.',
        parent: null,
        packageName: '.',
        children: [],
        size: 0,
        uniqueSize: 0,
    };
    function getModule(id) {
        var module = modules.get(id);
        var statModule = stats.modules[id];
        if (module) {
            if (module === 'partial') {
                throw new Error("Circular module dependency detected in " + statModule.name + ".");
            }
            return module;
        }
        modules.set(id, 'partial');
        module = {
            packages: findPackageChains(statModule),
        };
        modules.set(id, module);
        updatePackages(module.packages, statModule);
        return module;
    }
    /**
     * Finds all chains of packages that include this module.
     */
    function findPackageChains(module) {
        var packageName = getPackageName(module);
        if (module.reasons.length === 0) {
            return [rootPackage];
        }
        var packageChains = module.reasons.map(function (reason) {
            return getModule(reason.moduleId).chains.map(function (parentPackage) {
                if (parentPackage.packageName === packageName) {
                    return parentPackage;
                }
                var chain = parentPackage.chain + "|" + packageName;
                var existingPackage = packages.get(chain);
                if (existingPackage) {
                    return existingPackage;
                }
                var newPackage = {
                    chain: chain,
                    parent: parentPackage,
                    packageName: packageName,
                    children: [],
                    size: 0,
                    uniqueSize: 0,
                };
                parentPackage.children.push(newPackage);
                packages.set(chain, newPackage);
                return newPackage;
            });
        });
        return uniqWith(flatten(packageChains), isEqual);
    }
    /**
     * Adds a module's size to each package in it's chains.
     *
     * Additionally it searches for package nodes that exist in all chains. As opposed
     * to modules that are used by multiple packages. This helps determine the full
     * weight of a package, including all sub-packages that are not used elsewhere.
     */
    function updatePackages(packageChains, statModule) {
        var chainsPerPackage = new Map();
        var packageNode;
        for (var _i = 0, packageChains_1 = packageChains; _i < packageChains_1.length; _i++) {
            packageNode = packageChains_1[_i];
            while (packageNode) {
                packageNode.size += statModule.size;
                chainsPerPackage.set(packageNode, (chainsPerPackage.get(packageNode) || 0) + 1);
                packageNode = packageNode.parent;
            }
        }
        for (var _a = 0, chainsPerPackage_1 = chainsPerPackage; _a < chainsPerPackage_1.length; _a++) {
            var _b = chainsPerPackage_1[_a], packageNode_1 = _b[0], chains = _b[1];
            if (chains === packageChains.length) {
                packageNode_1.uniqueSize += statModule.size;
            }
        }
    }
    stats.modules.forEach(function (module) { return getModule(module.id); });
    return removeParentRefs(rootPackage);
}
function removeParentRefs(packageNode) {
    packageNode.parent = null;
    packageNode.children.forEach(removeParentRefs);
    return packageNode;
}
function getPackageName(module) {
    var match = module.name.match(/^\.(.+~\/[^/]+)?/);
    return match ? match[0] : '.';
}
/** Takes the output of 'webpack --json', and returns
  * an array of trees of require()'d package names and sizes.
  *
  * There is one entry in the array for each bundle specified
  * in the Webpack compilation.
  */
function dependencySizeTree(stats) {
    if (webpack_stats.isMultiCompilation(stats)) {
        return stats.children.map(bundleSizeTree);
    }
    else {
        return [bundleSizeTree(stats)];
    }
}
exports.dependencySizeTree = dependencySizeTree;
