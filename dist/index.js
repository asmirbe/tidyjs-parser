"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = exports.validateAndFixImportWithBabel = exports.ImportParserError = exports.ImportParser = void 0;
exports.parseImports = parseImports;
const fixer_1 = require("./fixer");
Object.defineProperty(exports, "validateAndFixImportWithBabel", { enumerable: true, get: function () { return fixer_1.validateAndFixImportWithBabel; } });
const parser_1 = require("./parser");
Object.defineProperty(exports, "ImportParser", { enumerable: true, get: function () { return parser_1.ImportParser; } });
const errors_1 = require("./errors");
Object.defineProperty(exports, "ImportParserError", { enumerable: true, get: function () { return errors_1.ImportParserError; } });
const types_1 = require("./types");
Object.defineProperty(exports, "DEFAULT_CONFIG", { enumerable: true, get: function () { return types_1.DEFAULT_CONFIG; } });
function parseImports(sourceCode, config) {
    const parser = new parser_1.ImportParser(config);
    const { groups, originalImports, invalidImports } = parser.parse(sourceCode);
    const appSubfolders = parser.getAppSubfolders();
    return { groups, originalImports, appSubfolders, invalidImports };
}
