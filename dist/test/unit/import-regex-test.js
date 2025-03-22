"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const parser_1 = require("../../parser");
(0, globals_1.describe)('Import Parser JSON Config Test', () => {
    (0, globals_1.it)('should correctly parse imports with JSON string regex pattern', () => {
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
        const config = JSON.parse(configJson);
        console.log('After parse:', config.importGroups[1].regex);
        const parser = new parser_1.ImportParser(config);
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
        (0, globals_1.expect)(reactGroup).toBeDefined();
        console.log('React imports:', reactGroup?.imports.map(imp => imp.raw));
        (0, globals_1.expect)(reactGroup?.imports.length).toBe(4);
        const reactImports = reactGroup?.imports.map(imp => imp.raw);
        (0, globals_1.expect)(reactImports).toContain("import React from 'React';");
        (0, globals_1.expect)(reactImports).toContain("import { useState } from 'react';");
        (0, globals_1.expect)(reactImports).toContain("import type { Test } from 'ReacT';");
        (0, globals_1.expect)(reactImports).toContain("import type Test from 'react';");
        // Check that DS imports are in DS group
        const dsGroup = result.groups.find(g => g.name === "DS");
        (0, globals_1.expect)(dsGroup).toBeDefined();
        (0, globals_1.expect)(dsGroup?.imports.length).toBe(1);
        (0, globals_1.expect)(dsGroup?.imports[0].raw).toBe("import { YpButton } from 'ds';");
        // Check that other imports are in Miscellaneous group
        const miscGroup = result.groups.find(g => g.name === "Miscellaneous");
        (0, globals_1.expect)(miscGroup).toBeDefined();
        (0, globals_1.expect)(miscGroup?.imports.length).toBe(2); // style.css and antd
        const miscImports = miscGroup?.imports.map(imp => imp.raw);
        (0, globals_1.expect)(miscImports).toContain("import 'style.css';");
        (0, globals_1.expect)(miscImports).toContain("import { Button } from 'antd';");
    });
});
