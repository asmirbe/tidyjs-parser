import { describe, expect, it } from "@jest/globals";
import { ImportParser } from "../../src/parser";
import { ParserConfig } from "../../src/types";

describe('Import Parser RegExp Test', () => {
    it('should correctly parse imports with RegExp pattern', () => {
        const config: ParserConfig = {
            importGroups: [
                {
                    name: "Miscellaneous",
                    isDefault: true,
                    order: 0,
                },
                {
                    name: "React",
                    order: 1,
                    priority: 1,
                    regex: new RegExp(/\breact\b/i)
                },
                {
                    name: "DS",
                    order: 3,
                    regex: /ds/i
                }
            ]
        };

        const parser = new ImportParser(config);
        const result = parser.parse(`
import type { Test } from 'ReacT';
import { useState }  from 'react';
import type Test from 'react';
import { YpButton }  from 'ds';
import React  from 'React';
import 'style.css';
import { Button }  from 'antd';
`);

        // Check that React-related imports are in React group
        const reactGroup = result.groups.find(g => g.name === "React");
        expect(reactGroup).toBeDefined();
        expect(reactGroup?.imports.length).toBe(4);
        const reactImports = reactGroup?.imports.map(imp => imp.raw);
        expect(reactImports).toContain("import React from 'React';");
        expect(reactImports).toContain("import { useState } from 'react';");
        expect(reactImports).toContain("import type { Test } from 'ReacT';");
        expect(reactImports).toContain("import type Test from 'react';");

        // Check that DS imports are in DS group
        const dsGroup = result.groups.find(g => g.name === "DS");
        expect(dsGroup).toBeDefined();
        expect(dsGroup?.imports.length).toBe(1);
        expect(dsGroup?.imports[0].raw).toBe("import { YpButton } from 'ds';");

        // Check that other imports are in Miscellaneous group
        const miscGroup = result.groups.find(g => g.name === "Miscellaneous");
        expect(miscGroup).toBeDefined();
        expect(miscGroup?.imports.length).toBe(2); // style.css and antd
        const miscImports = miscGroup?.imports.map(imp => imp.raw);
        expect(miscImports).toContain("import 'style.css';");
        expect(miscImports).toContain("import { Button } from 'antd';");
    });

    it('should correctly parse multi-line imports', () => {
        const config: ParserConfig = {
            importGroups: [
                {
                    name: "Miscellaneous",
                    isDefault: true,
                    order: 0,
                }
            ]
        };

        const parser = new ImportParser(config);
        const result = parser.parse(`
import { test } from 
'../path/to/module';

import { another } from 
    '../another/path';
`);
        const miscGroup = result.groups.find(g => g.name === "Miscellaneous");
        expect(miscGroup).toBeDefined();
        expect(miscGroup?.imports.length).toBe(2);

        const imports = miscGroup?.imports.map(imp => imp.raw);
        expect(imports).toContain("import { test } from '../path/to/module';");
        expect(imports).toContain("import { another } from '../another/path';");
    });
});
