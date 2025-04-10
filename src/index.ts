import { validateAndFixImportWithBabel } from "./fixer";
import { ImportParser } from "./parser";
import { ImportParserError } from "./errors";
import { DEFAULT_CONFIG } from "./types";

import type { ParserConfig, ParserResult } from "./types";

function parseImports(sourceCode: string, config: ParserConfig): ParserResult {
  const parser = new ImportParser(config);
  const { groups, originalImports, invalidImports } = parser.parse(sourceCode);
  const subFolders = parser.getSubfolders();

  return { groups, originalImports, subFolders, invalidImports };
}

export {
  ImportParser,
  ImportParserError,
  parseImports,
  validateAndFixImportWithBabel,
  DEFAULT_CONFIG
};

export * from "./types";