export type ConfigImportGroup = {
    name: string;
    regex: RegExp;
    order: number;
    isDefault?: boolean;
};
export type ImportType = "default" | "named" | "typeDefault" | "typeNamed" | "sideEffect";
export type ImportSource = string;
export type ImportSpecifier = string;
export type TypeOrder = {
    [key in ImportType]: number;
};
export type SourcePatterns = {
    appSubfolderPattern?: RegExp;
};
export type ParserConfig = {
    importGroups: ConfigImportGroup[];
    defaultGroupName?: string;
    typeOrder?: TypeOrder;
    patterns?: SourcePatterns;
    priorityImports?: RegExp[];
};
export interface ParsedImport {
    type: ImportType;
    source: ImportSource;
    specifiers: ImportSpecifier[];
    raw: string;
    groupName: string | null;
    isPriority: boolean;
    appSubfolder: string | null;
}
export interface ImportGroup {
    name: string;
    order: number;
    imports: ParsedImport[];
}
export interface InvalidImport {
    raw: string;
    error: string;
}
export interface ParserResult {
    groups: ImportGroup[];
    originalImports: string[];
    appSubfolders: string[];
    invalidImports?: InvalidImport[];
}
export declare const DEFAULT_CONFIG: Partial<ParserConfig>;
//# sourceMappingURL=types.d.ts.map