import { ParserConfig, ImportGroup, InvalidImport } from "./types";
declare class ImportParser {
    private readonly config;
    private readonly typeOrder;
    private readonly patterns;
    private readonly defaultGroup;
    private subFolders;
    private extractPatternsFromRegex;
    private findMatchIndexInRegex;
    constructor(config: ParserConfig);
    parse(sourceCode: string): {
        groups: ImportGroup[];
        originalImports: string[];
        invalidImports: InvalidImport[];
    };
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
}
export { ImportParser };
//# sourceMappingURL=parser.d.ts.map