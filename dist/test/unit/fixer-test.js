"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const fixer_1 = require("../../fixer");
(0, globals_1.describe)("fixImportStatement", () => {
    (0, globals_1.it)("devrait retourner null pour une déclaration d'import vide", () => {
        const result = (0, fixer_1.fixImportStatement)("");
        (0, globals_1.expect)(result.fixed).toBeNull();
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.errors).toContain("La déclaration d'import est vide");
    });
    (0, globals_1.it)("devrait gérer une déclaration d'import simple", () => {
        const importStmt = "import { a, b } from 'module';";
        const result = (0, fixer_1.fixImportStatement)(importStmt);
        (0, globals_1.expect)(result.fixed).toBe("import { a, b } from 'module';");
        (0, globals_1.expect)(result.isValid).toBe(true);
        (0, globals_1.expect)(result.errors).toHaveLength(0);
    });
    (0, globals_1.it)("devrait gérer une déclaration d'import invalide", () => {
        const importStmt = "import { a, b from 'module'"; // Manque une accolade fermante
        const result = (0, fixer_1.fixImportStatement)(importStmt);
        (0, globals_1.expect)(result.fixed).toBeNull();
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.errors.length).toBeGreaterThan(0);
    });
    (0, globals_1.it)("devrait gérer les commentaires", () => {
        const importStmt = "import { a } from 'module'; // commentaire";
        const result = (0, fixer_1.fixImportStatement)(importStmt);
        (0, globals_1.expect)(result.fixed).toBe("import { a } from 'module';");
        (0, globals_1.expect)(result.isValid).toBe(true);
        (0, globals_1.expect)(result.errors).toHaveLength(0);
    });
    (0, globals_1.it)("devrait ajouter un point-virgule si manquant", () => {
        const importStmt = "import { a } from 'module'";
        const result = (0, fixer_1.fixImportStatement)(importStmt);
        (0, globals_1.expect)(result.fixed).toBe("import { a } from 'module';");
        (0, globals_1.expect)(result.isValid).toBe(true);
        (0, globals_1.expect)(result.errors).toHaveLength(0);
    });
});
(0, globals_1.describe)("validateAndFixImportWithBabel", () => {
    (0, globals_1.it)("devrait valider une déclaration d'import simple", () => {
        const importStmt = "import { a } from 'module';";
        const result = (0, fixer_1.validateAndFixImportWithBabel)(importStmt);
        (0, globals_1.expect)(result.fixed).toBe("import { a } from 'module';");
        (0, globals_1.expect)(result.isValid).toBe(true);
        (0, globals_1.expect)(result.error).toBeUndefined();
    });
    (0, globals_1.it)("devrait retourner une erreur pour une déclaration d'import invalide", () => {
        const importStmt = "import { a, b from 'module'"; // Manque une accolade fermante
        const result = (0, fixer_1.validateAndFixImportWithBabel)(importStmt);
        (0, globals_1.expect)(result.fixed).toBeNull();
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.error).toBeDefined();
    });
});
