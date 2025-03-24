import { describe, it, expect } from '@jest/globals';
import { parseImports, ParserConfig, DEFAULT_CONFIG } from "../../src/index";

const config: ParserConfig = {
    importGroups: [
        { name: "Misc", regex: /^(react|lodash|uuid)$/, order: 0, isDefault: true },
        { name: "Composants", regex: /^@components/, order: 1 },
        { name: "Utils", regex: /^@utils/, order: 2 },
    ],
    patterns: {
        ...DEFAULT_CONFIG.patterns,
        subfolderPattern: /@app\/([^/]+)/,
    },
};

describe('Import Parser - Error Cases', () => {
    describe('Invalid Syntax Cases', () => {
        const errorCases = [
            {
                name: "Import avec syntaxe incorrecte - 'as' sans alias",
                code: "import React as from 'react';",
                description: "Un import avec le mot-clé 'as' mais sans alias spécifié devrait échouer",
            },
            {
                name: "Import avec alias malformé - hors accolades",
                code: "import Component as C, { useState } from 'react';",
                description: "Un import par défaut avec alias suivi d'un import nommé est une syntaxe invalide",
            },
            {
                name: "Import avec source manquante",
                code: "import { useState };",
                description: "Un import sans source (sans 'from') devrait échouer",
            },
            {
                name: "Import avec accolades non fermées",
                code: "import { useState, useEffect from 'react';",
                description: "Un import avec des accolades non fermées devrait échouer",
            },
            {
                name: "Import avec namespace et import nommé (syntaxe invalide)",
                code: "import * as React, { useState } from 'react';",
                description: "Un import d'espace de noms suivi d'un import nommé est une syntaxe invalide",
            },
            {
                name: "Import avec guillemets non fermés",
                code: "import { useState } from 'react;",
                description: "Un import avec des guillemets non fermés devrait échouer",
            }
        ];

        errorCases.forEach(testCase => {
            it(`devrait détecter : ${testCase.name}`, () => {
                const result = parseImports(testCase.code, config);
                expect(result.invalidImports).toBeDefined();
                expect(result.invalidImports?.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Valid Edge Cases', () => {
        const validCases = [
            {
                name: "Import avec point-virgule manquant",
                code: "import { useState } from 'react'",
                description: "Un import sans point-virgule devrait être corrigé automatiquement",
            },
            {
                name: "Import vide",
                code: "import {} from 'react';",
                description: "Un import avec des accolades vides est syntaxiquement valide même s'il est inutile",
            },
            {
                name: "Import avec caractères spéciaux valides",
                code: "import { useState, use$Effect, _privateHook } from 'react';",
                description: "Un import avec des caractères spéciaux valides ($, _) devrait réussir",
            }
        ];

        validCases.forEach(testCase => {
            it(`devrait accepter : ${testCase.name}`, () => {
                const result = parseImports(testCase.code, config);
                expect(result.invalidImports).toBeDefined();
                expect(result.invalidImports?.length).toBe(0);
            });
        });
    });

    describe('Duplicate Handling', () => {
        it('devrait gérer correctement les imports en double', () => {
            const code = "import { useState, useState } from 'react';";
            const result = parseImports(code, config);
            const miscGroup = result.groups.find(g => g.name === 'Misc');
            expect(miscGroup).toBeDefined();
            expect(miscGroup?.imports[0].specifiers).toEqual(['useState']);
        });
    });

    describe('Type Imports', () => {
        it('devrait gérer correctement les imports de type', () => {
            const code = `
        import type { FC, ComponentType } from 'react';
        import { useState, type ChangeEvent } from 'react';
      `;

            const result = parseImports(code, config);
            expect(result.invalidImports).toBeDefined();
            expect(result.invalidImports?.length).toBe(0);

            const reactImports = result.groups.find(g => g.imports.some(i => i.source === 'react'));
            expect(reactImports).toBeDefined();
            expect(reactImports?.imports.some(i => i.raw.includes('type'))).toBeTruthy();
        });
    });
});
