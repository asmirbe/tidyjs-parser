import { describe, expect, it } from "@jest/globals";
import { ImportParser } from "../../parser";
import { ParserConfig } from "../../types";

describe('Import Parser JSON Config Test', () => {
    it('should correctly parse imports with JSON string regex pattern', () => {
        // This simulates how the config would be received from VSCode extension settings
        // Where the regex pattern is a regular string in JSON
        const configFromVSCode = {
            importGroups: [
                {
                    name: "Miscellaneous",
                    isDefault: true,
                    order: 0
                },
                {
                    name: "React",
                    order: 1,
                    priority: 1,
                    // In VSCode settings.json, this would be written as "\breact\b"
                    regex: "\\breact\\b"
                },
                {
                    name: "DS",
                    order: 3,
                    regex: "ds"
                }
            ]
        };

        // Convert to JSON string like it would be in VSCode settings
        // Log the regex pattern at each step to debug the issue
        console.log('Original regex:', configFromVSCode.importGroups[1].regex);

        const configJson = JSON.stringify(configFromVSCode);
        console.log('After stringify:', configJson);

        // Parse back to simulate how extension would receive it
        const config: ParserConfig = JSON.parse(configJson);
        console.log('After parse:', config.importGroups[1].regex);

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
        console.log('React imports:', reactGroup?.imports.map(imp => imp.raw));
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
});
