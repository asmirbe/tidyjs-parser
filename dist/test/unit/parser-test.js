"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const parser_1 = require("../../parser");
(0, globals_1.describe)("ImportParser - Priorité des groupes", () => {
    (0, globals_1.it)("devrait choisir le groupe avec la priorité la plus élevée quand plusieurs groupes correspondent", () => {
        const config = {
            importGroups: [
                {
                    name: "Others",
                    order: 0,
                    isDefault: true
                },
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
            import Data from '@user/data';
            import { Route } from 'react-router-dom';
        `);
        (0, globals_1.expect)(result.groups).toHaveLength(2);
        const reactGroup = result.groups.find(g => g.name === "React");
        const othersGroup = result.groups.find(g => g.name === "Others");
        (0, globals_1.expect)(reactGroup).toBeDefined();
        (0, globals_1.expect)(reactGroup.imports.map(i => i.source)).toEqual(['react', 'react', 'react-router-dom']);
        (0, globals_1.expect)(othersGroup).toBeDefined();
        (0, globals_1.expect)(othersGroup.imports.map(i => i.source)).toEqual(['@user/data']);
    });
    (0, globals_1.it)("devrait utiliser la spécificité des regex quand les priorités sont égales", () => {
        const config = {
            importGroups: [
                {
                    name: "Others",
                    order: 0,
                    isDefault: true
                },
                {
                    name: "React Router",
                    regex: /^react-router/,
                    order: 1,
                    priority: 2
                },
                {
                    name: "React",
                    regex: /^react/,
                    order: 1,
                    priority: 2
                }
            ]
        };
        const parser = new parser_1.ImportParser(config);
        const result = parser.parse(`
            import React from 'react';
            import { Route } from 'react-router-dom';
            import Data from '@user/data';
        `);
        (0, globals_1.expect)(result.groups).toHaveLength(3);
        const routerGroup = result.groups.find(g => g.name === "React Router");
        const reactGroup = result.groups.find(g => g.name === "React");
        const othersGroup = result.groups.find(g => g.name === "Others");
        (0, globals_1.expect)(routerGroup).toBeDefined();
        (0, globals_1.expect)(routerGroup.imports.map(i => i.source)).toEqual(['react-router-dom']);
        (0, globals_1.expect)(reactGroup).toBeDefined();
        (0, globals_1.expect)(reactGroup.imports.map(i => i.source)).toEqual(['react']);
        (0, globals_1.expect)(othersGroup).toBeDefined();
        (0, globals_1.expect)(othersGroup.imports.map(i => i.source)).toEqual(['@user/data']);
    });
    (0, globals_1.it)("devrait utiliser l'ordre quand les priorités ne sont pas définies", () => {
        const config = {
            importGroups: [
                {
                    name: "Others",
                    order: 0,
                    isDefault: true
                },
                {
                    name: "First",
                    regex: /^react|^@react/,
                    order: 1
                },
                {
                    name: "Second",
                    regex: /^react-router/,
                    order: 2
                }
            ]
        };
        const parser = new parser_1.ImportParser(config);
        const result = parser.parse(`
            import React from 'react';
            import { useState } from 'react';
            import Data from '@user/data';
            import { Route } from 'react-router-dom';
        `);
        (0, globals_1.expect)(result.groups).toHaveLength(3);
        const firstGroup = result.groups.find(g => g.name === "First");
        const secondGroup = result.groups.find(g => g.name === "Second");
        const othersGroup = result.groups.find(g => g.name === "Others");
        (0, globals_1.expect)(firstGroup).toBeDefined();
        (0, globals_1.expect)(firstGroup.imports.map(i => i.source)).toEqual(['react', 'react']);
        (0, globals_1.expect)(secondGroup).toBeDefined();
        (0, globals_1.expect)(secondGroup.imports.map(i => i.source)).toEqual(['react-router-dom']);
        (0, globals_1.expect)(othersGroup).toBeDefined();
        (0, globals_1.expect)(othersGroup.imports.map(i => i.source)).toEqual(['@user/data']);
    });
    (0, globals_1.it)("devrait gérer correctement un groupe par défaut sans regex", () => {
        const config = {
            importGroups: [
                {
                    name: "Default",
                    order: 0,
                    isDefault: true
                },
                {
                    name: "React",
                    regex: /^react/,
                    order: 1
                }
            ]
        };
        const parser = new parser_1.ImportParser(config);
        const result = parser.parse(`
            import React from 'react';
            import Data from '@user/data';
            import Something from 'somewhere';
        `);
        (0, globals_1.expect)(result.groups).toHaveLength(2);
        const reactGroup = result.groups.find(g => g.name === "React");
        const defaultGroup = result.groups.find(g => g.name === "Default");
        (0, globals_1.expect)(reactGroup).toBeDefined();
        (0, globals_1.expect)(reactGroup.imports.map(i => i.source)).toEqual(['react']);
        (0, globals_1.expect)(defaultGroup).toBeDefined();
        (0, globals_1.expect)(defaultGroup.imports.map(i => i.source)).toEqual(['@user/data', 'somewhere']);
    });
});
