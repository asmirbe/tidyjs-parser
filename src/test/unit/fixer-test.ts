import { describe, it, expect } from '@jest/globals';
import { fixImportStatement, validateAndFixImportWithBabel } from "../../fixer";

describe("fixImportStatement", () => {
    it("should return null for an empty import declaration", () => {
        const result = fixImportStatement("");
        expect(result.fixed).toBeNull();
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("The import declaration is empty");
    });

    it("should handle a simple import declaration", () => {
        const importStmt = "import { a, b } from 'module';";
        const result = fixImportStatement(importStmt);
        expect(result.fixed).toBe("import { a, b } from 'module';");
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("should handle an invalid import declaration", () => {
        const importStmt = "import { a, b from 'module'"; // Missing closing brace
        const result = fixImportStatement(importStmt);
        expect(result.fixed).toBeNull();
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle comments", () => {
        const importStmt = "import { a } from 'module'; // comment";
        const result = fixImportStatement(importStmt);
        expect(result.fixed).toBe("import { a } from 'module';");
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("should add a semicolon if missing", () => {
        const importStmt = "import { a } from 'module'";
        const result = fixImportStatement(importStmt);
        expect(result.fixed).toBe("import { a } from 'module';");
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });
});

describe("validateAndFixImportWithBabel", () => {
    it("should validate a simple import declaration", () => {
        const importStmt = "import { a } from 'module';";
        const result = validateAndFixImportWithBabel(importStmt);
        expect(result.fixed).toBe("import { a } from 'module';");
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
    });

    it("should return an error for an invalid import declaration", () => {
        const importStmt = "import { a, b from 'module'"; // Missing closing brace
        const result = validateAndFixImportWithBabel(importStmt);
        expect(result.fixed).toBeNull();
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
    });
});