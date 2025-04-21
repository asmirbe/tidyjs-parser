import { validateAndFixImportWithBabel } from "./fixer";
import { ImportParser } from "./parser";
import { ImportParserError } from "./errors";
import { DEFAULT_CONFIG } from "./types";

import type { ParserConfig, ParserResult } from "./types";

async function parseImports(sourceCode: string, config: ParserConfig): Promise<ParserResult> {
  const parser = new ImportParser(config);
  const { groups, originalmports, invalidImports } = await parser.parse(sourceCode);
  const subFolders = parser.getSubfolders();

  return { groups, originalmports, subFolders, invalidImports };
}

export {
  ImportParser,
  ImportParserError,
  parseImports,
  validateAndFixImportWithBabel,
  DEFAULT_CONFIG
};

export * from "./types";