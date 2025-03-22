import { describe, it, expect } from '@jest/globals';
import { ImportParser } from "../../parser";
import { ParserConfig } from "../../types";

describe("ImportParser - Priorité des groupes", () => {
    it("devrait choisir le groupe avec la priorité la plus élevée quand plusieurs groupes correspondent", () => {
        const config: ParserConfig = {
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

        const parser = new ImportParser(config);
        const result = parser.parse(`
            import React from 'react';
            import { useState } from 'react';
            import { Route } from 'react-router-dom';
        `);

        // Tous les imports devraient être dans le groupe "React" car il a la priorité la plus élevée
        expect(result.groups).toHaveLength(1);
        expect(result.groups[0].name).toBe("React");
        expect(result.groups[0].imports).toHaveLength(3);
    });

    it("devrait utiliser l'ordre de définition quand les priorités ne sont pas définies", () => {
        const config: ParserConfig = {
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

        const parser = new ImportParser(config);
        const result = parser.parse(`
            import React from 'react';
            import { useState } from 'react';
            import { Route } from 'react-router-dom';
        `);

        // Les imports devraient être dans le groupe "React" car il est défini en premier
        expect(result.groups).toHaveLength(1);
        expect(result.groups[0].name).toBe("React");
        expect(result.groups[0].imports).toHaveLength(3);
    });

    it("devrait respecter la priorité même avec des ordres différents", () => {
        const config: ParserConfig = {
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

        const parser = new ImportParser(config);
        const result = parser.parse(`
            import React from 'react';
            import { useState } from 'react';
            import { Route } from 'react-router-dom';
        `);

        // Les imports devraient être dans "HighPriority" malgré son ordre plus élevé
        expect(result.groups).toHaveLength(1);
        expect(result.groups[0].name).toBe("HighPriority");
        expect(result.groups[0].imports).toHaveLength(3);
    });
});
