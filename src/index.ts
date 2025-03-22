import { validateAndFixImportWithBabel } from "./fixer";
import { ImportParser } from "./parser";
import { ImportParserError } from "./errors";
import type { ParserConfig, ParserResult, DEFAULT_CONFIG } from "./types";
function parseImports(sourceCode: string, config: ParserConfig): ParserResult {
  const parser = new ImportParser(config);
  const { groups, originalImports, invalidImports } = parser.parse(sourceCode);
  const appSubfolders = parser.getAppSubfolders();

  return { groups, originalImports, appSubfolders, invalidImports };
}

export { ImportParser, ImportParserError, parseImports, validateAndFixImportWithBabel, DEFAULT_CONFIG };

export * from "./types";