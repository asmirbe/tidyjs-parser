"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parser_1 = require("../parser");
// Test pour reproduire le bug signalé
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
const parser = new parser_1.ImportParser({
    importGroups: [
        {
            name: "React",
            regex: /^react$/,
            order: 1,
        },
        {
            name: "@app",
            regex: /^@app/,
            order: 2,
            isDefault: true,
        },
        {
            name: "Misc",
            regex: /./,
            order: 3,
        },
    ],
});
const result = parser.parse(testCode);
console.log("Imports détectés:", result.originalImports);
console.log("Nombre d'imports détectés:", result.originalImports.length);
console.log("Groupes:", JSON.stringify(result.groups, null, 2));
// Vérifier si l'import problématique est présent
const problematicImport = "import AbsenceInitFormComponent from '@app/dossier/components/absences/init/AbsenceInitFormComponent';";
const isProblematicImportDetected = result.originalImports.includes(problematicImport);
console.log("L'import problématique est-il détecté?", isProblematicImportDetected);
