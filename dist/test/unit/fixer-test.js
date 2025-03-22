"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const fixer_1 = require("../../fixer");
(0, globals_1.describe)("fixImportStatement", () => {
    (0, globals_1.it)("should return null for an empty import declaration", () => {
        const result = (0, fixer_1.fixImportStatement)("");
        (0, globals_1.expect)(result.fixed).toBeNull();
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.errors).toContain("The import declaration is empty");
    });
    (0, globals_1.it)("should handle a simple import declaration", () => {
        const importStmt = "import { a, b } from 'module';";
        const result = (0, fixer_1.fixImportStatement)(importStmt);
        (0, globals_1.expect)(result.fixed).toBe("import { a, b } from 'module';");
        (0, globals_1.expect)(result.isValid).toBe(true);
        (0, globals_1.expect)(result.errors).toHaveLength(0);
    });
    (0, globals_1.it)("should handle an invalid import declaration", () => {
        const importStmt = "import { a, b from 'module'"; // Missing closing brace
        const result = (0, fixer_1.fixImportStatement)(importStmt);
        (0, globals_1.expect)(result.fixed).toBeNull();
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.errors.length).toBeGreaterThan(0);
    });
    (0, globals_1.it)("should handle comments", () => {
        const importStmt = "import { a } from 'module'; // comment";
        const result = (0, fixer_1.fixImportStatement)(importStmt);
        (0, globals_1.expect)(result.fixed).toBe("import { a } from 'module';");
        (0, globals_1.expect)(result.isValid).toBe(true);
        (0, globals_1.expect)(result.errors).toHaveLength(0);
    });
    (0, globals_1.it)("should add a semicolon if missing", () => {
        const importStmt = "import { a } from 'module'";
        const result = (0, fixer_1.fixImportStatement)(importStmt);
        (0, globals_1.expect)(result.fixed).toBe("import { a } from 'module';");
        (0, globals_1.expect)(result.isValid).toBe(true);
        (0, globals_1.expect)(result.errors).toHaveLength(0);
    });
});
(0, globals_1.describe)("validateAndFixImportWithBabel", () => {
    (0, globals_1.it)("should validate a simple import declaration", () => {
        const importStmt = "import { a } from 'module';";
        const result = (0, fixer_1.validateAndFixImportWithBabel)(importStmt);
        (0, globals_1.expect)(result.fixed).toBe("import { a } from 'module';");
        (0, globals_1.expect)(result.isValid).toBe(true);
        (0, globals_1.expect)(result.error).toBeUndefined();
    });
    (0, globals_1.it)("should return an error for an invalid import declaration", () => {
        const importStmt = "import { a, b from 'module'"; // Missing closing brace
        const result = (0, fixer_1.validateAndFixImportWithBabel)(importStmt);
        (0, globals_1.expect)(result.fixed).toBeNull();
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.error).toBeDefined();
    });
});
