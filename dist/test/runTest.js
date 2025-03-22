"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const resultsDir = path_1.default.resolve(__dirname, "./results");
if (!fs_1.default.existsSync(resultsDir)) {
    fs_1.default.mkdirSync(resultsDir, { recursive: true });
}
console.log("=== Exécution des tests du parser d'imports ===");
console.log("Date: " + new Date().toLocaleString());
console.log("");
function runTest(testFile, description) {
    console.log(`\n=== Exécution de ${description} ===`);
    console.log(`Fichier: ${testFile}`);
    console.log("");
    try {
        const output = (0, child_process_1.execSync)(`npx ts-node ${testFile}`, { encoding: "utf-8" });
        console.log(output);
        return true;
    }
    catch (error) {
        console.error(`Erreur lors de l'exécution de ${testFile}:`);
        if (error instanceof Error) {
            console.error(error.message);
        }
        else {
            console.error(String(error));
        }
        return false;
    }
}
const standardTestSuccess = runTest(path_1.default.resolve(__dirname, "./test.ts"), "tests standard");
const errorTestSuccess = runTest(path_1.default.resolve(__dirname, "./error-test.ts"), "tests d'erreur spécifiques");
console.log("\n=== Résumé des tests ===");
console.log(`Tests standard: ${standardTestSuccess ? "✅ SUCCÈS" : "❌ ÉCHEC"}`);
console.log(`Tests d'erreur: ${errorTestSuccess ? "✅ SUCCÈS" : "❌ ÉCHEC"}`);
console.log(`Résultat global: ${standardTestSuccess && errorTestSuccess ? "✅ TOUS LES TESTS ONT RÉUSSI" : "❌ CERTAINS TESTS ONT ÉCHOUÉ"}`);
const timestamp = Date.now();
const reportPath = path_1.default.resolve(__dirname, `./results/test-report-${timestamp}.json`);
fs_1.default.writeFileSync(reportPath, JSON.stringify({
    timestamp,
    date: new Date().toISOString(),
    results: {
        standardTests: standardTestSuccess,
        errorTests: errorTestSuccess,
        allTestsPassed: standardTestSuccess && errorTestSuccess,
    },
}, null, 2));
console.log(`\nRapport de test écrit dans: ${reportPath}`);
process.exit(standardTestSuccess && errorTestSuccess ? 0 : 1);
