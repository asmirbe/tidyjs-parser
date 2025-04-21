import { ParserConfig, Parse } from "./types";
declare class ImportParser {
    private readonly config;
    private readonly typeOrder;
    private readonly patterns;
    private readonly defaultGroup;
    private subFolders;
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