export type ConfigImportGroup = {
    name: string;
    order: number;
    priority?: number;
} & ({
    isDefault: true;
    match?: RegExp;
} | {
    isDefault?: false;
    match: RegExp;
});
export type ImportType = "default" | "named" | "typeDefault" | "typeNamed" | "sideEffect";
export type ImportSource = string;
export type ImportSpecifier = string;
export type TypeOrder = {
    [key in ImportType]: number;
};
export type ParserConfig = {
    importGroups: ConfigImportGroup[];
    typeOrder?: TypeOrder;
    patterns?: SourcePatterns;
    formatting?: FormattingOptions;
};
export type Parse = {
    groups: ImportGroup[];
    originalImports: string[];
    invalidImports: InvalidImport[];
    range?: {
        start: number;
        end: number;
        error?: string;
    };
};
export type ParsedImport = {
    type: ImportType;
    source: ImportSource;
    specifiers: ImportSpecifier[];
    raw: string;
    groupName: string | null;
    isPriority: boolean;
    appSubfolder: string | null;
};
export type ImportGroup = {
    name: string;
    order: number;
    imports: ParsedImport[];
};
export type InvalidImport = {
    raw: string;
    error: string;
};
export type ParserResult = {
    groups: ImportGroup[];
    originalImports: string[];
    subFolders: string[];
    invalidImports?: InvalidImport[];
};
export type FormattingOptions = {
    quoteStyle?: 'single' | 'double';
    semicolons?: boolean;
    multilineIndentation?: number | 'tab';
};
export type SourcePatterns = {
    subfolderPattern?: RegExp;
};
export declare const DEFAULT_CONFIG: Partial<ParserConfig>;
export type Range = {
    start: number;
    end: number;
    error?: string;
};
//# sourceMappingURL=types.d.ts.map