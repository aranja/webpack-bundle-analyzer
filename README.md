Webpack Bundle Size Analyzer
============================

[![Build Status](https://travis-ci.org/robertknight/webpack-bundle-size-analyzer.svg?branch=master)](https://travis-ci.org/robertknight/webpack-bundle-size-analyzer)

A small utility to help you find out what is contributing
to the size of your [Webpack](http://webpack.github.io/) bundles.

Webpack has a JSON output mode which produces detailed machine-readable
information about everything that has been included in a generated bundle.

This output is produced by running `webpack --json`. This tool analyzes
the resulting JSON output and displays a tree of packages that were included
in the bundle, ordered by the size of all the used modules.

For further reading on reducing the size of Webpack bundles,
see their [optimization guide](http://webpack.github.io/docs/optimization.html)

## This fork

This fork creates a package dependency tree instead of file system tree. The cli
is same as before and the output is similar. The main difference is that a package
might appear in multiple places depending on use. In spite of this, each module
only appers once, so the sizes add up correctly. Shared packages will also indicate
which packages are using it.

## Usage

````
npm install -g webpack-bundle-size-analyzer
webpack --json | webpack-bundle-size-analyzer
````

When run on [react-testing](https://github.com/robertknight/react-testing) for example,
it produces this output, where `<self>` refers to the size of the bundle's own code.

````
react: 641.95 kB (55.3%)
  <self>: 641.95 kB (100%)
chai: 125.8 kB (10.8%)
  deep-eql: 7.51 kB (5.97%)
    type-detect: 2.72 kB (36.2%)
      <self>: 2.72 kB (100%)
    <self>: 4.79 kB (63.8%)
  assertion-error: 2.29 kB (1.82%)
    <self>: 2.29 kB (100%)
  <self>: 116 kB (92.2%)
flummox: 73.46 kB (6.33%)
  flux: 9.01 kB (12.3%)
    <self>: 9.01 kB (100%)
  eventemitter3: 5.94 kB (8.08%)
    <self>: 5.94 kB (100%)
  uniqueid: 947 B (1.26%)
    <self>: 947 B (100%)
  object-assign: 484 B (0.643%)
    <self>: 484 B (100%)
  <self>: 57.12 kB (77.8%)
q: 58.84 kB (5.07%)
  <self>: 58.84 kB (100%)
...
<self>: 195.57 kB (16.9%)
````

### Important Note About Minified Code

If you minify/compress your code using the [approach recommended in the Webpack documentation](http://webpack.github.io/docs/optimization.html), which is to use the UglifyJS plugin, be aware that this tool will report the sizes of modules _before_ they are minified. This is because the statistics generated by `webpack --json` do not take account of plugins that operate on the bundle as a whole.

Knowing the sizes of dependencies before they are minified can still be useful to get an idea of how much different dependencies are responsible for size of your minified bundle, but be aware that it can be misleading. This is because some libraries compress better than others.

If instead you minify modules in your bundle individually using a loader (eg. [the UglifyJS loader](https://www.npmjs.com/package/uglify-loader)), the stats output by `webpack --json` _will_ show minified sizes. If you want to get a better idea of the sizes of different dependencies after they are minified, you can temporarily remove the UglifyJS plugin and replace it with [the UglifyJS loader](https://www.npmjs.com/package/uglify-loader) instead before running `webpack --json | webpack-bundle-size-analyzer`.

The reason that using a plugin, rather than a loader, is the recommended approach in Webpack is that compression is better if applied to the whole bundle rather than to individual source files one at a time.
