export type ConfigImportGroup = {
  name: string;
  order: number;
  priority?: number;
} & (
    | {
      isDefault: true;
      regex?: RegExp;
    }
    | {
      isDefault?: false;
      regex: RegExp;
    }
  );

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

export type ParsedImport = {
  type: ImportType;
  source: ImportSource;
  specifiers: ImportSpecifier[];
  raw: string;
  groupName: string | null;
  isPriority: boolean;
  appSubfolder: string | null;
}

export type ImportGroup = {
  name: string;
  order: number;
  imports: ParsedImport[];
}

export type InvalidImport = {
  raw: string;
  error: string;
}

export type ParserResult = {
  groups: ImportGroup[];
  originalImports: string[];
  appSubfolders: string[];
  invalidImports?: InvalidImport[];
}

export const DEFAULT_CONFIG: Partial<ParserConfig> = {
  defaultGroupName: "Misc",
  typeOrder: {
    sideEffect: 0,
    default: 1,
    named: 2,
    typeDefault: 3,
    typeNamed: 4,
  },
  patterns: {
    appSubfolderPattern: /@app\/([^/]+)/,
  },
};
