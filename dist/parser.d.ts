import { ParserConfig, ImportGroup, InvalidImport } from "./types";
declare class ImportParser {
    private readonly config;
    private readonly defaultGroupName;
    private readonly typeOrder;
    private readonly TypeOrder;
    private readonly patterns;
    private readonly priorityImportPatterns;
    private appSubfolders;
    constructor(config: ParserConfig);
    parse(sourceCode: string): {
        groups: ImportGroup[];
        originalImports: string[];
        invalidImports: InvalidImport[];
    };
    private parseImport;
    private deduplicateSpecifiers;
    private preprocessImport;
    private isSourcePriority;
    private cleanImportStatement;
    private mergeImports;
    private validateSpecifiersConsistency;
    private areImportsSemanticallyEquivalent;
    private determineGroupName;
    private organizeImportsIntoGroups;
    private sortImportsWithinGroup;
    getAppSubfolders(): string[];
}
export { ImportParser };
//# sourceMappingURL=parser.d.ts.map