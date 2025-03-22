"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parser_1 = require("../parser");
console.log("=== Testing isDefault behavior ===");
function runTest() {
    const testCode = `
// Misc
import { formatImports } from './formatter';
import { InvalidImport } from './types';

// Utils
import { configManager } from './utils/config';
import { logDebug, logError } from './utils/log';
import { showMessage } from './utils/misc';

// Core
import { ImportParser, ParserResult } from 'tidyjs-parser';

// VSCode
import { Range, window, commands, workspace } from 'vscode';
import type { ExtensionContext } from 'vscode';
`;
    const parser = new parser_1.ImportParser({
        importGroups: [
            {
                name: "Miscellaneous",
                regex: /.*/, // Match everything
                order: 0,
                isDefault: true
            },
            {
                name: "Utils",
                regex: /.*utils.*/,
                order: 1
            },
            {
                name: "Core",
                regex: /^tidyjs-parser$/,
                order: 2
            },
        ],
    });
    const result = parser.parse(testCode);
    // Checking groups
    console.log("\nDETECTED GROUPS:");
    result.groups.forEach(group => {
        console.log(`\n${group.name} (${group.imports.length} imports):`);
        group.imports.forEach(imp => {
            console.log(`  ${imp.raw.trim()}`);
        });
    });
    // Verify that imports are in the correct groups
    console.log("\nVERIFICATIONS:");
    // 1. Check that utils imports are in the Utils group
    const utilsGroup = result.groups.find(g => g.name === "Utils");
    const hasUtilsInCorrectGroup = utilsGroup?.imports.every(imp => imp.source.includes("utils"));
    console.log("✓ Utils in correct group:", hasUtilsInCorrectGroup ? "OK" : "ERROR");
    // 2. Check that core imports are in the Core group
    const coreGroup = result.groups.find(g => g.name === "Core");
    const hasCoreInCorrectGroup = coreGroup?.imports.every(imp => imp.source === "tidyjs-parser");
    console.log("✓ Core in correct group:", hasCoreInCorrectGroup ? "OK" : "ERROR");
    // 4. Check that only uncategorized imports are in Miscellaneous
    const miscGroup = result.groups.find(g => g.name === "Miscellaneous");
    const hasMiscOnlyUncategorized = miscGroup?.imports.every(imp => !imp.source.includes("utils") &&
        imp.source !== "tidyjs-parser");
    console.log("✓ Only uncategorized imports in Misc:", hasMiscOnlyUncategorized ? "OK" : "ERROR");
    // Summary
    console.log("\nSUMMARY:");
    const allTestsPassed = hasUtilsInCorrectGroup && hasCoreInCorrectGroup && hasMiscOnlyUncategorized;
    console.log(allTestsPassed ? "✅ All tests passed" : "❌ Some tests failed");
    process.exit(allTestsPassed ? 0 : 1);
}
// Run the test
runTest();
