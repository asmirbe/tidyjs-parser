import { describe, it, expect } from '@jest/globals';
import { ImportParser } from "../../src/parser";
import { ParserConfig } from "../../src/types";

describe("ImportParser - Priorité des groupes", () => {
    it("devrait choisir le groupe avec la priorité la plus élevée quand plusieurs groupes correspondent", () => {
        const config: ParserConfig = {
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

        const parser = new ImportParser(config);
        const result = parser.parse(`
            import React from 'react';
            import { useState } from 'react';
            import Data from '@user/data';
            import { Route } from 'react-router-dom';
        `);

        expect(result.groups).toHaveLength(2);
        const reactGroup = result.groups.find(g => g.name === "React");
        const othersGroup = result.groups.find(g => g.name === "Others");

        expect(reactGroup).toBeDefined();
        expect(reactGroup!.imports.map(i => i.source)).toEqual(['react', 'react', 'react-router-dom']);

        expect(othersGroup).toBeDefined();
        expect(othersGroup!.imports.map(i => i.source)).toEqual(['@user/data']);
    });

    it("devrait utiliser la spécificité des regex quand les priorités sont égales", () => {
        const config: ParserConfig = {
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

        const parser = new ImportParser(config);
        const result = parser.parse(`
            import React from 'react';
            import { Route } from 'react-router-dom';
            import Data from '@user/data';
        `);

        expect(result.groups).toHaveLength(3);
        const routerGroup = result.groups.find(g => g.name === "React Router");
        const reactGroup = result.groups.find(g => g.name === "React");
        const othersGroup = result.groups.find(g => g.name === "Others");

        expect(routerGroup).toBeDefined();
        expect(routerGroup!.imports.map(i => i.source)).toEqual(['react-router-dom']);

        expect(reactGroup).toBeDefined();
        expect(reactGroup!.imports.map(i => i.source)).toEqual(['react']);

        expect(othersGroup).toBeDefined();
        expect(othersGroup!.imports.map(i => i.source)).toEqual(['@user/data']);
    });

    it("devrait utiliser l'ordre quand les priorités ne sont pas définies", () => {
        const config: ParserConfig = {
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

        const parser = new ImportParser(config);
        const result = parser.parse(`
            import React from 'react';
            import { useState } from 'react';
            import Data from '@user/data';
            import { Route } from 'react-router-dom';
        `);

        expect(result.groups).toHaveLength(3);
        const firstGroup = result.groups.find(g => g.name === "First");
        const secondGroup = result.groups.find(g => g.name === "Second");
        const othersGroup = result.groups.find(g => g.name === "Others");

        expect(firstGroup).toBeDefined();
        expect(firstGroup!.imports.map(i => i.source)).toEqual(['react', 'react']);

        expect(secondGroup).toBeDefined();
        expect(secondGroup!.imports.map(i => i.source)).toEqual(['react-router-dom']);

        expect(othersGroup).toBeDefined();
        expect(othersGroup!.imports.map(i => i.source)).toEqual(['@user/data']);
    });

    it("devrait gérer correctement un groupe par défaut sans regex", () => {
        const config: ParserConfig = {
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

        const parser = new ImportParser(config);
        const result = parser.parse(`
            import React from 'react';
            import Data from '@user/data';
            import Something from 'somewhere';
        `);

        expect(result.groups).toHaveLength(2);
        const reactGroup = result.groups.find(g => g.name === "React");
        const defaultGroup = result.groups.find(g => g.name === "Default");

        expect(reactGroup).toBeDefined();
        expect(reactGroup!.imports.map(i => i.source)).toEqual(['react']);

        expect(defaultGroup).toBeDefined();
        expect(defaultGroup!.imports.map(i => i.source)).toEqual(['@user/data', 'somewhere']);
    });
});
