import { ParserConfig, Parse } from "./types";
declare class ImportParser {
    private readonly config;
    private readonly typeOrder;
    private readonly patterns;
    private readonly defaultGroup;
    private subFolders;
    /**
     * Méthode avancée pour fusionner les imports à l'aide de es-module-lexer
     * Remplace la méthode simple mergeImports
     */
    private enhancedMergeImports;
    private extractPatternsFromRegex;
    private findMatchIndexInRegex;
    constructor(config: ParserConfig);
    private findImportRange;
    private detectGroupComments;
    private sanitizeGroupName;
    parse(sourceCode: string): Promise<Parse>;
    private parseImport;
    private isSourcePriority;
    private determineGroupName;
    private cleanImportStatement;
    private mergeImports;
    private validateSpecifiersConsistency;
    private areImportsSemanticallyEquivalent;
    private organizeImportsIntoGroups;
    private sortImportsWithinGroup;
    getSubfolders(): string[];
    generateFormattedCode(parse: Parse): string;
    private generateStandardFormattedCode;
}
export { ImportParser };
//# sourceMappingURL=parser.d.ts.map