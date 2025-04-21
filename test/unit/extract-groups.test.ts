import { describe, it, expect } from '@jest/globals';
import { ImportParser } from "../../src/parser";
import { ParserConfig } from "../../src/types";

describe("Group comments detection", () => {
    const baseConfig: ParserConfig = {
        importGroups: [
            {
                name: "React",
                match: /^react/,
                order: 1
            },
            {
                name: "Components",
                match: /^@components/,
                order: 2
            },
            {
                name: "Utils",
                match: /^@utils/,
                order: 3
            },
            {
                name: "Default",
                order: 999,
                isDefault: true
            }
        ]
    };

    it("should detect single-line comment groups", async () => {
        const parser = new ImportParser(baseConfig);
        const result = await parser.parse(`
        // React dependencies
        import React from 'react';
        import { useState, useEffect } from 'react';
  
        // Components
        import { Button } from '@components/Button';
        import { Card } from '@components/Card';
  
        // Utils
        import { format } from '@utils/formatter';
        import { logger } from '@utils/logger';
      `);

        expect(result.foundGroups).toBeDefined();
        expect(result.foundGroups?.length).toBe(3);

        // Vérifier le premier groupe trouvé
        const reactGroup = result.foundGroups?.[0];
        expect(reactGroup?.name).toBe("React dependencies");
        expect(reactGroup?.suggestedGroupName).toBe("React");

        // Vérifier le deuxième groupe trouvé
        const componentsGroup = result.foundGroups?.[1];
        expect(componentsGroup?.name).toBe("Components");
        expect(componentsGroup?.suggestedGroupName).toBe("Components");

        // Vérifier le troisième groupe trouvé
        const utilsGroup = result.foundGroups?.[2];
        expect(utilsGroup?.name).toBe("Utils");
        expect(utilsGroup?.suggestedGroupName).toBe("Utils");
    });

    it("should detect multi-line comment groups", async () => {
        const parser = new ImportParser(baseConfig);
        const result = await parser.parse(`
        /* 
         * React dependencies 
         */
        import React from 'react';
        import { useState, useEffect } from 'react';
  
        /* Components section */
        import { Button } from '@components/Button';
        import { Card } from '@components/Card';
  
        /**
         * Utils imports
         */
        import { format } from '@utils/formatter';
        import { logger } from '@utils/logger';
      `);

        expect(result.foundGroups).toBeDefined();
        expect(result.foundGroups?.length).toBe(3);

        expect(result.foundGroups?.[0].name).toBe("React dependencies");
        expect(result.foundGroups?.[0].suggestedGroupName).toBe("React");

        expect(result.foundGroups?.[1].name).toBe("Components section");
        expect(result.foundGroups?.[1].suggestedGroupName).toBe("Components");

        expect(result.foundGroups?.[2].name).toBe("Utils imports");
        expect(result.foundGroups?.[2].suggestedGroupName).toBe("Utils");
    });

    it("should properly handle formatted comments", async () => {
        const parser = new ImportParser(baseConfig);
        const result = await parser.parse(`
        // Group: React dependencies
        import React from 'react';
        import { useState, useEffect } from 'react';
  
        /* Groupe: Components */
        import { Button } from '@components/Button';
        import { Card } from '@components/Card';
  
        // Section: Utils
        import { format } from '@utils/formatter';
        import { logger } from '@utils/logger';
      `);

        expect(result.foundGroups).toBeDefined();
        expect(result.foundGroups?.length).toBe(3);

        expect(result.foundGroups?.[0].name).toBe("React dependencies");
        expect(result.foundGroups?.[1].name).toBe("Components");
        expect(result.foundGroups?.[2].name).toBe("Utils");
    });

    it("should handle mixed styles and non-grouped imports", async () => {
        const parser = new ImportParser(baseConfig);
        const result = await parser.parse(`
        import fs from 'fs';
        
        // React dependencies
        import React from 'react';
        import { useState, useEffect } from 'react';
  
        import path from 'path';
        
        // Components
        import { Button } from '@components/Button';
        import { Card } from '@components/Card';
        
        import os from 'os';
      `);

        expect(result.foundGroups).toBeDefined();
        expect(result.foundGroups?.length).toBe(2); // Seulement 2 groupes commentés

        expect(result.foundGroups?.[0].name).toBe("React dependencies");
        expect(result.foundGroups?.[1].name).toBe("Components");

        // Vérifier que tous les imports sont bien présents dans result.groups
        const allImports = result.groups.flatMap(g => g.imports.map(i => i.source));
        expect(allImports).toContain('fs');
        expect(allImports).toContain('path');
        expect(allImports).toContain('os');
        expect(allImports).toContain('react');
        expect(allImports).toContain('@components/Button');
        expect(allImports).toContain('@components/Card');
    });

    it("should generate formatted code respecting found groups", async () => {
        const parser = new ImportParser(baseConfig);
        const sourceCode = `
        // React dependencies
        import { useState } from 'react';
        import React from 'react';
  
        // Components
        import { Card } from '@components/Card';
        import { Button } from '@components/Button';
      `;

        const result = await parser.parse(sourceCode);
        const formattedCode = parser.generateFormattedCode(result);

        // Vérifier que le code formaté respecte l'ordre des groupes trouvés
        expect(formattedCode).toContain("// React dependencies");
        expect(formattedCode).toContain("// Components");

        // Vérifier que l'ordre dans les groupes est maintenu selon la configuration
        const reactSection = formattedCode.substring(
            formattedCode.indexOf("// React dependencies"),
            formattedCode.indexOf("// Components")
        );

        // React devrait apparaître avant useState (ordre alphabétique dans le groupe)
        expect(reactSection.indexOf("import React")).toBeLessThan(reactSection.indexOf("import { useState }"));

        // Même chose pour les composants
        const componentsSection = formattedCode.substring(
            formattedCode.indexOf("// Components")
        );

        // Button devrait apparaître avant Card (ordre alphabétique dans le groupe)
        expect(componentsSection.indexOf("import { Button }")).toBeLessThan(componentsSection.indexOf("import { Card }"));
    });
});