import { validateConfig } from "../../src/validator";
import { ParserConfig } from "../../src/types";
import { describe, expect, test } from "@jest/globals";

function createInvalidRegExp(): RegExp {
    const invalidRegExp = new RegExp('a');
    Object.defineProperty(invalidRegExp, 'test', {
        value: () => { throw new Error('Invalid RegExp'); }
    });
    return invalidRegExp;
}

describe("Config Validator", () => {
    test("should validate a correct configuration", () => {
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

    test("should detect a configuration without groups", () => {
        const config: ParserConfig = {
            importGroups: [],
        };

        const result = validateConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].message).toContain("At least one import group must be defined");
    });

    test("should detect an invalid regular expression", () => {
        const config: ParserConfig = {
            importGroups: [
                { name: "Invalid", regex: createInvalidRegExp(), order: 0 }, // Invalid RegExp
            ],
        };

        const result = validateConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].type).toBe("regex");
    });

    test("should detect a too permissive regular expression", () => {
        const config: ParserConfig = {
            importGroups: [
                { name: "TooPermissive", regex: /.*/, order: 0 },
            ],
        };

        const result = validateConfig(config);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].message.toLowerCase()).toContain("too permissive");
    });

    test("should validate the order of groups", () => {
        const config: ParserConfig = {
            importGroups: [
                { name: "First", regex: /^first$/, order: 0 },
                { name: "Also First", regex: /^also-first$/, order: 0 },
            ],
        };

        const result = validateConfig(config);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].message).toContain("Duplicate order detected");
    });

    test("should validate typeOrder", () => {
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

    test("should validate patterns", () => {
        const config: ParserConfig = {
            importGroups: [{ name: "Test", regex: /^test$/, order: 0 }],
            patterns: {
                subfolderPattern: createInvalidRegExp(), // Invalid RegExp
            },
        };

        const result = validateConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].type).toBe("regex");
        expect(result.errors[0].field).toBe("subfolderPattern");
    });

    test("should validate regex patterns for priority ordering", () => {
        const config: ParserConfig = {
            importGroups: [
                {
                    name: "Test",
                    regex: createInvalidRegExp(),
                    order: 0
                }
            ]
        };

        const result = validateConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].type).toBe("regex");
    });

    test("should validate complex regex patterns with alternation", () => {
        const config: ParserConfig = {
            importGroups: [
                {
                    name: "Components",
                    regex: /^@components\/(core|shared|ui)\//,
                    order: 0
                }
            ]
        };

        const result = validateConfig(config);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test("should validate a default group", () => {
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

    test("should detect an empty group name", () => {
        const config: ParserConfig = {
            importGroups: [{ name: "", regex: /^test$/, order: 0 }],
        };

        const result = validateConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].message).toContain("cannot be empty");
    });

    test("should validate priority values", () => {
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
