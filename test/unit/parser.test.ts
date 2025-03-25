import { describe, it, expect } from '@jest/globals';
import { ImportParser } from "../../src/parser";
import { ParserConfig } from "../../src/types";

describe("ImportParser", () => {
    describe("Gestion des commentaires", () => {
        const baseConfig: ParserConfig = {
            importGroups: [
                {
                    name: "Default",
                    order: 1,
                    isDefault: true
                }
            ]
        };

        describe("Commentaires sur une ligne (//)", () => {
            it("devrait ignorer les imports dans les commentaires //", () => {
                const parser = new ImportParser(baseConfig);
                const result = parser.parse(`
                    import { Component } from '@angular/core';
                    // import { Injectable } from '@angular/core';
                    import { NgModule } from '@angular/core';
                `);

                expect(result.groups.length).toBe(1);
                const defaultGroup = result.groups[0];
                expect(defaultGroup.imports.map(i => i.source)).toEqual([
                    '@angular/core'
                ]);
                // Le parser fusionne les imports avec la même source
                expect(defaultGroup.imports[0].raw.trim()).toContain("Component");
                expect(defaultGroup.imports[0].raw.trim()).toContain("NgModule");
            });

            it("devrait détecter les imports après les commentaires //", () => {
                const parser = new ImportParser(baseConfig);
                const result = parser.parse(`
                    // Un commentaire quelconque
                    import { Component } from '@angular/core';
                `);

                expect(result.groups.length).toBe(1);
                expect(result.groups[0].imports.map(i => i.source)).toEqual(['@angular/core']);
            });
        });

        describe("Commentaires multi-lignes (/* */)", () => {
            it("devrait ignorer les imports dans les commentaires /* */", () => {
                const parser = new ImportParser(baseConfig);
                const result = parser.parse(`
                    import { Component } from '@angular/core';
                    /* 
                    import { Injectable } from '@angular/core';
                    import { NgModule } from '@angular/core';
                    */
                   import { Platform } from '@angular/core';
                   `);

                expect(result.groups.length).toBe(1);
                const defaultGroup = result.groups[0];
                expect(defaultGroup.imports.map(i => i.source)).toEqual([
                    '@angular/core'
                ]);
                // Le parser fusionne les imports avec la même source
                expect(defaultGroup.imports[0].raw.trim()).toContain("Component");
                expect(defaultGroup.imports[0].raw.trim()).toContain("Platform");
            });

            it("devrait détecter les imports avant les commentaires /* */", () => {
                const parser = new ImportParser(baseConfig);
                const result = parser.parse(`
                    import { Component } from '@angular/core'; /* Un commentaire */
                    import { Platform } from '@angular/core';
                `);

                expect(result.groups.length).toBe(1);
                const defaultGroup = result.groups[0];
                expect(defaultGroup.imports.map(i => i.source)).toEqual([
                    '@angular/core'
                ]);
                // Le parser fusionne les imports avec la même source
                expect(defaultGroup.imports[0].raw.trim()).toContain("Component");
                expect(defaultGroup.imports[0].raw.trim()).toContain("Platform");
            });

            it("devrait détecter les imports après les commentaires /* */", () => {
                const parser = new ImportParser(baseConfig);
                const result = parser.parse(`
                    /* Un commentaire */ import { Component } from '@angular/core';
                    import { Platform } from '@angular/core';
                `);

                expect(result.groups.length).toBe(1);
                const defaultGroup = result.groups[0];
                expect(defaultGroup.imports.map(i => i.source)).toEqual([
                    '@angular/core'
                ]);
                // Le parser fusionne les imports avec la même source
                expect(defaultGroup.imports[0].raw.trim()).toContain("Component");
                expect(defaultGroup.imports[0].raw.trim()).toContain("Platform");
            });

            it("devrait ignorer les imports partiellement commentés", () => {
                const parser = new ImportParser(baseConfig);
                const result = parser.parse(`
                    import { Component } from '@angular/core';
                    /* import { Injectable */ from '@angular/core';
                    import { Platform } from '@angular/core';
                `);

                expect(result.groups.length).toBe(1);
                expect(result.groups[0].imports.map(i => i.source)).toEqual([
                    '@angular/core'
                ]);
                // Le parser fusionne les imports avec la même source
                expect(result.groups[0].imports[0].raw.trim()).toContain("Component");
                expect(result.groups[0].imports[0].raw.trim()).toContain("Platform");
            });
        });
    });

    describe("Priorité des groupes", () => {
        describe("Priorité basée sur l'ordre des patterns dans les regex", () => {
            it("devrait prioriser les imports selon leur ordre dans le pattern regex", () => {
                const config: ParserConfig = {
                    importGroups: [
                        {
                            name: "React",
                            regex: /^(react|react-dom|react-router)$/,
                            order: 1
                        },
                        {
                            name: "Autres",
                            order: 2,
                            isDefault: true
                        }
                    ]
                };

                const parser = new ImportParser(config);
                const result = parser.parse(`
                    import { Route } from 'react-router';
                    import { render } from 'react-dom';
                    import React from 'react';
                `);

                const reactGroup = result.groups.find(g => g.name === "React");
                expect(reactGroup).toBeDefined();
                // Les imports devraient être triés selon l'ordre dans le regex
                expect(reactGroup!.imports.map(i => i.source)).toEqual(['react', 'react-dom', 'react-router']);
            });

            it("devrait prioriser les imports de components selon leur hiérarchie", () => {
                const config: ParserConfig = {
                    importGroups: [
                        {
                            name: "Components",
                            regex: /^@components\/(core\/|shared\/|ui\/).*$/,
                            order: 1
                        },
                        {
                            name: "Autres",
                            order: 2,
                            isDefault: true
                        }
                    ]
                };

                const parser = new ImportParser(config);
                const result = parser.parse(`
                    import { Button } from '@components/ui/Button';
                    import { Card } from '@components/shared/Card';
                    import { Layout } from '@components/core/Layout';
                `);

                const componentsGroup = result.groups.find(g => g.name === "Components");
                expect(componentsGroup).toBeDefined();
                expect(componentsGroup!.imports.map(i => i.source)).toEqual([
                    '@components/core/Layout',
                    '@components/shared/Card',
                    '@components/ui/Button'
                ]);
            });
        });

        describe("Gestion des groupes par défaut", () => {
            it("devrait utiliser le groupe marqué comme isDefault", () => {
                const config: ParserConfig = {
                    importGroups: [
                        {
                            name: "React",
                            regex: /^react/,
                            order: 1
                        },
                        {
                            name: "Modules Internes",
                            order: 2,
                            isDefault: true
                        }
                    ]
                };

                const parser = new ImportParser(config);
                const result = parser.parse(`
                    import React from 'react';
                    import { something } from './utils';
                    import Data from '@internal/data';
                `);

                const defaultGroup = result.groups.find(g => g.name === "Modules Internes");
                expect(defaultGroup).toBeDefined();
                expect(defaultGroup!.imports.map(i => i.source)).toEqual(['@internal/data', './utils']);
            });

            it("devrait utiliser 'Misc' comme nom de groupe par défaut si aucun groupe n'est marqué comme isDefault", () => {
                const config: ParserConfig = {
                    importGroups: [
                        {
                            name: "React",
                            regex: /^react/,
                            order: 1
                        }
                    ]
                };

                const parser = new ImportParser(config);
                const result = parser.parse(`
                    import React from 'react';
                    import { something } from './utils';
                `);

                const defaultGroup = result.groups.find(g => g.name === "Misc");
                expect(defaultGroup).toBeDefined();
                expect(defaultGroup!.imports.map(i => i.source)).toEqual(['./utils']);
            });
        });

        it("devrait choisir le groupe avec la priorité la plus élevée quand plusieurs groupes correspondent", () => {
            const config: ParserConfig = {
                importGroups: [
                    {
                        name: "Others",
                        order: 0,
                        isDefault: true
                    },
                    {
                        name: "React",
                        regex: /^react/,
                        order: 1,
                        priority: 2
                    },
                    {
                        name: "Modules",
                        regex: /^react|^@react/,
                        order: 2,
                        priority: 1
                    }
                ]
            };

            const parser = new ImportParser(config);
            const result = parser.parse(`
                import React from 'react';
                import { useState } from 'react';
                import Data from '@user/data';
                import { Route } from 'react-router-dom';
            `);

            expect(result.groups).toHaveLength(2);
            const reactGroup = result.groups.find(g => g.name === "React");
            const othersGroup = result.groups.find(g => g.name === "Others");

            expect(reactGroup).toBeDefined();
            expect(reactGroup!.imports.map(i => i.source)).toEqual(['react', 'react', 'react-router-dom']);

            expect(othersGroup).toBeDefined();
            expect(othersGroup!.imports.map(i => i.source)).toEqual(['@user/data']);
        });

        it("devrait utiliser la spécificité des regex quand les priorités sont égales", () => {
            const config: ParserConfig = {
                importGroups: [
                    {
                        name: "Others",
                        order: 0,
                        isDefault: true
                    },
                    {
                        name: "React Router",
                        regex: /^react-router/,
                        order: 1,
                        priority: 2
                    },
                    {
                        name: "React",
                        regex: /^react/,
                        order: 1,
                        priority: 2
                    }
                ]
            };

            const parser = new ImportParser(config);
            const result = parser.parse(`
                import React from 'react';
                import { Route } from 'react-router-dom';
                import Data from '@user/data';
            `);

            expect(result.groups).toHaveLength(3);
            const routerGroup = result.groups.find(g => g.name === "React Router");
            const reactGroup = result.groups.find(g => g.name === "React");
            const othersGroup = result.groups.find(g => g.name === "Others");

            expect(routerGroup).toBeDefined();
            expect(routerGroup!.imports.map(i => i.source)).toEqual(['react-router-dom']);

            expect(reactGroup).toBeDefined();
            expect(reactGroup!.imports.map(i => i.source)).toEqual(['react']);

            expect(othersGroup).toBeDefined();
            expect(othersGroup!.imports.map(i => i.source)).toEqual(['@user/data']);
        });

        it("devrait utiliser l'ordre quand les priorités ne sont pas définies", () => {
            const config: ParserConfig = {
                importGroups: [
                    {
                        name: "Others",
                        order: 0,
                        isDefault: true
                    },
                    {
                        name: "First",
                        regex: /^react|^@react/,
                        order: 1
                    },
                    {
                        name: "Second",
                        regex: /^react-router/,
                        order: 2
                    }
                ]
            };

            const parser = new ImportParser(config);
            const result = parser.parse(`
                import React from 'react';
                import { useState } from 'react';
                import Data from '@user/data';
                import { Route } from 'react-router-dom';
            `);

            expect(result.groups).toHaveLength(3);
            const firstGroup = result.groups.find(g => g.name === "First");
            const secondGroup = result.groups.find(g => g.name === "Second");
            const othersGroup = result.groups.find(g => g.name === "Others");

            expect(firstGroup).toBeDefined();
            expect(firstGroup!.imports.map(i => i.source)).toEqual(['react', 'react']);

            expect(secondGroup).toBeDefined();
            expect(secondGroup!.imports.map(i => i.source)).toEqual(['react-router-dom']);

            expect(othersGroup).toBeDefined();
            expect(othersGroup!.imports.map(i => i.source)).toEqual(['@user/data']);
        });
    });
});
