import { parse } from "@babel/parser";
import generate from "@babel/generator";

export interface FixResult {
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

    const [prefix, specifiersBlock, suffix] = importParts;
    const specifiersContent = specifiersBlock.substring(1, specifiersBlock.length - 1);

    const rawSpecifiers = specifiersContent
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const uniqueSpecifiers = new Map<string, string>();

    for (const spec of rawSpecifiers) {
      const isType = spec.startsWith("type ");
      const specWithoutType = isType ? spec.substring(5).trim() : spec;

      let key: string;
      const fullSpec = spec;

      if (specWithoutType.includes(" as ")) {
        const [name] = specWithoutType.split(" as ");
        key = (isType ? "type " : "") + name.trim();
      } else {
        key = spec;
      }

      if (!uniqueSpecifiers.has(key)) {
        uniqueSpecifiers.set(key, fullSpec);
      }
    }

    const correctedSpecifiers = Array.from(uniqueSpecifiers.values()).join(", ");
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
        errors: ["La déclaration d'import est vide"],
      };
    }

    let cleanedImport = removeTrailingComments(importStmt);

    const hasDefaultAlias = cleanedImport.match(/import\s+\w+\s+as\s+\w+\s+from/);

    if (hasDefaultAlias) {
      cleanedImport = normalizeDefaultImportAlias(cleanedImport);
    }

    const hasDuplicates = detectDuplicateSpecifiers(cleanedImport);

    if (hasDuplicates) {
      const fixedImport = fixDuplicateSpecifiers(cleanedImport);
      if (fixedImport) {
        cleanedImport = fixedImport;
      }
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
              "\nSuggestion: Si vous utilisez 'as' pour un alias, assurez-vous de la syntaxe correcte:" +
              "\n- Pour les imports nommés: import { Original as Alias } from 'module';" +
              "\n- Pour les imports d'espace de noms (namespace): import * as Alias from 'module';" +
              "\n- La syntaxe 'import Default as Alias from module' n'est pas standard en TypeScript/ES6.";
          }
        } else if (errorMessage.includes("Unexpected token")) {
          errorMessage += "\nVérifiez la syntaxe: Les accolades, virgules et point-virgules sont-ils correctement placés?";
        } else if (errorMessage.includes("has already been declared")) {
          errorMessage += "\nVous avez déclaré le même identificateur plusieurs fois dans le même import. " + "Assurez-vous de ne pas avoir de doublons dans votre liste d'imports.";
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
            `Note: La syntaxe 'import ${defaultName} as ${aliasName}' n'est pas standard en ES6/TypeScript. ` +
            `Elle a été transformée en 'import * as ${aliasName}', mais gardez à l'esprit que ces deux formes ` +
            "ont des comportements différents. La forme recommandée pour un import par défaut avec alias serait: " +
            `import { default as ${aliasName} } from '...' ou simplement import ${aliasName} from '...'`
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
      errorMessage += ". Cela peut être dû à une syntaxe d'import incorrecte. Vérifiez la structure de votre déclaration d'import.";
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
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const withoutType = s.replace(/^type\s+/, "");
      return withoutType.split(" as ")[0].trim();
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
