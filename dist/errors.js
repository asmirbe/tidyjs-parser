"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportParserError = void 0;
class ImportParserError extends Error {
    constructor(message, raw) {
        super(message);
        this.raw = raw;
        this.name = 'ImportParserError';
    }
}
exports.ImportParserError = ImportParserError;
