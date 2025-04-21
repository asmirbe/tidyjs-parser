import { validateAndFixImportWithBabel } from "./fixer";
import { ImportParser } from "./parser";
import { ImportParserError } from "./errors";
import { DEFAULT_CONFIG } from "./types";
import type { ParserConfig, ParserResult } from "./types";
declare function parseImports(sourceCode: string, config: ParserConfig): Promise<ParserResult>;
export { ImportParser, ImportParserError, parseImports, validateAndFixImportWithBabel, DEFAULT_CONFIG };
export * from "./types";
//# sourceMappingURL=index.d.ts.map