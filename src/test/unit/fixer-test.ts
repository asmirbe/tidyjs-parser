import { describe, it, expect } from '@jest/globals';
import { fixImportStatement, validateAndFixImportWithBabel } from "../../fixer";

describe("fixImportStatement", () => {
    it("devrait retourner null pour une déclaration d'import vide", () => {
        const result = fixImportStatement("");
        expect(result.fixed).toBeNull();
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("La déclaration d'import est vide");
    });

    it("devrait gérer une déclaration d'import simple", () => {
        const importStmt = "import { a, b } from 'module';";
        const result = fixImportStatement(importStmt);
        expect(result.fixed).toBe("import { a, b } from 'module';");
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("devrait gérer une déclaration d'import invalide", () => {
        const importStmt = "import { a, b from 'module'"; // Manque une accolade fermante
        const result = fixImportStatement(importStmt);
        expect(result.fixed).toBeNull();
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("devrait gérer les commentaires", () => {
        const importStmt = "import { a } from 'module'; // commentaire";
        const result = fixImportStatement(importStmt);
        expect(result.fixed).toBe("import { a } from 'module';");
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("devrait ajouter un point-virgule si manquant", () => {
        const importStmt = "import { a } from 'module'";
        const result = fixImportStatement(importStmt);
        expect(result.fixed).toBe("import { a } from 'module';");
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });
});

describe("validateAndFixImportWithBabel", () => {
    it("devrait valider une déclaration d'import simple", () => {
        const importStmt = "import { a } from 'module';";
        const result = validateAndFixImportWithBabel(importStmt);
        expect(result.fixed).toBe("import { a } from 'module';");
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
    });

    it("devrait retourner une erreur pour une déclaration d'import invalide", () => {
        const importStmt = "import { a, b from 'module'"; // Manque une accolade fermante
        const result = validateAndFixImportWithBabel(importStmt);
        expect(result.fixed).toBeNull();
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
    });
});