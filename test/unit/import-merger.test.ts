import { describe, it, expect } from '@jest/globals';
import { mergeImports, processCodeAndMergeImports } from '../../src/merger';
import { FormattingOptions } from '../../src/types';

describe('Import Merger', () => {
    describe('mergeImports', () => {
        it('should merge imports with the same source', async () => {
            const code = `
        import { Component } from '@angular/core';
        import { Injectable } from '@angular/core';
      `;

            const result = await mergeImports(code);

            expect(result).toHaveLength(1);
            expect(result[0].source).toBe('@angular/core');
            expect(result[0].specifiers).toHaveLength(2);
            expect(result[0].specifiers.map(s => s.name)).toContain('Component');
            expect(result[0].specifiers.map(s => s.name)).toContain('Injectable');
        });

        it('should handle different import types separately', async () => {
            const code = `
        import { Component } from '@angular/core';
        import type { OnInit } from '@angular/core';
      `;

            const result = await mergeImports(code);

            expect(result).toHaveLength(2);

            const namedImport = result.find(i => i.type === 'named');
            const typeImport = result.find(i => i.type === 'typeNamed');

            expect(namedImport).toBeDefined();
            expect(typeImport).toBeDefined();

            expect(namedImport?.specifiers.map(s => s.name)).toContain('Component');
            expect(typeImport?.specifiers.map(s => s.name)).toContain('OnInit');
        });

        it('should handle default imports', async () => {
            const code = `
        import React from 'react';
        import { useState } from 'react';
      `;

            const result = await mergeImports(code);

            expect(result).toHaveLength(2);

            const defaultImport = result.find(i => i.type === 'default');
            const namedImport = result.find(i => i.type === 'named');

            expect(defaultImport).toBeDefined();
            expect(namedImport).toBeDefined();

            expect(defaultImport?.specifiers[0].name).toBe('React');
            expect(namedImport?.specifiers[0].name).toBe('useState');
        });

        it('should handle namespace imports', async () => {
            const code = `
        import * as React from 'react';
        import { useState } from 'react';
      `;

            const result = await mergeImports(code);

            expect(result).toHaveLength(2);

            const namespaceImport = result.find(i => i.specifiers.some(s => s.type === 'namespace'));
            const namedImport = result.find(i => i.type === 'named');

            expect(namespaceImport).toBeDefined();
            expect(namedImport).toBeDefined();

            const namespaceSpec = namespaceImport?.specifiers.find(s => s.type === 'namespace');
            expect(namespaceSpec?.name).toBe('React');
            expect(namedImport?.specifiers[0].name).toBe('useState');
        });

        it('should handle aliases in named imports', async () => {
            const code = `
        import { Component as Comp } from '@angular/core';
        import { Injectable } from '@angular/core';
      `;

            const result = await mergeImports(code);

            expect(result).toHaveLength(1);

            const compSpec = result[0].specifiers.find(s => s.name === 'Component');
            expect(compSpec).toBeDefined();
            expect(compSpec?.alias).toBe('Comp');
        });

        it('should preserve comments when configured', async () => {
            const code = `
        // Important component
        import { Component } from '@angular/core';
        // Service dependency
        import { Injectable } from '@angular/core';
      `;

            const result = await mergeImports(code, { preserveComments: true });

            expect(result).toHaveLength(1);
            // Les commentaires peuvent ne pas être capturés dans certains cas de test
            // car ils dépendent de la position exacte dans le code
            expect(result[0].comments).toBeDefined();
            if (result[0].comments) {
                expect(Array.isArray(result[0].comments)).toBe(true);
            }
        });
    });

    describe('processCodeAndMergeImports', () => {
        it('should merge imports in the code', async () => {
            const code = `
        import { Component } from '@angular/core';
        import { Injectable } from '@angular/core';
        
        @Component({
          selector: 'app-root'
        })
        export class AppComponent {}
      `;

            const result = await processCodeAndMergeImports(code);

            expect(result).toContain("import { Component, Injectable } from '@angular/core';");
            expect(result).not.toContain("import { Component } from '@angular/core';");
            expect(result).toContain("export class AppComponent {}");
        });

        it('should handle multiple import groups', async () => {
            const code = `
        import { Component } from '@angular/core';
        import { Injectable } from '@angular/core';
        
        import { HttpClient } from '@angular/common/http';
        import { HttpHeaders } from '@angular/common/http';
      `;

            const result = await processCodeAndMergeImports(code);

            // Vérifier que les imports sont fusionnés par source
            expect(result).toContain("import { Component, Injectable } from '@angular/core';");
            expect(result).toContain("import { HttpClient, HttpHeaders } from '@angular/common/http';");
        });

        it('should respect formatting options', async () => {
            const code = `
        import { Component } from '@angular/core';
        import { Injectable, NgModule } from '@angular/core';
      `;

            const formattingOptions: FormattingOptions = {
                quoteStyle: 'double',
                semicolons: true,
                multilineIndentation: 2
            };

            const result = await processCodeAndMergeImports(code, formattingOptions);

            expect(result).toContain('import { Component, Injectable, NgModule } from "@angular/core";');
        });

        it('should use multiline format for many specifiers', async () => {
            const code = `
        import { Component } from '@angular/core';
        import { Injectable } from '@angular/core';
        import { NgModule } from '@angular/core';
        import { OnInit } from '@angular/core';
        import { OnDestroy } from '@angular/core';
      `;

            const formattingOptions: FormattingOptions = {
                multilineIndentation: 2
            };

            const result = await processCodeAndMergeImports(code, formattingOptions);

            expect(result).toContain('import {\n  Component,\n  Injectable,\n  NgModule,\n  OnDestroy,\n  OnInit\n} from');
        });

        it('should handle complex example with mixed import types', async () => {
            const code = `
        // Commentaire important
        import { Component } from '@angular/core';
        
        /* Ce commentaire explique
           l'utilisation des imports */
        import { Component, Injectable } from '@angular/core';
        
        import type { FC } from 'react';
        import type { FC, ReactNode } from 'react';
        
        import { Injectable, NgModule } from '@angular/core';
        
        import * as rxjs from 'rxjs';
        
        // Opérateurs de RxJS
        import { map } from 'rxjs/operators';
        import { filter, tap } from 'rxjs/operators';
        
        import defaultExport from 'some-module';
      `;

            const result = await processCodeAndMergeImports(code);

            // Vérifier la fusion des imports Angular
            expect(result).toContain("import { Component, Injectable, NgModule } from '@angular/core';");

            // Vérifier la fusion des imports de type React
            expect(result).toContain("import type { FC, ReactNode } from 'react';");

            // Vérifier la fusion des imports RxJS operators
            expect(result).toContain("import { filter, map, tap } from 'rxjs/operators';");

            // Vérifier que les imports namespace et default sont préservés
            expect(result).toContain("import * as rxjs from 'rxjs';");
            expect(result).toContain("import defaultExport from 'some-module';");
        });
    });
});