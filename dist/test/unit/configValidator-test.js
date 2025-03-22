"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const configValidator_1 = require("../../configValidator");
const globals_1 = require("@jest/globals");
function createInvalidRegExp() {
    const invalidRegExp = new RegExp('a');
    Object.defineProperty(invalidRegExp, 'test', {
        value: () => { throw new Error('Invalid RegExp'); }
    });
    return invalidRegExp;
}
(0, globals_1.describe)("Config Validator", () => {
    (0, globals_1.test)("devrait valider une configuration correcte", () => {
        const config = {
            importGroups: [
                { name: "React", regex: /^react$/, order: 0 },
                { name: "Components", regex: /^@components/, order: 1 },
                { name: "Utils", regex: /^@utils/, order: 2 },
            ],
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.isValid).toBe(true);
        (0, globals_1.expect)(result.errors).toHaveLength(0);
    });
    (0, globals_1.test)("devrait détecter une configuration sans groupes", () => {
        const config = {
            importGroups: [],
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.errors[0].message).toContain("Au moins un groupe d'import doit être défini");
    });
    (0, globals_1.test)("devrait détecter une expression régulière invalide", () => {
        const config = {
            importGroups: [
                { name: "Invalid", regex: createInvalidRegExp(), order: 0 }, // RegExp invalide
            ],
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.errors[0].type).toBe("regex");
    });
    (0, globals_1.test)("devrait détecter une expression régulière trop permissive", () => {
        const config = {
            importGroups: [
                { name: "TooPermissive", regex: /.*/, order: 0 },
            ],
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.warnings).toHaveLength(1);
        (0, globals_1.expect)(result.warnings[0].message).toContain("trop permissive");
    });
    (0, globals_1.test)("devrait valider les ordres des groupes", () => {
        const config = {
            importGroups: [
                { name: "First", regex: /^first$/, order: 0 },
                { name: "Also First", regex: /^also-first$/, order: 0 },
            ],
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.warnings).toHaveLength(1);
        (0, globals_1.expect)(result.warnings[0].message).toContain("Ordre en doublon détecté");
    });
    (0, globals_1.test)("devrait valider le typeOrder", () => {
        const config = {
            importGroups: [{ name: "Test", regex: /^test$/, order: 0 }],
            typeOrder: {
                sideEffect: 0,
                default: "invalid",
                named: 2,
                typeDefault: 3,
                typeNamed: 4,
            },
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.errors[0].field).toContain("typeOrder");
    });
    (0, globals_1.test)("devrait valider les patterns", () => {
        const config = {
            importGroups: [{ name: "Test", regex: /^test$/, order: 0 }],
            patterns: {
                appSubfolderPattern: createInvalidRegExp(), // RegExp invalide
            },
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.errors[0].type).toBe("regex");
        (0, globals_1.expect)(result.errors[0].field).toBe("appSubfolderPattern");
    });
    (0, globals_1.test)("devrait valider les imports prioritaires", () => {
        const config = {
            importGroups: [{ name: "Test", regex: /^test$/, order: 0 }],
            priorityImports: [/^not-a-regex$/, createInvalidRegExp(), /.*/], // Le deuxième pattern est invalide
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.errors[0].field).toContain("priorityImports");
    });
    (0, globals_1.test)("devrait valider un groupe par défaut", () => {
        const config = {
            importGroups: [
                { name: "Default", isDefault: true, order: 0 },
                { name: "Test", regex: /^test$/, order: 1 },
            ],
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.isValid).toBe(true);
        (0, globals_1.expect)(result.errors).toHaveLength(0);
    });
    (0, globals_1.test)("devrait détecter un nom de groupe vide", () => {
        const config = {
            importGroups: [{ name: "", regex: /^test$/, order: 0 }],
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.errors[0].message).toContain("ne peut pas être vide");
    });
    (0, globals_1.test)("devrait valider les valeurs de priorité", () => {
        const config = {
            importGroups: [
                { name: "Test", regex: /^test$/, order: 0, priority: "high" },
            ],
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.errors[0].field).toBe("priority");
    });
});
