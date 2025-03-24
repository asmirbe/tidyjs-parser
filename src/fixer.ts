import { parse } from "@babel/parser";
import generate from "@babel/generator";

export type FixResult = {
  fixed: string | null;
  isValid: boolean;
  errors: string[];
}

function fixDuplicateSpecifiers(importStmt: string): string | null {
  if (!importStmt.includes("{")) {
    return importStmt;
  }

  try {
    const importParts = importStmt.match(/^(import\s+(?:type\s+)?)({[^}]*})(\s+from\s+['"][^'"]+['"];?)$/);
    if (!importParts) {
      return importStmt;
    }

    const [, prefix, specifiersBlock, suffix] = importParts;
    const specifiersContent = specifiersBlock.substring(1, specifiersBlock.length - 1);

    const rawSpecifiers = specifiersContent
      .split(/\s*,\s*/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const uniqueSpecs = new Set<string>();

    for (const spec of rawSpecifiers) {
      const isType = spec.startsWith("type ");
      const specWithoutType = isType ? spec.substring(5).trim() : spec;

      let normalizedSpec: string;

      if (specWithoutType.includes(" as ")) {
        const [name, alias] = specWithoutType.split(" as ").map(s => s.trim());
        normalizedSpec = isType ? `type ${name} as ${alias}` : `${name} as ${alias}`;
      } else {
        normalizedSpec = isType ? `type ${specWithoutType}` : specWithoutType;
      }

      uniqueSpecs.add(normalizedSpec);
    }

    const correctedSpecifiers = Array.from(uniqueSpecs).join(", ");
    const correctedImport = `${prefix}{${correctedSpecifiers}}${suffix}`;

    return correctedImport;
  } catch {
    return importStmt;
  }
}

function normalizeDefaultImportAlias(importStmt: string): string {
  const defaultAliasMatch = importStmt.match(/import\s+(\w+)\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);

  if (defaultAliasMatch) {
    const [aliasName, moduleName] = defaultAliasMatch;
    return `import * as ${aliasName} from '${moduleName}';`;
  }

  return importStmt;
}

export function fixImportStatement(importStmt: string): FixResult {
  try {
    if (!importStmt.trim()) {
      return {
        fixed: null,
        isValid: false,
        errors: ["The import declaration is empty"],
      };
    }

    let cleanedImport = removeTrailingComments(importStmt);

    const hasDefaultAlias = cleanedImport.match(/import\s+\w+\s+as\s+\w+\s+from/);

    if (hasDefaultAlias) {
      cleanedImport = normalizeDefaultImportAlias(cleanedImport);
    }

    const duplicates = detectDuplicateSpecifiers(cleanedImport);

    if (duplicates) {
      const fixedImport = fixDuplicateSpecifiers(cleanedImport);
      if (!fixedImport) {
        return {
          fixed: null,
          isValid: false,
          errors: [`Failed to fix duplicate specifiers: ${duplicates.join(', ')}`]
        };
      }

      const remainingDuplicates = detectDuplicateSpecifiers(fixedImport);
      if (remainingDuplicates) {
        return {
          fixed: null,
          isValid: false,
          errors: [`Failed to remove duplicate specifiers: ${remainingDuplicates.join(', ')}`]
        };
      }

      cleanedImport = fixedImport;
    }

    const ast = parse(cleanedImport, {
      sourceType: "module",
      plugins: ["typescript"],
      errorRecovery: true,
    });

    const errors: string[] = [];
    let hasErrors = false;

    if (ast.errors && ast.errors.length > 0) {
      hasErrors = true;
      ast.errors.forEach((error) => {
        let errorMessage = error.toString();

        if (errorMessage.includes('Unexpected token, expected "from"')) {
          if (cleanedImport.includes(" as ")) {
            errorMessage +=
              "\nSuggestion: If you're using 'as' for an alias, ensure the correct syntax:" +
              "\n- For named imports: import { Original as Alias } from 'module';" +
              "\n- For namespace imports: import * as Alias from 'module';" +
              "\n- The syntax 'import Default as Alias from module' is not standard in TypeScript/ES6.";
          }
        } else if (errorMessage.includes("Unexpected token")) {
          errorMessage += "\nCheck the syntax: Are braces, commas, and semicolons correctly placed?";
        } else if (errorMessage.includes("has already been declared")) {
          errorMessage += "\nYou have declared the same identifier multiple times in the same import. " +
            "Make sure you don't have duplicates in your import list.";
        }

        errors.push(errorMessage);
      });

      if (errors.some((err) => err.includes("Unexpected token") || err.includes("Unexpected identifier") || err.includes("has already been declared"))) {
        return {
          fixed: null,
          isValid: false,
          errors,
        };
      }
    }

    const output = generate(ast, {
      retainLines: false,
      concise: false,
      jsescOption: {
        quotes: "single",
      },
    });

    let fixed = output.code.trim();

    if (hasDefaultAlias && fixed.includes("* as")) {
      const originalMatch = importStmt.match(/import\s+(\w+)\s+as\s+(\w+)\s+from/);
      if (originalMatch) {
        const [defaultName, aliasName] = originalMatch;
        const fixedMatch = fixed.match(/import\s+\*\s+as\s+(\w+)\s+from/);

        if (fixedMatch) {
          errors.push(
            `Note: The syntax 'import ${defaultName} as ${aliasName}' is not standard in ES6/TypeScript. ` +
            `It has been transformed to 'import * as ${aliasName}', but keep in mind that these two forms ` +
            "have different behaviors. The recommended form for a default import with alias would be: " +
            `import { default as ${aliasName} } from '...' or simply import ${aliasName} from '...'`
          );
        }
      }
    }

    if (!fixed.endsWith(";")) {
      fixed += ";";
    }

    const isImportStatement = fixed.startsWith("import");
    const hasSource = fixed.includes("from") || fixed.match(/import\s+['"]/);

    const isValid = Boolean(isImportStatement && hasSource && !hasErrors);

    return {
      fixed: isValid ? fixed : null,
      isValid,
      errors,
    };
  } catch (error) {
    let errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("Cannot read") || errorMessage.includes("undefined")) {
      errorMessage += ". This may be due to incorrect import syntax. Check the structure of your import declaration.";
    }

    return {
      fixed: null,
      isValid: false,
      errors: [errorMessage],
    };
  }
}

function detectDuplicateSpecifiers(importStmt: string): string[] | null {
  if (!importStmt.includes("{")) {
    return null;
  }

  const match = importStmt.match(/{([^}]*)}/);
  if (!match) {
    return null;
  }

  const specifiersContent = match[1];
  const specifiers = specifiersContent
    .split(/\s*,\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => {
      const withoutType = s.replace(/^type\s+/, "");
      return withoutType.split(/\s+as\s+/)[0].trim();
    });

  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const spec of specifiers) {
    if (seen.has(spec)) {
      duplicates.add(spec);
    } else {
      seen.add(spec);
    }
  }

  return duplicates.size > 0 ? Array.from(duplicates) : null;
}

function removeTrailingComments(importStmt: string): string {
  const lines = importStmt.split("\n");

  const cleanedLines: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith("//")) {
      continue;
    }

    const cleanedLine = line.replace(/\/\/.*$/, "").trim();

    if (cleanedLine) {
      cleanedLines.push(cleanedLine);
    }
  }

  if (cleanedLines.length === 0) {
    return "";
  }

  let cleaned = cleanedLines.join("\n");

  if (!cleaned.endsWith(";")) {
    cleaned += ";";
  }

  return cleaned;
}

export function validateAndFixImportWithBabel(importStmt: string): {
  fixed: string | null;
  isValid: boolean;
  error?: string;
} {
  const result = fixImportStatement(importStmt);

  return {
    fixed: result.fixed,
    isValid: result.isValid,
    error: result.errors.length > 0 ? result.errors.join("; ") : undefined,
  };
}
