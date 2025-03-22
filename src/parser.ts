import { validateAndFixImportWithBabel } from "./fixer";
import { ImportParserError } from "./errors";
import { ParserConfig, ParsedImport, ImportGroup, TypeOrder, SourcePatterns, InvalidImport, DEFAULT_CONFIG, ConfigImportGroup } from "./types";
import { validateConfig } from "./configValidator";

class ImportParser {
  private readonly config: ParserConfig;
  private readonly defaultGroupName: string;
  private readonly typeOrder: TypeOrder;
  private readonly patterns: SourcePatterns;
  private readonly priorityImportPatterns: (RegExp | string)[];

  private appSubfolders: Set<string>;

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

    // Convert import groups' regex strings to RegExp objects with case-insensitive flag
    const importGroups = config.importGroups.map(group => {
      if (group.isDefault) {
        // Default group - regex is optional
        return {
          ...group,
          isDefault: true,
          regex: group.regex ? (typeof group.regex === 'string' ? new RegExp(group.regex, 'i') : group.regex) : undefined
        };
      } else {
        // Non-default group - regex is required
        if (!group.regex) {
          throw new ImportParserError("Regex is required for non-default groups", JSON.stringify(group));
        }
        return {
          ...group,
          isDefault: false,
          regex: typeof group.regex === 'string' ? new RegExp(group.regex, 'i') : group.regex
        };
      }
    }) as ConfigImportGroup[];

    // Convert patterns to RegExp objects
    const patterns = {
      ...DEFAULT_CONFIG.patterns,
      ...(config.patterns && {
        ...config.patterns,
        appSubfolderPattern: config.patterns.appSubfolderPattern
          ? (typeof config.patterns.appSubfolderPattern === 'string'
            ? new RegExp(config.patterns.appSubfolderPattern, 'i')
            : config.patterns.appSubfolderPattern)
          : undefined
      })
    };

    // Convert priority imports to RegExp objects
    const priorityImports = config.priorityImports?.map(regex =>
      typeof regex === 'string' ? new RegExp(regex, 'i') : regex
    );

    this.config = {
      ...config,
      importGroups,
      typeOrder: { ...(DEFAULT_CONFIG.typeOrder as TypeOrder), ...(config.typeOrder ?? {}) } as TypeOrder,
      patterns,
      priorityImports
    };

    this.appSubfolders = new Set<string>();

    if (config.defaultGroupName) {
      this.defaultGroupName = config.defaultGroupName;
    } else {
      const defaultGroup = config.importGroups.find((g) => g.isDefault);
      this.defaultGroupName = defaultGroup ? defaultGroup.name : "Misc";
    }

    this.typeOrder = this.config.typeOrder as TypeOrder;
    this.patterns = this.config.patterns as SourcePatterns;
    this.priorityImportPatterns = this.config.priorityImports ?? [];
  }

  public parse(sourceCode: string): {
    groups: ImportGroup[];
    originalImports: string[];
    invalidImports: InvalidImport[];
  } {
    const importRegex = /(?:^|\n)\s*import\s+(?:(?:type\s+)?(?:{[^;]*}|\*\s*as\s*\w+|\w+)?(?:\s*,\s*(?:{[^;]*}|\*\s*as\s*\w+|\w+))?(?:\s*from)?\s*['"]?[^'";]+['"]?;?|['"][^'"]+['"];?)/g;

    const originalImports: string[] = [];
    const invalidImports: InvalidImport[] = [];

    const potentialImportLines: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = importRegex.exec(sourceCode)) !== null) {
      let importStmt = match[0].trim();

      if (!importStmt) {
        continue;
      }

      if (!importStmt.startsWith("import")) {
        const importIndex = match[0].indexOf("import");
        if (importIndex >= 0) {
          importStmt = match[0].substring(importIndex).trim();
        } else {
          continue;
        }
      }

      if (!importStmt.includes(";")) {
        let searchEnd = match.index + match[0].length;
        let nextLine = "";

        do {
          const nextLineStart = searchEnd + 1;
          searchEnd = sourceCode.indexOf("\n", nextLineStart);
          if (searchEnd === -1) searchEnd = sourceCode.length;

          nextLine = sourceCode.substring(nextLineStart, searchEnd).trim();

          if (nextLine && !nextLine.startsWith("import") && !nextLine.startsWith("//")) {
            importStmt += "\n" + nextLine;
          }
        } while (!importStmt.includes(";") && nextLine && !nextLine.startsWith("import") && searchEnd < sourceCode.length);
      }

      const trimmedImport = importStmt.trim();
      if (trimmedImport) {
        potentialImportLines.push(trimmedImport);
      }
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
      const isTypeImport = importStmt.includes("import type");
      const isSideEffect = !importStmt.includes(" from ");

      const sourceMatch = importStmt.match(/from\s+['"]([^'"]+)['"]/);
      const source = sourceMatch ? sourceMatch[1] : importStmt.match(/import\s+['"]([^'"]+)['"]/)?.[1] ?? "";

      if (!source) {
        throw new ImportParserError("Impossible d'extraire la source du module d'import", importStmt);
      }

      const isPriority = this.isSourcePriority(source);

      const groupName = this.determineGroupName(source);

      let appSubfolder: string | null = null;

      if (this.patterns.appSubfolderPattern) {
        const pattern = typeof this.patterns.appSubfolderPattern === 'string'
          ? new RegExp(this.patterns.appSubfolderPattern, 'i')
          : this.patterns.appSubfolderPattern;
        const appSubfolderMatch = source.match(pattern);
        if (appSubfolderMatch?.[1]) {
          appSubfolder = appSubfolderMatch[1];
          this.appSubfolders.add(appSubfolder);
        }
      }

      let type: "default" | "named" | "typeDefault" | "typeNamed" | "sideEffect" = "default";
      let specifiers: string[] = [];

      if (isSideEffect) {
        type = "sideEffect";
      } else if (isTypeImport) {
        if (importStmt.includes("{")) {
          type = "typeNamed";
          const namedMatch = importStmt.match(/import\s+type\s+{([^}]+)}/);
          if (namedMatch) {
            specifiers = namedMatch[1]
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s !== "");
          }
        } else {
          type = "typeDefault";
          const defaultMatch = importStmt.match(/import\s+type\s+(\w+|\*\s+as\s+\w+)/);
          if (defaultMatch) {
            specifiers = [defaultMatch[1]];
          }
        }
      } else if (importStmt.includes("{")) {
        type = "named";
        const namedMatch = importStmt.match(/import\s+(?:\w+\s*,\s*)?{([^}]+)}/);

        const defaultWithNamedMatch = importStmt.match(/import\s+(\w+|\*\s+as\s+\w+)\s*,\s*{/);
        const defaultSpecifier = defaultWithNamedMatch ? defaultWithNamedMatch[1] : null;

        if (namedMatch) {
          const rawSpecifiers = namedMatch[1]
            .split(/,|\n/)
            .map((s) => s.trim())
            .filter((s) => s !== "");

          const regularSpecifiers: string[] = [];
          const typeSpecifiers: string[] = [];

          for (const spec of rawSpecifiers) {
            if (spec.startsWith("type ")) {
              typeSpecifiers.push(spec.substring(5).trim());
            } else {
              regularSpecifiers.push(spec);
            }
          }

          const deduplicatedRegularSpecifiers = this.deduplicateSpecifiers(regularSpecifiers);

          if (typeSpecifiers.length > 0) {
            const result: ParsedImport[] = [];
            if (defaultSpecifier) {
              result.push({ type: "default", source, specifiers: [defaultSpecifier], raw: importStmt, groupName, isPriority, appSubfolder });
            }
            if (deduplicatedRegularSpecifiers.length > 0) {
              result.push({ type: "named", source, specifiers: deduplicatedRegularSpecifiers, raw: importStmt, groupName, isPriority, appSubfolder });
            }
            const deduplicatedTypeSpecifiers = this.deduplicateSpecifiers(typeSpecifiers);
            result.push({ type: "typeNamed", source, specifiers: deduplicatedTypeSpecifiers, raw: importStmt, groupName, isPriority, appSubfolder });
            return result;
          }

          specifiers = deduplicatedRegularSpecifiers;

          if (defaultSpecifier) {
            type = "default";
            specifiers.unshift(defaultSpecifier);
          }
        }
      } else if (importStmt.includes("* as ")) {
        const namespaceMatch = importStmt.match(/import\s+\*\s+as\s+(\w+)/);
        if (namespaceMatch) {
          type = "default";
          specifiers = [namespaceMatch[1]];
        }
      } else {
        type = "default";
        const defaultMatch = importStmt.match(/import\s+(\w+|\*\s+as\s+\w+)/);
        if (defaultMatch) {
          specifiers = [defaultMatch[1]];
        }
      }

      if (!isSideEffect && specifiers.length === 0) {
        throw new ImportParserError("Aucun spécificateur trouvé dans l'import", importStmt);
      }

      return {
        type,
        source,
        specifiers,
        raw: importStmt,
        groupName,
        isPriority,
        appSubfolder,
      };
    } catch (error) {
      if (error instanceof ImportParserError) {
        throw error;
      }

      throw new ImportParserError(`Erreur lors du parsing de l'import: ${error instanceof Error ? error.message : String(error)}`, importStmt);
    }
  }

  private deduplicateSpecifiers(specifiers: string[]): string[] {
    const uniqueSpecs = new Map<string, string>();

    for (const spec of specifiers) {
      const isTypeSpec = spec.startsWith("type ");
      const specWithoutType = isTypeSpec ? spec.substring(5).trim() : spec;

      let baseSpecName: string;
      const fullSpec = spec;

      if (specWithoutType.includes(" as ")) {
        const [baseName] = specWithoutType.split(" as ");
        baseSpecName = baseName.trim();
      } else {
        baseSpecName = specWithoutType;
      }

      const uniqueKey = (isTypeSpec ? "type_" : "") + baseSpecName;

      if (!uniqueSpecs.has(uniqueKey)) {
        uniqueSpecs.set(uniqueKey, fullSpec);
      }
    }

    return Array.from(uniqueSpecs.values());
  }

  private preprocessImport(importStmt: string): string {
    if (!importStmt.includes("{")) {
      return importStmt;
    }

    try {
      const importMatch = importStmt.match(/^(import\s+(?:type\s+)?)({[^}]*})(\s+from\s+.+)$/);
      if (!importMatch) {
        return importStmt;
      }

      const [prefix, specifiersBlock, suffix] = importMatch;

      const specifiersContent = specifiersBlock.substring(1, specifiersBlock.length - 1);
      const specifiers = specifiersContent
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const uniqueSpecifiers = this.deduplicateSpecifiers(specifiers);

      const correctedSpecifiers = uniqueSpecifiers.join(", ");
      return `${prefix}{${correctedSpecifiers}}${suffix}`;
    } catch {
      return importStmt;
    }
  }

  private isSourcePriority(source: string): boolean {
    if (this.priorityImportPatterns.length > 0) {
      return this.priorityImportPatterns.some((pattern) => {
        const regexObj = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
        return regexObj.test(source);
      });
    }

    const defaultGroup = this.config.importGroups.find((group) => group.isDefault);
    if (defaultGroup?.regex) {
      const regexObj = typeof defaultGroup.regex === 'string' ? new RegExp(defaultGroup.regex, 'i') : defaultGroup.regex;
      const regexStr = regexObj.toString();
      const match = regexStr.match(/\(\s*([^|)]+)/);
      if (match?.[1]) {
        const firstPattern = match[1].replace(/[^a-zA-Z0-9\-_]/g, "");
        return new RegExp(`^${firstPattern}`).test(source);
      }
    }

    return false;
  }

  private cleanImportStatement(importStmt: string): string {
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

    let cleaned = cleanedLines.join(" ").trim();

    if (!cleaned.endsWith(";")) {
      cleaned += ";";
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

  private determineGroupName(source: string): string {
    // Trouver les groupes qui correspondent au pattern, en excluant le groupe par défaut
    const matchingGroups = this.config.importGroups.filter(group => {
      // Pour un groupe par défaut, on ne vérifie pas le regex
      if (group.isDefault) {
        return false;
      }
      // Pour les autres groupes, on vérifie le regex
      if (!group.regex) return false;
      const regexObj = typeof group.regex === 'string' ? new RegExp(group.regex, 'i') : group.regex;
      return regexObj.test(source);
    });

    if (matchingGroups.length === 0) {
      // Si aucun groupe ne correspond, utiliser le groupe par défaut
      const defaultGroup = this.config.importGroups.find((group) => group.isDefault);
      return defaultGroup ? defaultGroup.name : this.defaultGroupName;
    }

    if (matchingGroups.length === 1) {
      return matchingGroups[0].name;
    }

    // Grouper d'abord par priorité
    const groupsByPriority = new Map<number | undefined, typeof matchingGroups>();
    matchingGroups.forEach(group => {
      const priority = group.priority;
      if (!groupsByPriority.has(priority)) {
        groupsByPriority.set(priority, []);
      }
      groupsByPriority.get(priority)!.push(group);
    });

    // Traiter d'abord les groupes avec priorité
    const priorityGroups = Array.from(groupsByPriority.entries())
      .filter(([priority]) => priority !== undefined)
      .sort(([a], [b]) => (b as number) - (a as number));

    if (priorityGroups.length > 0) {
      const [, highestPriorityGroups] = priorityGroups[0];

      if (highestPriorityGroups.length > 1) {
        // Pour la même priorité, utiliser la spécificité de la regex
        return highestPriorityGroups.sort((a, b) => {
          // Comparer la longueur des patterns pour une estimation de la spécificité
          const aPattern = a.regex?.toString().replace(/[/^$|]/g, '') ?? '';
          const bPattern = b.regex?.toString().replace(/[/^$|]/g, '') ?? '';

          if (aPattern.length !== bPattern.length) {
            return bPattern.length - aPattern.length; // Plus long = plus spécifique
          }

          // Si même spécificité, utiliser l'ordre puis le nom
          if (a.order !== b.order) {
            return a.order - b.order;
          }

          return a.name.localeCompare(b.name);
        })[0].name;
      }

      return highestPriorityGroups[0].name;
    }

    // Pour les groupes sans priorité
    return matchingGroups.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return 1;
      if (!a.isDefault && b.isDefault) return -1;

      // Comparer la spécificité des regex
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

    if (!groupMap.has(this.defaultGroupName)) {
      const defaultOrder = 999;
      groupMap.set(this.defaultGroupName, []);
      configGroupMap.set(this.defaultGroupName, {
        order: defaultOrder,
        priority: 0,
      });
    }

    imports.forEach((importObj) => {
      if (importObj.appSubfolder) {
        const subfolder = importObj.appSubfolder;
        const groupName = `@app/${subfolder}`;

        if (!appSubfolderGroups.has(groupName)) {
          appSubfolderGroups.set(groupName, []);
        }

        appSubfolderGroups.get(groupName)!.push(importObj);
      } else if (importObj.groupName && groupMap.has(importObj.groupName)) {
        groupMap.get(importObj.groupName)!.push(importObj);
      } else {
        groupMap.get(this.defaultGroupName)!.push(importObj);
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
      const regexObj = typeof g.regex === 'string' ? new RegExp(g.regex, 'i') : g.regex;
      return regexObj.toString().includes("@app");
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
