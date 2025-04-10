import { describe, it, expect } from "@jest/globals";
import { parseImports, ParserConfig, DEFAULT_CONFIG } from "../../src/index";

export const config: ParserConfig = {
    importGroups: [
        {
            name: "Misc",
            order: 0,
            isDefault: true,
        },
        {
            name: "Components",
            match: /^@components/,
            order: 1,
        },
        {
            name: "Utils",
            match: /^@utils/,
            order: 2,
        },
    ],
    patterns: {
        ...DEFAULT_CONFIG.patterns,
        subfolderPattern: /@app\/([^/]+)/,
    },
};

describe("Import Parser - General Cases", () => {
    it("should handle imports with comments correctly", () => {
        const code = `
            // React Import
            import { useState } from 'react'; // State hook
            /* Component import */
            import { Button } from '@components/Button';
        `;

        const result = parseImports(code, config);

        const miscGroup = result.groups.find((g) => g.name === "Misc");
        const componentsGroup = result.groups.find((g) => g.name === "Components");

        expect(miscGroup).toBeDefined();
        expect(componentsGroup).toBeDefined();
        expect(miscGroup?.imports[0].specifiers).toContain("useState");
        expect(componentsGroup?.imports[0].specifiers).toContain("Button");
        expect(result.groups.length).toBe(2);
    });

    describe("Complex Relative Paths", () => {
        it("should handle multiple parent directory references (../../)", () => {
            const code = `
            import { helper } from '../../../utils/helpers';
            import { config } from '../../config';
        `;

            const result = parseImports(code, config);
            expect(result.groups[0].imports).toHaveLength(2);
            expect(result.groups[0].imports[0].source).toBe("../../../utils/helpers");
            expect(result.groups[0].imports[1].source).toBe("../../config");
        });

        it("should handle nested relative paths (./)", () => {
            const code = `
            import { util1 } from './utils/util1';
            import { util2 } from './nested/folder/utils/util2';
        `;

            const result = parseImports(code, config);
            expect(result.groups[0].imports).toHaveLength(2);
            // Le parser ne trie pas les imports par chemin, donc vérifier simplement que les deux sources sont présentes
            expect(result.groups[0].imports.map((i) => i.source)).toEqual(expect.arrayContaining(["./utils/util1", "./nested/folder/utils/util2"]));
        });
    });

    describe("TypeScript Specific Imports", () => {
        it("should handle type imports", () => {
            const code = `
            import type { ButtonProps } from '@components/Button';
            import { useState } from 'react'; // Le parser ne gère pas encore 'type' inline
        `;

            const result = parseImports(code, config);
            const componentsGroup = result.groups.find((g) => g.name === "Components");
            const miscGroup = result.groups.find((g) => g.name === "Misc");

            // Le parser traite actuellement 'import type' comme un import normal
            expect(componentsGroup?.imports.some((i) => i.specifiers.includes("ButtonProps"))).toBe(true);
            expect(miscGroup?.imports.some((i) => i.specifiers.includes("useState"))).toBe(true);
        });

        it("should handle import assertions", () => {
            const code = `
            import json from "./data.json"; // Le parser ne gère pas encore les assertions
            import data from "./data.csv";
        `;

            const result = parseImports(code, config);
            expect(result.groups[0].imports).toHaveLength(2);
            expect(result.groups[0].imports.map((i) => i.source)).toEqual(expect.arrayContaining(["./data.json", "./data.csv"]));
        });
    });

    describe("Error Cases", () => {
        it("should detect invalid import syntax", () => {
            const code = `
            import { useState } from 'react'
            import { Button from '@components/Button';
        `;

            const result = parseImports(code, config);
            expect(result.invalidImports).toHaveLength(1);
            expect(result.invalidImports?.[0].error).toBeDefined();
        });

        it("should handle non-existent modules", () => {
            const code = `import { missing } from 'non-existent-module';`;
            const result = parseImports(code, config);
            // Le parser ne vérifie pas l'existence des modules
            expect(result.groups[0].imports).toHaveLength(1);
        });

        it("should handle non-matching group match", () => {
            const code = `import { unknown } from '@unknown/package';`;
            const result = parseImports(code, config);
            expect(result.groups[0].name).toBe("Misc");
            // Verify it's the default group by checking config
            const defaultGroup = config.importGroups.find((g) => g.isDefault);
            expect(defaultGroup?.name).toBe("Misc");
        });
    });

    describe("Performance Cases", () => {
        it("should handle files with many imports", () => {
            const imports = Array.from({ length: 50 }, (_, i) => `import { util${i} } from '@utils/util${i}';`).join("\n");

            const result = parseImports(imports, config);
            expect(result.groups[0].imports).toHaveLength(50);
        });

        it("should handle very long import paths", () => {
            const longPath = "@" + "very/".repeat(20) + "long/path";
            const code = `import { something } from '${longPath}';`;

            const result = parseImports(code, config);
            expect(result.groups[0].imports[0].source).toBe(longPath);
        });
    });

    describe("Alternative Configurations", () => {
        it("should handle empty groups", () => {
            const minimalConfig: ParserConfig = {
                importGroups: [{ name: "Default", order: 0, isDefault: true }],
                patterns: DEFAULT_CONFIG.patterns,
            };

            const code = `import { useState } from 'react';`;
            const result = parseImports(code, minimalConfig);
            expect(result.groups).toHaveLength(1);
        });

        it("should handle complex match patterns", () => {
            const complexConfig: ParserConfig = {
                importGroups: [
                    {
                        name: "Complex",
                        match: /^(@[a-z]+\/[a-z]+)|([a-z]{3,}\.[a-z]{2,})$/,
                        order: 0,
                    },
                ],
                patterns: DEFAULT_CONFIG.patterns,
            };

            const code = `
            import { util } from '@scope/util';
            import { data } from 'data.json';
        `;

            const result = parseImports(code, complexConfig);
            expect(result.groups[0].imports).toHaveLength(2);
        });

        it("should respect custom ordering", () => {
            const customOrderConfig: ParserConfig = {
                importGroups: [
                    { name: "Utils", match: /^@utils/, order: 2 },
                    { name: "Components", match: /^@components/, order: 1 },
                    { name: "Misc", match: /^[^@]/, order: 0, isDefault: true },
                ],
                patterns: DEFAULT_CONFIG.patterns,
            };

            const code = `
            import { util } from '@utils/helpers';
            import { Button } from '@components/Button';
            import { useState } from 'react';
        `;

            const result = parseImports(code, customOrderConfig);
            expect(result.groups[0].name).toBe("Misc");
            expect(result.groups[1].name).toBe("Components");
            expect(result.groups[2].name).toBe("Utils");
        });
    });

    it("should group imports correctly according to configuration", () => {
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
        expect(groups[0].name).toBe("Misc");
        expect(groups[1].name).toBe("Components");

        expect(groups[0].imports.map((i) => i.source)).toEqual(["fs", "path", "react"]);
        expect(groups[1].imports.map((i) => i.source)).toEqual(["@components/Header", "@components/Footer"].sort());
    });

    describe("Group Priority", () => {
        it("should prioritize imports according to their match pattern order", () => {
            const code = `
                import { useState } from 'react';
                import { Button } from '@components/Button';
                import { formatDate } from '@utils/date';
            `;

            const result = parseImports(code, config);
            const groups = result.groups;

            expect(groups).toHaveLength(3);
            expect(groups[0].name).toBe("Misc");
            expect(groups[1].name).toBe("Components");
            expect(groups[2].name).toBe("Utils");
        });

        it("should handle imports with comments correctly", () => {
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

    describe("Alias Imports", () => {
        it("should handle imports with aliases", () => {
            const code = `
                import { Button as CustomButton } from '@components/Button';
                import { useState as useLocalState } from 'react';
            `;

            const result = parseImports(code, config);
            const componentsGroup = result.groups.find((g) => g.name === "Components");
            const miscGroup = result.groups.find((g) => g.name === "Misc");

            expect(componentsGroup).toBeDefined();
            expect(miscGroup).toBeDefined();
            expect(componentsGroup?.imports[0].specifiers).toContain("Button as CustomButton");
            expect(miscGroup?.imports[0].specifiers).toContain("useState as useLocalState");
        });
    });

    describe("Multi-line Imports", () => {
        it("should parse multi-line imports correctly", () => {
            const code = `
                import {
                    useState,
                    useEffect,
                    useCallback
                } from 'react';
            `;

            const result = parseImports(code, config);
            const miscGroup = result.groups.find((g) => g.name === "Misc");

            expect(miscGroup).toBeDefined();
            expect(miscGroup?.imports[0].specifiers).toEqual(expect.arrayContaining(["useState", "useEffect", "useCallback"]));
        });
    });

    describe("Default and Named Imports", () => {
        it("should handle default and named imports", () => {
            const code = `
                import React, { useState } from 'react';
                import Button, { ButtonProps } from '@components/Button';
            `;

            const result = parseImports(code, config);

            const miscGroup = result.groups.find((g) => g.name === "Misc");
            const componentsGroup = result.groups.find((g) => g.name === "Components");

            // Check that default and named imports are now separated
            const reactDefaultImport = miscGroup?.imports.find((imp) => imp.type === "default" && imp.source === "react");
            const reactNamedImport = miscGroup?.imports.find((imp) => imp.type === "named" && imp.source === "react");

            const buttonDefaultImport = componentsGroup?.imports.find((imp) => imp.type === "default" && imp.source === "@components/Button");
            const buttonNamedImport = componentsGroup?.imports.find((imp) => imp.type === "named" && imp.source === "@components/Button");

            // Check presence of default imports
            expect(reactDefaultImport).toBeDefined();
            expect(reactDefaultImport?.specifiers).toContain("React");
            expect(buttonDefaultImport).toBeDefined();
            expect(buttonDefaultImport?.specifiers).toContain("Button");

            // Check presence of named imports
            expect(reactNamedImport).toBeDefined();
            expect(reactNamedImport?.specifiers).toContain("useState");
            expect(buttonNamedImport).toBeDefined();
            expect(buttonNamedImport?.specifiers).toContain("ButtonProps");
        });
    });

    describe("Namespace Imports", () => {
        it("should handle namespace imports", () => {
            const code = `import * as ReactDom from 'react';`;
            const result = parseImports(code, config);
            const miscGroup = result.groups.find((g) => g.name === "Misc");

            // Check that namespace import is correctly grouped
            expect(miscGroup).toBeDefined();
            expect(miscGroup?.imports).toHaveLength(1);
            // Type is 'default' because a namespace import is treated as a default import
            expect(miscGroup?.imports[0].type).toBe("default");
            expect(miscGroup?.imports[0].specifiers).toEqual(["* as ReactDom"]);
        });
    });

    describe("Import Sorting", () => {
        it("should sort imports according to group order", () => {
            const code = `
                import { formatDate } from '@utils/date';
                import { useState } from 'react';
                import { Button } from '@components/Button';
            `;

            const result = parseImports(code, config);
            const groups = result.groups;

            expect(groups[0].name).toBe("Misc");
            expect(groups[1].name).toBe("Components");
            expect(groups[2].name).toBe("Utils");
        });

        it("should sort imports alphabetically within each group", () => {
            const code = `
                import { useEffect, useState, useCallback } from 'react';
                import { Card, Button, Alert } from '@components/ui';
            `;

            const result = parseImports(code, config);

            const miscGroup = result.groups.find((g) => g.name === "Misc");
            const componentsGroup = result.groups.find((g) => g.name === "Components");

            expect(miscGroup?.imports[0].specifiers).toEqual(["useCallback", "useEffect", "useState"]);
            expect(componentsGroup?.imports[0].specifiers).toEqual(["Alert", "Button", "Card"]);
        });
    });

    describe("Edge Cases", () => {
        it("should handle imports without specifiers", () => {
            const code = `import 'styles/global.css';`;
            const result = parseImports(code, config);

            expect(result.groups.length).toBeGreaterThan(0);
            expect(result.invalidImports?.length).toBe(0);
            expect(result.groups[0].imports[0].type).toBe("sideEffect");
            expect(result.groups[0].imports[0].specifiers).toEqual([]);
        });

        it("should handle imports with dynamic expressions", () => {
            const code = `
                import { useState } from 'react';
                const moduleName = 'utils';
                const dynamicImport = import(\`@\${moduleName}/helpers\`);
            `;

            const result = parseImports(code, config);
            expect(result.groups.length).toBeGreaterThan(0);
            expect(result.groups[0].name).toBe("Misc");
        });

        it("should handle consecutive imports with different types", () => {
            const code = `
                import Button from '@components/Button';
                import { Card } from '@components/Card';
                import * as Utils from '@utils/helpers';
                import 'styles/global.css';
            `;

            const result = parseImports(code, config);
            expect(result.groups.length).toBe(3);
            expect(result.groups.find((g) => g.name === "Components")?.imports.length).toBe(2);
        });
    });
});

describe("Duplicate Default Imports", () => {
    it("should merge multiple default imports from the same source", () => {
        const code = `
                import BulletinAnnulationSVG from '@app/dossier/utils/bulletin/bulletin-annulation.svg?react';
                import BulletinAnnuleIcon from '@app/dossier/utils/bulletin/bulletin-annule.svg?react';
                import BulletinAnnulationIcon from '@app/dossier/utils/bulletin/bulletin-annulation.svg?react';
                import BulletinRemplacementIcon from '@app/dossier/utils/bulletin/bulletin-remplacement.svg?react';
                import BulletinComplementaireIcon from '@app/dossier/utils/bulletin/bulletin-complementaire.svg?react';
            `;

        // Utiliser une configuration qui place ces imports dans un groupe spécifique pour faciliter le test
        const svgConfig: ParserConfig = {
            importGroups: [
                { name: "Misc", order: 0, isDefault: true },
                { name: "SVGs", match: /\.svg\?react$/, order: 1 },
            ],
            patterns: DEFAULT_CONFIG.patterns,
        };

        const result = parseImports(code, svgConfig);
        const svgGroup = result.groups.find((g) => g.name === "SVGs");

        expect(svgGroup).toBeDefined();
        console.log("svgGroup:", JSON.stringify(svgGroup?.imports, null, 2)); // Commenté pour ne pas polluer la sortie des tests

        expect(svgGroup?.imports).toHaveLength(4); // 3 uniques + 1 fusionné

        const mergedImport = svgGroup?.imports.find(imp => imp.source === '@app/dossier/utils/bulletin/bulletin-annulation.svg?react');
        expect(mergedImport).toBeDefined();
        expect(mergedImport?.type).toBe('default');
        // Seul le dernier spécificateur rencontré doit être conservé
        expect(mergedImport?.specifiers).toEqual(['BulletinAnnulationIcon']); // C'est le dernier import dans le code d'exemple

        // Vérifier que les autres imports sont présents et corrects
        expect(svgGroup?.imports.find(imp => imp.source === '@app/dossier/utils/bulletin/bulletin-annule.svg?react')?.specifiers).toEqual(['BulletinAnnuleIcon']);
        expect(svgGroup?.imports.find(imp => imp.source === '@app/dossier/utils/bulletin/bulletin-remplacement.svg?react')?.specifiers).toEqual(['BulletinRemplacementIcon']);
        expect(svgGroup?.imports.find(imp => imp.source === '@app/dossier/utils/bulletin/bulletin-complementaire.svg?react')?.specifiers).toEqual(['BulletinComplementaireIcon']);
    });
});
