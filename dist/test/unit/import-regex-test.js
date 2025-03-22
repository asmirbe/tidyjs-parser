"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const parser_1 = require("../../parser");
(0, globals_1.describe)('Import Parser RegExp Test', () => {
    (0, globals_1.it)('should correctly parse imports with RegExp pattern', () => {
        const config = {
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
                    regex: /\breact\b/i
                },
                {
                    name: "DS",
                    order: 3,
                    regex: /ds/i
                }
            ]
        };
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
