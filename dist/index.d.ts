import { validateAndFixImportWithBabel } from "./fixer";
import { ImportParser } from "./parser";
import { ImportParserError } from "./errors";
import { ParserConfig, ConfigImportGroup, ImportGroup, TypeOrder, SourcePatterns, InvalidImport, ParserResult, ParsedImport, DEFAULT_CONFIG } from "./types";
declare function parseImports(sourceCode: string, config: ParserConfig): ParserResult;
export { ImportParser, ImportParserError, parseImports, validateAndFixImportWithBabel, DEFAULT_CONFIG };
export type { ParserConfig, ConfigImportGroup, ImportGroup, TypeOrder, SourcePatterns, InvalidImport, ParserResult, ParsedImport };
//# sourceMappingURL=index.d.ts.map