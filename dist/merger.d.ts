import { FormattingOptions, EnhancedParsedImport } from './types';
/**
 * Analyse et fusionne les imports du code source
 */
export declare function mergeImports(code: string, config?: FormattingOptions): Promise<EnhancedParsedImport[]>;
/**
 * Applique les imports fusionnés au code source
 */
export declare function applyMergedImports(code: string, mergedImports: EnhancedParsedImport[]): string;
/**
 * Fonction principale pour traiter le code source et fusionner les imports
 */
export declare function processCodeAndMergeImports(code: string, config?: FormattingOptions): Promise<string>;
//# sourceMappingURL=merger.d.ts.map