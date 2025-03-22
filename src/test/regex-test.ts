import { ImportParser } from "../parser";
import { ParserConfig } from "../types";

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
            regex: "\\breact\\b" // Will be automatically converted to case-insensitive RegExp
        },
        {
            name: "DS",
            order: 3,
            regex: "ds" // Will be automatically converted to case-insensitive RegExp
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

// Display parsed groups
console.log("Parsed Import Groups:");
result.groups.forEach(group => {
    console.log(`\nGroup: ${group.name}`);
    group.imports.forEach(imp => {
        console.log(`  ${imp.raw}`);
    });
});
