import { describe, it, expect } from '@jest/globals';
import { ImportParser } from "../../src/parser";
import { ParserConfig } from "../../src/types";

describe("ImportParser", () => {
    describe("Comments management", () => {
        const baseConfig: ParserConfig = {
            importGroups: [
                {
                    name: "Default",
                    order: 1,
                    isDefault: true
                }
            ]
        };

        describe("Single-line comments (//)", () => {
            it("should ignore imports in // comments", () => {
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
                // The parser merges imports with the same source
                expect(defaultGroup.imports[0].raw.trim()).toContain("Component");
                expect(defaultGroup.imports[0].raw.trim()).toContain("NgModule");
            });

            it("should detect imports after // comments", () => {
                const parser = new ImportParser(baseConfig);
                const result = parser.parse(`
                    // A random comment
                    import { Component } from '@angular/core';
                `);

                expect(result.groups.length).toBe(1);
                expect(result.groups[0].imports.map(i => i.source)).toEqual(['@angular/core']);
            });
        });

        describe("Multi-line comments (/* */)", () => {
            it("should ignore imports in /* */ comments", () => {
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
                // The parser merges imports with the same source
                expect(defaultGroup.imports[0].raw.trim()).toContain("Component");
                expect(defaultGroup.imports[0].raw.trim()).toContain("Platform");
            });

            it("should detect imports before /* */ comments", () => {
                const parser = new ImportParser(baseConfig);
                const result = parser.parse(`
                    import { Component } from '@angular/core'; /* A comment */
                    import { Platform } from '@angular/core';
                `);

                expect(result.groups.length).toBe(1);
                const defaultGroup = result.groups[0];
                expect(defaultGroup.imports.map(i => i.source)).toEqual([
                    '@angular/core'
                ]);
                // The parser merges imports with the same source
                expect(defaultGroup.imports[0].raw.trim()).toContain("Component");
                expect(defaultGroup.imports[0].raw.trim()).toContain("Platform");
            });

            it("should detect imports after /* */ comments", () => {
                const parser = new ImportParser(baseConfig);
                const result = parser.parse(`
                    /* A comment */ import { Component } from '@angular/core';
                    import { Platform } from '@angular/core';
                `);

                expect(result.groups.length).toBe(1);
                const defaultGroup = result.groups[0];
                expect(defaultGroup.imports.map(i => i.source)).toEqual([
                    '@angular/core'
                ]);
                // The parser merges imports with the same source
                expect(defaultGroup.imports[0].raw.trim()).toContain("Component");
                expect(defaultGroup.imports[0].raw.trim()).toContain("Platform");
            });

            it("should ignore partially commented imports", () => {
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
                // The parser merges imports with the same source
                expect(result.groups[0].imports[0].raw.trim()).toContain("Component");
                expect(result.groups[0].imports[0].raw.trim()).toContain("Platform");
            });
        });
    });

    describe("Group priorities", () => {
        describe("Priority based on pattern order in regex", () => {
            it("should prioritize imports according to their order in the regex pattern", () => {
                const config: ParserConfig = {
                    importGroups: [
                        {
                            name: "React",
                            regex: /^(react|react-dom|react-router)$/,
                            order: 1
                        },
                        {
                            name: "Others",
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
                // Imports should be sorted according to the order in the regex
                expect(reactGroup!.imports.map(i => i.source)).toEqual(['react', 'react-dom', 'react-router']);
            });

            it("should prioritize component imports according to their hierarchy", () => {
                const config: ParserConfig = {
                    importGroups: [
                        {
                            name: "Components",
                            regex: /^@components\/(core\/|shared\/|ui\/).*$/,
                            order: 1
                        },
                        {
                            name: "Others",
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

        describe("Default group management", () => {
            it("should use the group marked as isDefault", () => {
                const config: ParserConfig = {
                    importGroups: [
                        {
                            name: "React",
                            regex: /^react/,
                            order: 1
                        },
                        {
                            name: "Internal Modules",
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

                const defaultGroup = result.groups.find(g => g.name === "Internal Modules");
                expect(defaultGroup).toBeDefined();
                expect(defaultGroup!.imports.map(i => i.source)).toEqual(['@internal/data', './utils']);
            });

            it("should use 'Misc' as the default group name if no group is marked as isDefault", () => {
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

        it("should choose the group with the highest priority when multiple groups match", () => {
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

        it("should use regex specificity when priorities are equal", () => {
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

        it("should use order when priorities are not defined", () => {
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
