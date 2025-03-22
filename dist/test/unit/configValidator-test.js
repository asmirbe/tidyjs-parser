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
    (0, globals_1.test)("should validate a correct configuration", () => {
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
    (0, globals_1.test)("should detect a configuration without groups", () => {
        const config = {
            importGroups: [],
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.errors[0].message).toContain("At least one import group must be defined");
    });
    (0, globals_1.test)("should detect an invalid regular expression", () => {
        const config = {
            importGroups: [
                { name: "Invalid", regex: createInvalidRegExp(), order: 0 }, // Invalid RegExp
            ],
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.errors[0].type).toBe("regex");
    });
    (0, globals_1.test)("should detect a too permissive regular expression", () => {
        const config = {
            importGroups: [
                { name: "TooPermissive", regex: /.*/, order: 0 },
            ],
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.warnings).toHaveLength(1);
        (0, globals_1.expect)(result.warnings[0].message.toLowerCase()).toContain("too permissive");
    });
    (0, globals_1.test)("should validate the order of groups", () => {
        const config = {
            importGroups: [
                { name: "First", regex: /^first$/, order: 0 },
                { name: "Also First", regex: /^also-first$/, order: 0 },
            ],
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.warnings).toHaveLength(1);
        (0, globals_1.expect)(result.warnings[0].message).toContain("Duplicate order detected");
    });
    (0, globals_1.test)("should validate typeOrder", () => {
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
    (0, globals_1.test)("should validate patterns", () => {
        const config = {
            importGroups: [{ name: "Test", regex: /^test$/, order: 0 }],
            patterns: {
                appSubfolderPattern: createInvalidRegExp(), // Invalid RegExp
            },
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.errors[0].type).toBe("regex");
        (0, globals_1.expect)(result.errors[0].field).toBe("appSubfolderPattern");
    });
    (0, globals_1.test)("should validate priority imports", () => {
        const config = {
            importGroups: [{ name: "Test", regex: /^test$/, order: 0 }],
            priorityImports: [/^not-a-regex$/, createInvalidRegExp(), /.*/], // The second pattern is invalid
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.errors[0].field).toContain("priorityImports");
    });
    (0, globals_1.test)("should validate a default group", () => {
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
    (0, globals_1.test)("should detect an empty group name", () => {
        const config = {
            importGroups: [{ name: "", regex: /^test$/, order: 0 }],
        };
        const result = (0, configValidator_1.validateConfig)(config);
        (0, globals_1.expect)(result.isValid).toBe(false);
        (0, globals_1.expect)(result.errors[0].message).toContain("cannot be empty");
    });
    (0, globals_1.test)("should validate priority values", () => {
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
