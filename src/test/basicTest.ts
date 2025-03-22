import { ImportParser } from "../parser";
import { ParserConfig } from "../types";

const config: ParserConfig = {
    importGroups: [
        {
            name: "Others",
            order: 0,
            isDefault: true,
            // Le regex est maintenant optionnel pour le groupe par défaut
        },
        {
            name: "Misc",
            regex: /^react/,
            order: 1,
            priority: 1
        },
        {
            name: "React Modules",
            regex: /^react-router-dom/,
            order: 2,
            priority: 2
        },
        {
            name: "Modules",
            regex: /^react|^@react/,
            order: 2,
            priority: 2
        }
    ]
};

const parser = new ImportParser(config);
const result = parser.parse(`
    import React from 'react';
    import { useState } from 'react';
    import Data from '@user/data';
    import { Route } from 'react-router-dom';
`);

// Afficher les groupes et leurs imports
console.log("Résultats du parsing :");
result.groups.forEach(group => {
    console.log(`\nGroupe: ${group.name} (order: ${group.order})`);
    group.imports.forEach(imp => {
        console.log(`  - ${imp.source}`);
    });
});

// Vérifications
const reactModulesGroup = result.groups.find(g => g.name === "React Modules");
const modulesGroup = result.groups.find(g => g.name === "Modules");
const miscGroup = result.groups.find(g => g.name === "Misc");
const othersGroup = result.groups.find(g => g.name === "Others");

console.log("\nAnalyse des groupes :");
if (reactModulesGroup) {
    console.log("React Modules contient:", reactModulesGroup.imports.map(i => i.source));
}
if (modulesGroup) {
    console.log("Modules contient:", modulesGroup.imports.map(i => i.source));
}
if (miscGroup) {
    console.log("Misc contient:", miscGroup.imports.map(i => i.source));
}
if (othersGroup) {
    console.log("Others contient:", othersGroup.imports.map(i => i.source));
}
// console.log(JSON.stringify(result.groups, null, 2));
