import { ImportParser } from "../parser";

// Test simplifié pour isoler le problème
const testCode = `
import AbsenceInitFormComponent from '@app/dossier/components/absences/init/AbsenceInitFormComponent';
`;

const parser = new ImportParser({
    importGroups: [
        {
            name: "@app",
            regex: /^@app/,
            order: 1,
            isDefault: true,
        },
    ],
});

const result = parser.parse(testCode);

console.log("Imports détectés:", result.originalImports);
console.log("Nombre d'imports détectés:", result.originalImports.length);
console.log("Groupes:", JSON.stringify(result.groups, null, 2));

// Vérifier si l'import est présent
const importStatement = "import AbsenceInitFormComponent from '@app/dossier/components/absences/init/AbsenceInitFormComponent';";
const isImportDetected = result.originalImports.includes(importStatement);

console.log("L'import est-il détecté?", isImportDetected);

// Afficher le code source normalisé pour le débogage
console.log("\nCode source normalisé:");
console.log(JSON.stringify("\n" + testCode.replace(/\n/g, "\n"), null, 2));
