import { ImportParser } from "../parser";

// Test détaillé pour comprendre le problème
const testCode = `
// @app/client
import useUtilisateurSearch from '@app/client/providers/parametrage/utilisateurs/UtilisateurSearchProvider';

import AbsenceInitFormComponent from '@app/dossier/components/absences/init/AbsenceInitFormComponent';
// @app/dossier
import AbsencesFormComponent    from '@app/dossier/components/absences/init/AbsencesFormComponent';
import AccordFormComponent      from '@app/dossier/components/britania/init/AbsenceInitFormComponent';

// @app/notification
import { useClientNotification } from '@app/notification/ClientNotificationProvider'; 
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

// Exécuter le regex directement pour voir ce qu'il capture
const importRegex = /(?:^|\n)\s*import\s+(?:(?:type\s+)?(?:{[^;]*}|\*\s*as\s*\w+|\w+)?(?:\s*,\s*(?:{[^;]*}|\*\s*as\s*\w+|\w+))?(?:\s*from)?\s*['"]?[^'";]+['"]?;?|['"][^'"]+['"];?)/g;

console.log("Résultats du regex:");
let match;
let index = 0;
while ((match = importRegex.exec(testCode)) !== null) {
    console.log(`Match ${index++}:`, match[0]);

    // Si l'import commence par un saut de ligne, on l'ignore dans l'extraction
    const startIndex = match[0].startsWith("\n") ? match.index + 1 : match.index;
    const lineEnd = testCode.indexOf("\n", startIndex);
    const importStmt = testCode.substring(startIndex, lineEnd === -1 ? testCode.length : lineEnd).trim();

    console.log("  Import extrait:", importStmt);
    console.log("  Index de début:", match.index);
    console.log("  StartIndex:", startIndex);
    console.log("  LineEnd:", lineEnd);
    console.log("  Caractères autour:", JSON.stringify(testCode.substring(Math.max(0, match.index - 10), match.index + 20)));
    console.log();
}

// Exécuter le parser complet
const result = parser.parse(testCode);

console.log("\nImports détectés par le parser:", result.originalImports);
console.log("Nombre d'imports détectés:", result.originalImports.length);

// Vérifier si l'import problématique est présent
const problematicImport = "import AbsenceInitFormComponent from '@app/dossier/components/absences/init/AbsenceInitFormComponent';";
const isProblematicImportDetected = result.originalImports.includes(problematicImport);

console.log("\nL'import problématique est-il détecté?", isProblematicImportDetected);
