import { ImportParser } from "../parser";

console.log("=== Test du comportement isDefault ===");

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

    const parser = new ImportParser({
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
            {
                name: "VSCode",
                regex: /^vscode$/,
                order: 3
            },
        ],
    });

    const result = parser.parse(testCode);

    // Vérification des groupes
    console.log("\nGROUPES DÉTECTÉS:");
    result.groups.forEach(group => {
        console.log(`\n${group.name} (${group.imports.length} imports):`);
        group.imports.forEach(imp => {
            console.log(`  ${imp.raw.trim()}`);
        });
    });

    // Vérification que les imports sont dans les bons groupes
    console.log("\nVÉRIFICATIONS:");

    // 1. Vérifier que les imports utils sont dans le groupe Utils
    const utilsGroup = result.groups.find(g => g.name === "Utils");
    const hasUtilsInCorrectGroup = utilsGroup?.imports.every(imp => imp.source.includes("utils"));
    console.log("✓ Utils dans le bon groupe:", hasUtilsInCorrectGroup ? "OK" : "ERREUR");

    // 2. Vérifier que les imports vscode sont dans le groupe VSCode
    const vscodeGroup = result.groups.find(g => g.name === "VSCode");
    const hasVSCodeInCorrectGroup = vscodeGroup?.imports.every(imp => imp.source === "vscode");
    console.log("✓ VSCode dans le bon groupe:", hasVSCodeInCorrectGroup ? "OK" : "ERREUR");

    // 3. Vérifier que les imports core sont dans le groupe Core
    const coreGroup = result.groups.find(g => g.name === "Core");
    const hasCoreInCorrectGroup = coreGroup?.imports.every(imp => imp.source === "tidyjs-parser");
    console.log("✓ Core dans le bon groupe:", hasCoreInCorrectGroup ? "OK" : "ERREUR");

    // 4. Vérifier que seuls les imports non catégorisés sont dans Miscellaneous
    const miscGroup = result.groups.find(g => g.name === "Miscellaneous");
    const hasMiscOnlyUncategorized = miscGroup?.imports.every(imp =>
        !imp.source.includes("utils") &&
        imp.source !== "vscode" &&
        imp.source !== "tidyjs-parser"
    );
    console.log("✓ Seulement imports non catégorisés dans Misc:", hasMiscOnlyUncategorized ? "OK" : "ERREUR");

    // Résumé
    console.log("\nRÉSUMÉ:");
    const allTestsPassed = hasUtilsInCorrectGroup && hasVSCodeInCorrectGroup && hasCoreInCorrectGroup && hasMiscOnlyUncategorized;
    console.log(allTestsPassed ? "✅ Tous les tests ont réussi" : "❌ Certains tests ont échoué");

    process.exit(allTestsPassed ? 0 : 1);
}

// Exécuter le test
runTest();
