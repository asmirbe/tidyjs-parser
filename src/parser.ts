import { parse } from "@babel/parser";
import { validateAndFixImportWithBabel } from "./fixer";
import { ImportParserError } from "./errors";
import { ParserConfig, ParsedImport, ImportGroup, TypeOrder, SourcePatterns, InvalidImport, DEFAULT_CONFIG, ConfigImportGroup } from "./types";
import { validateConfig } from "./validator";

class ImportParser {
  private readonly config: ParserConfig;
  private readonly typeOrder: TypeOrder;
  private readonly patterns: SourcePatterns;
  private readonly defaultGroup: string;
  private appSubfolders: Set<string>;

  private extractPatternsFromRegex(regexStr: string): string[] {
    const match = regexStr.match(/\(\s*([^)]+)\)/);
    if (!match?.[1]) return [];
    return match[1].split('|').map(p => p.trim());
  }

  private findMatchIndexInRegex(source: string, regex: RegExp): number {
    const regexStr = regex.toString();
    const patterns = this.extractPatternsFromRegex(regexStr);

    for (let i = 0; i < patterns.length; i++) {
      if (new RegExp(patterns[i]).test(source)) {
        return i;
      }
    }
    return patterns.length;
  }

  constructor(config: ParserConfig) {
    const validation = validateConfig(config);
    if (!validation.isValid) {
      throw new ImportParserError(
        `Configuration invalide:\n${validation.errors.map(
          err => `  - [${err.field}] ${err.message}${err.suggestion ? `\n    Suggestion: ${err.suggestion}` : ''}`
        ).join('\n')}`,
        JSON.stringify(config, null, 2)
      );
    }

    if (validation.warnings.length > 0) {
      console.warn(
        `Avertissements de configuration:\n${validation.warnings.map(
          warn => `  - [${warn.field}] ${warn.message}${warn.suggestion ? `\n    Suggestion: ${warn.suggestion}` : ''}`
        ).join('\n')}`
      );
    }

    const importGroups = config.importGroups.map(group => {
      if (group.isDefault) {
        return {
          ...group,
          isDefault: true
        };
      } else {
        if (!group.regex) {
          throw new ImportParserError("Regex is required for non-default groups", JSON.stringify(group));
        }
        return {
          ...group,
          isDefault: false
        };
      }
    }) as ConfigImportGroup[];

    const patterns = {
      ...DEFAULT_CONFIG.patterns,
      ...(config.patterns)
    };

    this.config = {
      ...config,
      importGroups,
      typeOrder: { ...(DEFAULT_CONFIG.typeOrder as TypeOrder), ...(config.typeOrder ?? {}) } as TypeOrder,
      patterns
    };

    this.appSubfolders = new Set<string>();

    const defaultGroup = config.importGroups.find((g) => g.isDefault);
    this.defaultGroup = defaultGroup ? defaultGroup.name : "Misc";
    this.typeOrder = this.config.typeOrder as TypeOrder;
    this.patterns = this.config.patterns as SourcePatterns;
  }

  public parse(sourceCode: string): { groups: ImportGroup[]; originalImports: string[]; invalidImports: InvalidImport[] } {
    const originalImports: string[] = [];
    const invalidImports: InvalidImport[] = [];
    const potentialImportLines: string[] = [];

    try {
      const ast = parse(sourceCode, {
        sourceType: "module",
        plugins: ["typescript"],
        errorRecovery: true,
      });

      ast.program.body.forEach((node) => {
        if (node.type === "ImportDeclaration") {
          const importText = sourceCode.substring(node.start || 0, node.end || 0).trim();
          potentialImportLines.push(importText);
        }
      });
    } catch (error) {
      invalidImports.push({
        raw: sourceCode,
        error: error instanceof Error ? error.message : String(error),
      });
      return { groups: [], originalImports, invalidImports };
    }

    let parsedImports: ParsedImport[] = [];

    for (const importStmt of potentialImportLines) {
      try {
        originalImports.push(importStmt);

        const { fixed, isValid, error } = validateAndFixImportWithBabel(importStmt);

        if (!isValid) {
          let errorMessage = error ?? "Erreur de syntaxe non spécifiée";

          if (error?.includes('Unexpected token, expected "from"')) {
            if (importStmt.includes(" as ")) {
              errorMessage +=
                " - Lors de l'utilisation d'un alias avec 'as', il faut l'inclure à l'intérieur des accolades pour les imports nommés ou l'utiliser avec un import par défaut. Exemple correct: import { Component as C } from 'module'; ou import Default as D from 'module';";
            }
          }

          invalidImports.push({
            raw: importStmt,
            error: errorMessage,
          });
          continue;
        }

        const normalizedImport = fixed ?? importStmt;

        const imports = this.parseImport(normalizedImport);

        if (Array.isArray(imports)) {
          parsedImports = parsedImports.concat(imports);
        } else {
          parsedImports.push(imports);
        }
      } catch (error) {
        invalidImports.push({
          raw: importStmt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    parsedImports = this.mergeImports(parsedImports);

    const groups = this.organizeImportsIntoGroups(parsedImports);

    return { groups, originalImports, invalidImports };
  }

  private parseImport(importStmt: string): ParsedImport | ParsedImport[] {
    try {
      const ast = parse(importStmt, {
        sourceType: "module",
        plugins: ["typescript"],
        errorRecovery: true,
      });

      const importNode = ast.program.body[0];
      if (importNode?.type !== "ImportDeclaration") {
        throw new ImportParserError("Invalid import statement", importStmt);
      }

      const source = importNode.source.value;
      if (!source || typeof source !== "string") {
        throw new ImportParserError("Impossible d'extraire la source du module d'import", importStmt);
      }

      const isPriority = this.isSourcePriority(source);
      const groupName = this.determineGroupName(source);
      let appSubfolder: string | null = null;

      if (this.patterns.subfolderPattern) {
        const appSubfolderMatch = source.match(this.patterns.subfolderPattern);
        if (appSubfolderMatch?.[1]) {
          appSubfolder = appSubfolderMatch[1];
          this.appSubfolders.add(appSubfolder);
        }
      }

      const isTypeImport = importNode.importKind === "type";
      const isSideEffect = !importNode.specifiers || importNode.specifiers.length === 0;

      if (isSideEffect) {
        return {
          type: "sideEffect",
          source,
          specifiers: [],
          raw: importStmt,
          groupName,
          isPriority,
          appSubfolder,
        };
      }

      // Handle combined default and named imports
      const defaultImports: string[] = [];
      const namedImports: string[] = [];
      const typeImports: string[] = [];
      let hasNamed = false;
      let hasDefault = false;

      if (importNode.specifiers) {
        for (const specifier of importNode.specifiers) {
          if (specifier.type === "ImportDefaultSpecifier") {
            defaultImports.push(specifier.local.name);
            hasDefault = true;
          } else if (specifier.type === "ImportNamespaceSpecifier") {
            // For namespace imports, we keep the full "* as name" syntax
            defaultImports.push(`* as ${specifier.local.name}`);
            hasDefault = true;
          } else if (specifier.type === "ImportSpecifier") {
            const importedName = specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : specifier.imported.value;
            const localName = specifier.local.name;
            const specifierStr = importedName === localName
              ? importedName
              : `${importedName} as ${localName}`;

            if (isTypeImport) {
              typeImports.push(specifierStr);
            } else {
              namedImports.push(specifierStr);
            }
            hasNamed = true;
          }
        }
      }

      // Handle mixed default and named imports case
      if (hasDefault && hasNamed) {
        const result: ParsedImport[] = [];

        if (defaultImports.length > 0) {
          result.push({
            type: isTypeImport ? "typeDefault" : "default",
            source,
            specifiers: defaultImports,
            raw: importStmt,
            groupName,
            isPriority,
            appSubfolder
          });
        }

        if (namedImports.length > 0) {
          result.push({
            type: isTypeImport ? "typeNamed" : "named",
            source,
            specifiers: namedImports,
            raw: importStmt,
            groupName,
            isPriority,
            appSubfolder
          });
        }

        if (typeImports.length > 0) {
          result.push({
            type: "typeNamed",
            source,
            specifiers: typeImports,
            raw: importStmt,
            groupName,
            isPriority,
            appSubfolder
          });
        }

        if (result.length > 0) {
          return result;
        }
      }

      if (defaultImports.length > 0) {
        return {
          type: isTypeImport ? "typeDefault" : "default",
          source,
          specifiers: defaultImports,
          raw: importStmt,
          groupName,
          isPriority,
          appSubfolder,
        };
      }

      if (namedImports.length > 0) {
        return {
          type: isTypeImport ? "typeNamed" : "named",
          source,
          specifiers: namedImports,
          raw: importStmt,
          groupName,
          isPriority,
          appSubfolder,
        };
      }

      if (typeImports.length > 0) {
        return {
          type: "typeNamed",
          source,
          specifiers: typeImports,
          raw: importStmt,
          groupName,
          isPriority,
          appSubfolder,
        };
      }

      throw new ImportParserError("Aucun spécificateur trouvé dans l'import", importStmt);
    } catch (error) {
      if (error instanceof ImportParserError) {
        throw error;
      }

      throw new ImportParserError(`Erreur lors du parsing de l'import: ${error instanceof Error ? error.message : String(error)}`, importStmt);
    }
  }

  private isSourcePriority(source: string): boolean {
    const currentGroup = this.config.importGroups.find(group => {
      if (!group.regex) return false;
      return group.regex.test(source);
    });

    if (!currentGroup?.regex) return false;

    const regexStr = currentGroup.regex.toString();
    if (!regexStr.includes('(') || !regexStr.includes('|')) return false;

    // Utiliser findMatchIndexInRegex pour déterminer si la source correspond au premier pattern
    return this.findMatchIndexInRegex(source, currentGroup.regex) === 0;
  }

  private determineGroupName(source: string): string {
    const defaultGroup = this.config.importGroups.find((group) => group.isDefault);
    const defaultGroupName = defaultGroup ? defaultGroup.name : this.defaultGroup;

    const matchingGroups = this.config.importGroups.filter(group => {
      if (group.isDefault) return false;
      if (!group.regex) return false;
      return group.regex.test(source);
    });

    if (matchingGroups.length === 0) {
      return defaultGroupName;
    }

    if (matchingGroups.length === 1) {
      return matchingGroups[0].name;
    }

    const groupsByPriority = new Map<number | undefined, typeof matchingGroups>();
    matchingGroups.forEach(group => {
      const priority = group.priority;
      if (!groupsByPriority.has(priority)) {
        groupsByPriority.set(priority, []);
      }
      groupsByPriority.get(priority)!.push(group);
    });

    const priorityGroups = Array.from(groupsByPriority.entries())
      .filter(([priority]) => priority !== undefined)
      .sort(([a], [b]) => (b as number) - (a as number));

    if (priorityGroups.length > 0) {
      const [, highestPriorityGroups] = priorityGroups[0];

      if (highestPriorityGroups.length > 1) {
        return highestPriorityGroups.sort((a, b) => {
          const aPattern = a.regex?.toString().replace(/[/^$|]/g, '') ?? '';
          const bPattern = b.regex?.toString().replace(/[/^$|]/g, '') ?? '';

          if (aPattern.length !== bPattern.length) {
            return bPattern.length - aPattern.length;
          }

          if (a.order !== b.order) {
            return a.order - b.order;
          }

          return a.name.localeCompare(b.name);
        })[0].name;
      }

      return highestPriorityGroups[0].name;
    }

    return matchingGroups.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return 1;
      if (!a.isDefault && b.isDefault) return -1;

      const aPattern = a.regex?.toString().replace(/[/^$|]/g, '') ?? '';
      const bPattern = b.regex?.toString().replace(/[/^$|]/g, '') ?? '';

      if (aPattern.length !== bPattern.length) {
        return bPattern.length - aPattern.length;
      }

      if (a.order !== b.order) {
        return a.order - b.order;
      }

      return a.name.localeCompare(b.name);
    })[0].name;
  }

  private cleanImportStatement(importStmt: string): string {
    const lines = importStmt.split("\n");
    const formatting = this.config.formatting || DEFAULT_CONFIG.formatting;

    const cleanedLines: string[] = [];
    let isMultiline = lines.length > 1;

    for (const line of lines) {
      if (line.trim().startsWith("//")) {
        continue;
      }

      // Supprimer les commentaires /* */ en ligne
      let cleanedLine = line.replace(/\/\*.*?\*\//g, "").trim();

      // Supprimer les commentaires // en ligne
      cleanedLine = cleanedLine.replace(/\/\/.*$/, "").trim();

      if (cleanedLine) {
        cleanedLines.push(cleanedLine);
      }
    }

    let cleaned = cleanedLines.join(isMultiline ? "\n" : " ").trim();

    // Gestion des quotes
    if (formatting?.quoteStyle === 'double') {
      cleaned = cleaned.replace(/'/g, '"');
    } else if (formatting?.quoteStyle === 'single') {
      cleaned = cleaned.replace(/"/g, "'");
    }

    // Gestion des point-virgules
    if (formatting?.semicolons === false) {
      cleaned = cleaned.replace(/;+$/, '');
    } else if (!cleaned.endsWith(";")) {
      cleaned += ";";
    }

    // Gestion de l'indentation multiligne
    if (isMultiline && formatting?.multilineIndentation) {
      const indent = formatting.multilineIndentation === 'tab'
        ? '\t'
        : ' '.repeat(Number(formatting.multilineIndentation));

      cleaned = cleaned
        .split('\n')
        .map((line, i) => i > 0 ? indent + line : line)
        .join('\n');
    }

    return cleaned;
  }

  private mergeImports(imports: ParsedImport[]): ParsedImport[] {
    const mergedImportsMap = new Map<string, ParsedImport>();

    for (const importObj of imports) {
      const cleanedRaw = this.cleanImportStatement(importObj.raw);

      const key = `${importObj.type}:${importObj.source}`;

      if (mergedImportsMap.has(key)) {
        const existingImport = mergedImportsMap.get(key)!;

        const specifiersSet = new Set<string>([...existingImport.specifiers, ...importObj.specifiers]);

        existingImport.specifiers = Array.from(specifiersSet).sort();

        if (cleanedRaw.length > this.cleanImportStatement(existingImport.raw).length) {
          existingImport.raw = cleanedRaw;
        }

        this.validateSpecifiersConsistency(existingImport);
      } else {
        const newImport = {
          ...importObj,
          raw: cleanedRaw,
          specifiers: [...importObj.specifiers].sort(),
        };

        this.validateSpecifiersConsistency(newImport);

        mergedImportsMap.set(key, newImport);
      }
    }

    return Array.from(mergedImportsMap.values());
  }

  private validateSpecifiersConsistency(importObj: ParsedImport): void {
    if (importObj.type === "named" || importObj.type === "typeNamed") {
      const prefix = importObj.type === "typeNamed" ? "import type " : "import ";
      const specifiersStr = `{ ${importObj.specifiers.join(", ")} }`;
      const reconstructed = `${prefix}${specifiersStr} from '${importObj.source}';`;

      if (!this.areImportsSemanticallyEquivalent(importObj.raw, reconstructed)) {
        importObj.raw = reconstructed;
      }
    } else if (importObj.type === "default" || importObj.type === "typeDefault") {
      const prefix = importObj.type === "typeDefault" ? "import type " : "import ";
      const reconstructed = `${prefix}${importObj.specifiers[0]} from '${importObj.source}';`;

      if (!this.areImportsSemanticallyEquivalent(importObj.raw, reconstructed)) {
        importObj.raw = reconstructed;
      }
    }
  }

  private areImportsSemanticallyEquivalent(import1: string, import2: string): boolean {
    const normalize = (str: string) => str.replace(/\s+/g, " ").trim();

    const extractParts = (importStr: string) => {
      const typeMatch = importStr.includes("import type");
      const sourceMatch = importStr.match(/from\s+['"]([^'"]+)['"]/);
      const source = sourceMatch ? sourceMatch[1] : "";

      const specifiers: string[] = [];
      if (importStr.includes("{")) {
        const specifiersMatch = importStr.match(/{([^}]*)}/);
        if (specifiersMatch) {
          specifiers.push(
            ...specifiersMatch[1]
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          );
        }
      } else if (!importStr.includes("{") && importStr.includes("import")) {
        const defaultMatch = importStr.match(/import\s+(?:type\s+)?(\w+|\*\s+as\s+\w+)/);
        if (defaultMatch) {
          specifiers.push(defaultMatch[1]);
        }
      }

      return { typeMatch, source, specifiers };
    };

    const parts1 = extractParts(normalize(import1));
    const parts2 = extractParts(normalize(import2));

    return parts1.typeMatch === parts2.typeMatch && parts1.source === parts2.source && JSON.stringify(parts1.specifiers.sort()) === JSON.stringify(parts2.specifiers.sort());
  }

  private organizeImportsIntoGroups(imports: ParsedImport[]): ImportGroup[] {
    const groupMap = new Map<string, ParsedImport[]>();
    const appSubfolderGroups = new Map<string, ParsedImport[]>();

    const configGroupMap = new Map<string, { order: number; priority?: number }>();
    this.config.importGroups.forEach((group) => {
      configGroupMap.set(group.name, {
        order: group.order,
        priority: group.priority,
      });
      groupMap.set(group.name, []);
    });

    if (!groupMap.has(this.defaultGroup)) {
      const defaultOrder = 999;
      groupMap.set(this.defaultGroup, []);
      configGroupMap.set(this.defaultGroup, {
        order: defaultOrder,
        priority: 0,
      });
    }

    imports.forEach((importObj) => {
      if (importObj.appSubfolder) {
        const subfolder = importObj.appSubfolder;
        const groupName = subfolder;

        if (!appSubfolderGroups.has(groupName)) {
          appSubfolderGroups.set(groupName, []);
        }

        appSubfolderGroups.get(groupName)!.push(importObj);
      } else if (importObj.groupName && groupMap.has(importObj.groupName)) {
        groupMap.get(importObj.groupName)!.push(importObj);
      } else {
        groupMap.get(this.defaultGroup)!.push(importObj);
      }
    });

    groupMap.forEach((importsInGroup, groupName) => {
      groupMap.set(groupName, this.sortImportsWithinGroup(importsInGroup));
    });

    appSubfolderGroups.forEach((importsInGroup, groupName) => {
      appSubfolderGroups.set(groupName, this.sortImportsWithinGroup(importsInGroup));
    });

    const result: ImportGroup[] = [];

    for (const [name, importsInGroup] of groupMap.entries()) {
      const groupConfig = configGroupMap.get(name) || { order: 999, priority: 0 };
      if (importsInGroup.length > 0) {
        result.push({
          name,
          order: groupConfig.order,
          imports: importsInGroup,
        });
      }
    }

    const appGroup = this.config.importGroups.find((g) => {
      if (!g.regex) return false;
      return g.regex && this.patterns.subfolderPattern && g.regex.toString().includes(this.patterns.subfolderPattern.toString().slice(1, -1));
    });

    const appGroupOrder = appGroup ? appGroup.order : 2;
    const appGroupPriority = appGroup ? appGroup.priority : undefined;

    const sortedSubfolders = Array.from(appSubfolderGroups.keys()).sort();

    for (const subfolderName of sortedSubfolders) {
      const subfolderImports = appSubfolderGroups.get(subfolderName)!;
      if (subfolderImports.length > 0) {
        const subfolderGroup = {
          name: subfolderName,
          order: appGroupOrder,
          imports: subfolderImports,
        };

        if (appGroupPriority !== undefined) {
          configGroupMap.set(subfolderName, {
            order: appGroupOrder,
            priority: appGroupPriority,
          });
        }

        result.push(subfolderGroup);
      }
    }

    return result.sort((a, b) => {
      const aConfig = configGroupMap.get(a.name);
      const bConfig = configGroupMap.get(b.name);

      if (aConfig?.priority !== undefined && bConfig?.priority !== undefined) {
        const priorityDiff = bConfig.priority - aConfig.priority;
        if (priorityDiff !== 0) return priorityDiff;
      }

      if (a.order !== b.order) {
        return a.order - b.order;
      }

      return a.name.localeCompare(b.name);
    });
  }

  private sortImportsWithinGroup(imports: ParsedImport[]): ParsedImport[] {
    return imports.sort((a, b) => {
      if (a.isPriority && !b.isPriority) return -1;
      if (!a.isPriority && b.isPriority) return 1;

      if (a.type !== b.type) {
        return this.typeOrder[a.type] - this.typeOrder[b.type];
      }

      return a.source.localeCompare(b.source);
    });
  }

  public getAppSubfolders(): string[] {
    return Array.from(this.appSubfolders).sort();
  }
}

export { ImportParser };
