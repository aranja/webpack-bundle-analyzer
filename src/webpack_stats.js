"use strict";
function isMultiCompilation(stats) {
    return !stats.hasOwnProperty('modules');
}
exports.isMultiCompilation = isMultiCompilation;
