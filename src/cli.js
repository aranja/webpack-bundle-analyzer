"use strict";
var commander = require("commander");
var fs = require("fs");
var size_deps = require("./size_deps");
function printStats(json, opts) {
    var bundleStats;
    try {
        bundleStats = JSON.parse(json);
    }
    catch (err) {
        console.error("Error: The input is not valid JSON.\n\nCheck that:\n - You passed the '--json' argument to 'webpack'\n - There is no extra non-JSON content in the output, such as log messages.\n\nThe parsing error was:\n\n  " + err + "\n");
        return;
    }
    var depTrees = size_deps.dependencySizeTree(bundleStats);
    if (opts.outputAsJson) {
        console.log(JSON.stringify(depTrees, undefined, 2));
    }
    else {
        depTrees.forEach(function (tree) { return size_deps.printDependencySizeTree(tree, opts.shareStats); });
    }
}
commander.version(require('../../package.json').version)
    .option('-j --json', 'Output as JSON')
    .option('--no-share-stats', 'Do not output dependency sizes as a percentage')
    .usage('[options] [Webpack JSON output]')
    .description("Analyzes the JSON output from 'webpack --json'\n  and displays the total size of JS modules\n  contributed by each NPM package that has been included in the bundle.\n\n  The JSON output can either be supplied as the first argument or\n  passed via stdin.\n  ");
commander.parse(process.argv);
var opts = {
    outputAsJson: commander['json'],
    shareStats: commander['shareStats']
};
if (commander.args[0]) {
    try {
        printStats(fs.readFileSync(commander.args[0]).toString(), opts);
    }
    catch (err) {
        process.exit(1);
    }
}
else if (!process.stdin.isTTY) {
    var json_1 = '';
    process.stdin.on('data', function (chunk) { return json_1 += chunk.toString(); });
    process.stdin.on('end', function () { return printStats(json_1, opts); });
}
else {
    console.error('No Webpack JSON output file specified. Use `webpack --json` to generate it.');
    process.exit(1);
}
