"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
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
async function parseImports(sourceCode, config) {
    const parser = new parser_1.ImportParser(config);
    const { groups, originalmports, invalidImports } = await parser.parse(sourceCode);
    const subFolders = parser.getSubfolders();
    return { groups, originalmports, subFolders, invalidImports };
}
__exportStar(require("./types"), exports);
