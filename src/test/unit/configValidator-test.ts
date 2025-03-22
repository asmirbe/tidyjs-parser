import { validateConfig } from "../../configValidator";
import { ParserConfig } from "../../types";
import { describe, expect, test } from "@jest/globals";

function createInvalidRegExp(): RegExp {
    const invalidRegExp = new RegExp('a');
    Object.defineProperty(invalidRegExp, 'test', {
        value: () => { throw new Error('Invalid RegExp'); }
    });
    return invalidRegExp;
}

describe("Config Validator", () => {
    test("devrait valider une configuration correcte", () => {
        const config: ParserConfig = {
            importGroups: [
                { name: "React", regex: /^react$/, order: 0 },
                { name: "Components", regex: /^@components/, order: 1 },
                { name: "Utils", regex: /^@utils/, order: 2 },
            ],
        };

        const result = validateConfig(config);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test("devrait détecter une configuration sans groupes", () => {
        const config: ParserConfig = {
            importGroups: [],
        };

        const result = validateConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].message).toContain("Au moins un groupe d'import doit être défini");
    });

    test("devrait détecter une expression régulière invalide", () => {
        const config: ParserConfig = {
            importGroups: [
                { name: "Invalid", regex: createInvalidRegExp(), order: 0 }, // RegExp invalide
            ],
        };

        const result = validateConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].type).toBe("regex");
    });

    test("devrait détecter une expression régulière trop permissive", () => {
        const config: ParserConfig = {
            importGroups: [
                { name: "TooPermissive", regex: /.*/, order: 0 },
            ],
        };

        const result = validateConfig(config);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].message).toContain("trop permissive");
    });

    test("devrait valider les ordres des groupes", () => {
        const config: ParserConfig = {
            importGroups: [
                { name: "First", regex: /^first$/, order: 0 },
                { name: "Also First", regex: /^also-first$/, order: 0 },
            ],
        };

        const result = validateConfig(config);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].message).toContain("Ordre en doublon détecté");
    });

    test("devrait valider le typeOrder", () => {
        const config: ParserConfig = {
            importGroups: [{ name: "Test", regex: /^test$/, order: 0 }],
            typeOrder: {
                sideEffect: 0,
                default: "invalid" as any,
                named: 2,
                typeDefault: 3,
                typeNamed: 4,
            },
        };

        const result = validateConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].field).toContain("typeOrder");
    });

    test("devrait valider les patterns", () => {
        const config: ParserConfig = {
            importGroups: [{ name: "Test", regex: /^test$/, order: 0 }],
            patterns: {
                appSubfolderPattern: createInvalidRegExp(), // RegExp invalide
            },
        };

        const result = validateConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].type).toBe("regex");
        expect(result.errors[0].field).toBe("appSubfolderPattern");
    });

    test("devrait valider les imports prioritaires", () => {
        const config: ParserConfig = {
            importGroups: [{ name: "Test", regex: /^test$/, order: 0 }],
            priorityImports: [/^not-a-regex$/, createInvalidRegExp(), /.*/ as RegExp], // Le deuxième pattern est invalide
        };

        const result = validateConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].field).toContain("priorityImports");
    });

    test("devrait valider un groupe par défaut", () => {
        const config: ParserConfig = {
            importGroups: [
                { name: "Default", isDefault: true, order: 0 },
                { name: "Test", regex: /^test$/, order: 1 },
            ],
        };

        const result = validateConfig(config);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test("devrait détecter un nom de groupe vide", () => {
        const config: ParserConfig = {
            importGroups: [{ name: "", regex: /^test$/, order: 0 }],
        };

        const result = validateConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].message).toContain("ne peut pas être vide");
    });

    test("devrait valider les valeurs de priorité", () => {
        const config: ParserConfig = {
            importGroups: [
                { name: "Test", regex: /^test$/, order: 0, priority: "high" as any },
            ],
        };

        const result = validateConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].field).toBe("priority");
    });
});
