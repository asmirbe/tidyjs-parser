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

describe('Import Parser - General Cases', () => {
    describe('Group Priorité', () => {
        it('devrait prioriser les imports selon leur ordre dans le pattern regex', () => {
            const code = `
                import { useState } from 'react';
                import { Button } from '@components/Button';
                import { formatDate } from '@utils/date';
            `;

            const result = parseImports(code, config);
            const groups = result.groups;

            expect(groups).toHaveLength(3);
            expect(groups[0].name).toBe('Misc');
            expect(groups[1].name).toBe('Composants');
            expect(groups[2].name).toBe('Utils');
        });

        it('devrait gérer correctement les imports avec commentaires', () => {
            const code = `
                // Import React
                import { useState } from 'react'; // Hook d'état
                /* Import de composant */
                import { Button } from '@components/Button';
            `;

            const result = parseImports(code, config);
            expect(result.groups.length).toBeGreaterThan(0);
            expect(result.invalidImports?.length).toBe(0);
        });
    });

    describe('Alias Imports', () => {
        it('devrait gérer les imports avec alias', () => {
            const code = `
                import { Button as CustomButton } from '@components/Button';
                import { useState as useLocalState } from 'react';
            `;

            const result = parseImports(code, config);
            const componentsGroup = result.groups.find(g => g.name === 'Composants');
            const miscGroup = result.groups.find(g => g.name === 'Misc');

            expect(componentsGroup).toBeDefined();
            expect(miscGroup).toBeDefined();
            expect(componentsGroup?.imports[0].specifiers).toContain('Button as CustomButton');
            expect(miscGroup?.imports[0].specifiers).toContain('useState as useLocalState');
        });
    });

    describe('Multi-line Imports', () => {
        it('devrait parser correctement les imports multi-lignes', () => {
            const code = `
                import {
                    useState,
                    useEffect,
                    useCallback
                } from 'react';
            `;

            const result = parseImports(code, config);
            const miscGroup = result.groups.find(g => g.name === 'Misc');

            expect(miscGroup).toBeDefined();
            expect(miscGroup?.imports[0].specifiers).toEqual(
                expect.arrayContaining(['useState', 'useEffect', 'useCallback'])
            );
        });
    });

    describe('Default and Named Imports', () => {
        it('devrait gérer les imports par défaut et nommés', () => {
            const code = `
                import React, { useState } from 'react';
                import Button, { ButtonProps } from '@components/Button';
            `;

            const result = parseImports(code, config);

            const miscGroup = result.groups.find(g => g.name === 'Misc');
            const componentsGroup = result.groups.find(g => g.name === 'Composants');

            // Vérifier la présence des imports par défaut et nommés
            expect(miscGroup?.imports[0].specifiers).toContain('React');
            expect(miscGroup?.imports[0].specifiers).toContain('useState');
            expect(componentsGroup?.imports[0].specifiers).toContain('Button');
            expect(componentsGroup?.imports[0].specifiers).toContain('ButtonProps');
        });
    });

    describe('Namespace Imports', () => {
        it('devrait gérer les imports namespace', () => {
            const code = `import * as ReactDom from 'react';`;
            const result = parseImports(code, config);
            const miscGroup = result.groups.find(g => g.name === 'Misc');

            // Vérifier que l'import namespace est correctement regroupé
            expect(miscGroup).toBeDefined();
            expect(miscGroup?.imports).toHaveLength(1);
            // Type est 'default' car un import namespace est traité comme un import par défaut
            expect(miscGroup?.imports[0].type).toBe('default');
            expect(miscGroup?.imports[0].specifiers).toEqual(['ReactDom']);
        });
    });

    describe('Import Sorting', () => {
        it('devrait trier les imports selon leur ordre de groupe', () => {
            const code = `
                import { formatDate } from '@utils/date';
                import { useState } from 'react';
                import { Button } from '@components/Button';
            `;

            const result = parseImports(code, config);
            const groups = result.groups;

            expect(groups[0].name).toBe('Misc');
            expect(groups[1].name).toBe('Composants');
            expect(groups[2].name).toBe('Utils');
        });

        it('devrait trier les imports alphabétiquement dans chaque groupe', () => {
            const code = `
                import { useEffect, useState, useCallback } from 'react';
                import { Card, Button, Alert } from '@components/ui';
            `;

            const result = parseImports(code, config);

            const miscGroup = result.groups.find(g => g.name === 'Misc');
            const componentsGroup = result.groups.find(g => g.name === 'Composants');

            expect(miscGroup?.imports[0].specifiers).toEqual(['useCallback', 'useEffect', 'useState']);
            expect(componentsGroup?.imports[0].specifiers).toEqual(['Alert', 'Button', 'Card']);
        });
    });
});
