"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportParserError = void 0;
class ImportParserError extends Error {
    constructor(message, originalmports) {
        super(message);
        this.originalmports = originalmports;
        this.name = 'ImportParserError';
    }
}
exports.ImportParserError = ImportParserError;
