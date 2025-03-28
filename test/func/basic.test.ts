import { describe, it, expect } from '@jest/globals';
import { parseImports, ParserConfig, DEFAULT_CONFIG } from "../../src/index";

export const config: ParserConfig = {
    importGroups: [
        { name: "Misc", regex: /^(fs|path|uuid|lodash|react)$/, order: 0, isDefault: true },
        { name: "Components", regex: /^@components/, order: 1 },
        { name: "Utils", regex: /^@utils/, order: 2 },
    ],
    patterns: {
        ...DEFAULT_CONFIG.patterns,
        subfolderPattern: /@app\/([^/]+)/,
    },
};

describe('Import Parser - General Cases', () => {
    it('should handle imports with comments correctly', () => {
        const code = `
            // React Import
            import { useState } from 'react'; // State hook
            /* Component import */
            import { Button } from '@components/Button';
        `;

        const result = parseImports(code, config);

        const miscGroup = result.groups.find(g => g.name === 'Misc');
        const componentsGroup = result.groups.find(g => g.name === 'Components');

        expect(miscGroup).toBeDefined();
        expect(componentsGroup).toBeDefined();
        expect(miscGroup?.imports[0].specifiers).toContain('useState');
        expect(componentsGroup?.imports[0].specifiers).toContain('Button');
        expect(result.groups.length).toBe(2);
    });

    it('should group imports correctly according to configuration', () => {
        const code = `
            import fs from 'fs';
            import path from 'path';
            import { useEffect } from 'react';
            import { Header } from '@components/Header';
            import { Footer } from '@components/Footer';
        `;

        const result = parseImports(code, config);
        const groups = result.groups;

        expect(groups).toHaveLength(2);
        expect(groups[0].name).toBe('Misc');
        expect(groups[1].name).toBe('Components');

        expect(groups[0].imports.map(i => i.source)).toEqual(['fs', 'path', 'react']);
        expect(groups[1].imports.map(i => i.source)).toEqual(['@components/Header', '@components/Footer'].sort());
    });

    describe('Group Priority', () => {
        it('should prioritize imports according to their regex pattern order', () => {
            const code = `
                import { useState } from 'react';
                import { Button } from '@components/Button';
                import { formatDate } from '@utils/date';
            `;

            const result = parseImports(code, config);
            const groups = result.groups;

            expect(groups).toHaveLength(3);
            expect(groups[0].name).toBe('Misc');
            expect(groups[1].name).toBe('Components');
            expect(groups[2].name).toBe('Utils');
        });

        it('should handle imports with comments correctly', () => {
            const code = `
                // React Import
                import { useState } from 'react'; // State hook
                /* Component import */
                import { Button } from '@components/Button';
            `;

            const result = parseImports(code, config);
            expect(result.groups.length).toBeGreaterThan(0);
            expect(result.invalidImports?.length).toBe(0);
        });
    });

    describe('Alias Imports', () => {
        it('should handle imports with aliases', () => {
            const code = `
                import { Button as CustomButton } from '@components/Button';
                import { useState as useLocalState } from 'react';
            `;

            const result = parseImports(code, config);
            const componentsGroup = result.groups.find(g => g.name === 'Components');
            const miscGroup = result.groups.find(g => g.name === 'Misc');

            expect(componentsGroup).toBeDefined();
            expect(miscGroup).toBeDefined();
            expect(componentsGroup?.imports[0].specifiers).toContain('Button as CustomButton');
            expect(miscGroup?.imports[0].specifiers).toContain('useState as useLocalState');
        });
    });

    describe('Multi-line Imports', () => {
        it('should parse multi-line imports correctly', () => {
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
        it('should handle default and named imports', () => {
            const code = `
                import React, { useState } from 'react';
                import Button, { ButtonProps } from '@components/Button';
            `;

            const result = parseImports(code, config);

            const miscGroup = result.groups.find(g => g.name === 'Misc');
            const componentsGroup = result.groups.find(g => g.name === 'Components');

            // Check that default and named imports are now separated
            const reactDefaultImport = miscGroup?.imports.find(imp =>
                imp.type === 'default' && imp.source === 'react');
            const reactNamedImport = miscGroup?.imports.find(imp =>
                imp.type === 'named' && imp.source === 'react');

            const buttonDefaultImport = componentsGroup?.imports.find(imp =>
                imp.type === 'default' && imp.source === '@components/Button');
            const buttonNamedImport = componentsGroup?.imports.find(imp =>
                imp.type === 'named' && imp.source === '@components/Button');

            // Check presence of default imports
            expect(reactDefaultImport).toBeDefined();
            expect(reactDefaultImport?.specifiers).toContain('React');
            expect(buttonDefaultImport).toBeDefined();
            expect(buttonDefaultImport?.specifiers).toContain('Button');

            // Check presence of named imports
            expect(reactNamedImport).toBeDefined();
            expect(reactNamedImport?.specifiers).toContain('useState');
            expect(buttonNamedImport).toBeDefined();
            expect(buttonNamedImport?.specifiers).toContain('ButtonProps');
        });
    });

    describe('Namespace Imports', () => {
        it('should handle namespace imports', () => {
            const code = `import * as ReactDom from 'react';`;
            const result = parseImports(code, config);
            const miscGroup = result.groups.find(g => g.name === 'Misc');

            // Check that namespace import is correctly grouped
            expect(miscGroup).toBeDefined();
            expect(miscGroup?.imports).toHaveLength(1);
            // Type is 'default' because a namespace import is treated as a default import
            expect(miscGroup?.imports[0].type).toBe('default');
            expect(miscGroup?.imports[0].specifiers).toEqual(['ReactDom']);
        });
    });

    describe('Import Sorting', () => {
        it('should sort imports according to group order', () => {
            const code = `
                import { formatDate } from '@utils/date';
                import { useState } from 'react';
                import { Button } from '@components/Button';
            `;

            const result = parseImports(code, config);
            const groups = result.groups;

            expect(groups[0].name).toBe('Misc');
            expect(groups[1].name).toBe('Components');
            expect(groups[2].name).toBe('Utils');
        });

        it('should sort imports alphabetically within each group', () => {
            const code = `
                import { useEffect, useState, useCallback } from 'react';
                import { Card, Button, Alert } from '@components/ui';
            `;

            const result = parseImports(code, config);

            const miscGroup = result.groups.find(g => g.name === 'Misc');
            const componentsGroup = result.groups.find(g => g.name === 'Components');

            expect(miscGroup?.imports[0].specifiers).toEqual(['useCallback', 'useEffect', 'useState']);
            expect(componentsGroup?.imports[0].specifiers).toEqual(['Alert', 'Button', 'Card']);
        });
    });

    describe('Edge Cases', () => {
        it('should handle imports without specifiers', () => {
            const code = `import 'styles/global.css';`;
            const result = parseImports(code, config);

            expect(result.groups.length).toBeGreaterThan(0);
            expect(result.invalidImports?.length).toBe(0);
            expect(result.groups[0].imports[0].type).toBe('sideEffect');
            expect(result.groups[0].imports[0].specifiers).toEqual([]);
        });

        it('should handle imports with dynamic expressions', () => {
            const code = `
                import { useState } from 'react';
                const moduleName = 'utils';
                const dynamicImport = import(\`@\${moduleName}/helpers\`);
            `;

            const result = parseImports(code, config);
            expect(result.groups.length).toBeGreaterThan(0);
            expect(result.groups[0].name).toBe('Misc');
        });

        it('should handle consecutive imports with different types', () => {
            const code = `
                import Button from '@components/Button';
                import { Card } from '@components/Card';
                import * as Utils from '@utils/helpers';
                import 'styles/global.css';
            `;

            const result = parseImports(code, config);
            expect(result.groups.length).toBe(3);
            expect(result.groups.find(g => g.name === 'Components')?.imports.length).toBe(2);
        });
    });
});
