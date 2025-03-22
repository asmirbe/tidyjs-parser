"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const parser_1 = require("../../parser");
(0, globals_1.describe)("ImportParser - Priorité des groupes", () => {
    (0, globals_1.it)("devrait choisir le groupe avec la priorité la plus élevée quand plusieurs groupes correspondent", () => {
        const config = {
            importGroups: [
                {
                    name: "React",
                    regex: /^react/,
                    order: 1,
                    priority: 2
                },
                {
                    name: "Modules",
                    regex: /^react|^@react/,
                    order: 2,
                    priority: 1
                }
            ]
        };
        const parser = new parser_1.ImportParser(config);
        const result = parser.parse(`
            import React from 'react';
            import { useState } from 'react';
            import { Route } from 'react-router-dom';
        `);
        // Tous les imports devraient être dans le groupe "React" car il a la priorité la plus élevée
        (0, globals_1.expect)(result.groups).toHaveLength(1);
        (0, globals_1.expect)(result.groups[0].name).toBe("React");
        (0, globals_1.expect)(result.groups[0].imports).toHaveLength(3);
    });
    (0, globals_1.it)("devrait utiliser l'ordre de définition quand les priorités ne sont pas définies", () => {
        const config = {
            importGroups: [
                {
                    name: "React",
                    regex: /^react/,
                    order: 1
                },
                {
                    name: "Modules",
                    regex: /^react|^@react/,
                    order: 2
                }
            ]
        };
        const parser = new parser_1.ImportParser(config);
        const result = parser.parse(`
            import React from 'react';
            import { useState } from 'react';
            import { Route } from 'react-router-dom';
        `);
        // Les imports devraient être dans le groupe "React" car il est défini en premier
        (0, globals_1.expect)(result.groups).toHaveLength(1);
        (0, globals_1.expect)(result.groups[0].name).toBe("React");
        (0, globals_1.expect)(result.groups[0].imports).toHaveLength(3);
    });
    (0, globals_1.it)("devrait respecter la priorité même avec des ordres différents", () => {
        const config = {
            importGroups: [
                {
                    name: "LowPriority",
                    regex: /^react/,
                    order: 1,
                    priority: 1
                },
                {
                    name: "HighPriority",
                    regex: /^react|^@react/,
                    order: 2,
                    priority: 3
                },
                {
                    name: "MediumPriority",
                    regex: /^react/,
                    order: 3,
                    priority: 2
                }
            ]
        };
        const parser = new parser_1.ImportParser(config);
        const result = parser.parse(`
            import React from 'react';
            import { useState } from 'react';
            import { Route } from 'react-router-dom';
        `);
        // Les imports devraient être dans "HighPriority" malgré son ordre plus élevé
        (0, globals_1.expect)(result.groups).toHaveLength(1);
        (0, globals_1.expect)(result.groups[0].name).toBe("HighPriority");
        (0, globals_1.expect)(result.groups[0].imports).toHaveLength(3);
    });
});
