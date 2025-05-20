export type ConfigImportGroup = {
  name: string;
  order: number;
  priority?: number;
} & (
    | {
      isDefault: true;
      match?: RegExp;
    }
    | {
      isDefault?: false;
      match: RegExp;
    }
  );

export type ImportType = "default" | "named" | "typeDefault" | "typeNamed" | "sideEffect";
export type ImportSource = string;
export type ImportSpecifier = string;

export type SpecifierType =
  | 'default'      // import Default
  | 'namespace'    // import * as Something
  | 'named'        // import { Named }
  | 'typeDefault'  // import type Default
  | 'typeNamespace'// import type * as Something
  | 'typeNamed';   // import type { Named }

export type EnhancedImportSpecifier = {
  type: SpecifierType;
  name: string;
  alias?: string;
};

export type EnhancedParsedImport = {
  source: string;
  specifiers: EnhancedImportSpecifier[];
  raw: string;
  type: ImportType;
  start: number;
  end: number;
  comments?: string[]; // commentaires associés
};

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
  originalmports: string[];
  invalidImports: InvalidImport[];
  range?: Range;
  foundGroups?: FoundGroup[]; // Nouveaux groupes trouvés dans les commentaires
}

export type FoundGroup = {
  name: string;           // Nom du groupe trouvé dans le commentaire
  commentStart: number;   // Position de début du commentaire
  commentEnd: number;     // Position de fin du commentaire
  importsStart: number;   // Position de début du premier import du groupe
  importsEnd: number;     // Position de fin du dernier import du groupe
  suggestedGroupName?: string; // Groupe suggéré selon la configuration
}

export type ImportGroup = {
  name: string;
  order: number;
  imports: ParsedImport[];
}

export type InvalidImport = {
  originalmports: string;
  error: string;
}

export type ParsedImport = {
  type: ImportType;
  source: ImportSource;
  specifiers: ImportSpecifier[];
  originalmports: string;
  groupName: string | null;
  isPriority: boolean;
  appSubfolder: string | null;
}

export type ParserResult = {
  groups: ImportGroup[];
  originalmports: string[];
  subFolders: string[];
  invalidImports?: InvalidImport[];
}

export type FormattingOptions = {
  quoteStyle?: 'single' | 'double';
  semicolons?: boolean;
  multilineIndentation?: number | 'tab';
  preserveComments?: boolean;
};

export type SourcePatterns = {
  subfolderPattern?: RegExp;
};

export const DEFAULT_CONFIG: Partial<ParserConfig> = {
  formatting: {
    quoteStyle: 'single',
    semicolons: true,
    multilineIndentation: 2,
  },
  typeOrder: {
    sideEffect: 0,
    default: 1,
    named: 2,
    typeDefault: 3,
    typeNamed: 4,
  },
  patterns: {},
};


export type Range = { start: number; end: number; error?: string }