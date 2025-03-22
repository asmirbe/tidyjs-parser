"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportParser = void 0;
const fixer_1 = require("./fixer");
const errors_1 = require("./errors");
const types_1 = require("./types");
class ImportParser {
    constructor(config) {
        this.config = {
            ...config,
            typeOrder: { ...types_1.DEFAULT_CONFIG.typeOrder, ...(config.typeOrder ?? {}) },
            patterns: { ...types_1.DEFAULT_CONFIG.patterns, ...config.patterns },
        };
        this.appSubfolders = new Set();
        if (config.defaultGroupName) {
            this.defaultGroupName = config.defaultGroupName;
        }
        else {
            const defaultGroup = config.importGroups.find((g) => g.isDefault);
            this.defaultGroupName = defaultGroup ? defaultGroup.name : "Misc";
        }
        this.typeOrder = this.config.typeOrder;
        this.patterns = this.config.patterns;
        this.priorityImportPatterns = this.config.priorityImports ?? [];
    }
    parse(sourceCode) {
        // Utiliser le code source tel quel, sans normalisation
        const importRegex = /(?:^|\n)\s*import\s+(?:(?:type\s+)?(?:{[^;]*}|\*\s*as\s*\w+|\w+)?(?:\s*,\s*(?:{[^;]*}|\*\s*as\s*\w+|\w+))?(?:\s*from)?\s*['"]?[^'";]+['"]?;?|['"][^'"]+['"];?)/g;
        const originalImports = [];
        const invalidImports = [];
        const potentialImportLines = [];
        let match;
        while ((match = importRegex.exec(sourceCode)) !== null) {
            // Extraire l'import en ignorant les sauts de ligne au début
            let importStmt = match[0].trim();
            // Si l'import est vide après le trim, c'est probablement juste un saut de ligne
            if (!importStmt) {
                continue;
            }
            // S'assurer que l'import commence par "import"
            if (!importStmt.startsWith("import")) {
                const importIndex = match[0].indexOf("import");
                if (importIndex >= 0) {
                    importStmt = match[0].substring(importIndex).trim();
                }
                else {
                    continue; // Pas un import valide
                }
            }
            // Gérer les imports multi-lignes
            if (!importStmt.includes(";")) {
                let searchEnd = match.index + match[0].length;
                let nextLine = "";
                do {
                    const nextLineStart = searchEnd + 1;
                    searchEnd = sourceCode.indexOf("\n", nextLineStart);
                    if (searchEnd === -1)
                        searchEnd = sourceCode.length;
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
        let parsedImports = [];
        for (const importStmt of potentialImportLines) {
            try {
                originalImports.push(importStmt);
                const { fixed, isValid, error } = (0, fixer_1.validateAndFixImportWithBabel)(importStmt);
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
                }
                else {
                    parsedImports.push(imports);
                }
            }
            catch (error) {
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
    parseImport(importStmt) {
        try {
            const isTypeImport = importStmt.includes("import type");
            const isSideEffect = !importStmt.includes(" from ");
            const sourceMatch = importStmt.match(/from\s+['"]([^'"]+)['"]/);
            const source = sourceMatch ? sourceMatch[1] : importStmt.match(/import\s+['"]([^'"]+)['"]/)?.[1] ?? "";
            if (!source) {
                throw new errors_1.ImportParserError("Impossible d'extraire la source du module d'import", importStmt);
            }
            const isPriority = this.isSourcePriority(source);
            const groupName = this.determineGroupName(source);
            let appSubfolder = null;
            if (this.patterns.appSubfolderPattern) {
                const appSubfolderMatch = source.match(this.patterns.appSubfolderPattern);
                if (appSubfolderMatch?.[1]) {
                    appSubfolder = appSubfolderMatch[1];
                    this.appSubfolders.add(appSubfolder);
                }
            }
            let type = "default";
            let specifiers = [];
            if (isSideEffect) {
                type = "sideEffect";
            }
            else if (isTypeImport) {
                if (importStmt.includes("{")) {
                    type = "typeNamed";
                    const namedMatch = importStmt.match(/import\s+type\s+{([^}]+)}/);
                    if (namedMatch) {
                        specifiers = namedMatch[1]
                            .split(",")
                            .map((s) => s.trim())
                            .filter((s) => s !== "");
                    }
                }
                else {
                    type = "typeDefault";
                    const defaultMatch = importStmt.match(/import\s+type\s+(\w+|\*\s+as\s+\w+)/);
                    if (defaultMatch) {
                        specifiers = [defaultMatch[1]];
                    }
                }
            }
            else if (importStmt.includes("{")) {
                type = "named";
                const namedMatch = importStmt.match(/import\s+(?:\w+\s*,\s*)?{([^}]+)}/);
                const defaultWithNamedMatch = importStmt.match(/import\s+(\w+|\*\s+as\s+\w+)\s*,\s*{/);
                const defaultSpecifier = defaultWithNamedMatch ? defaultWithNamedMatch[1] : null;
                if (namedMatch) {
                    const rawSpecifiers = namedMatch[1]
                        .split(/,|\n/)
                        .map((s) => s.trim())
                        .filter((s) => s !== "");
                    const regularSpecifiers = [];
                    const typeSpecifiers = [];
                    for (const spec of rawSpecifiers) {
                        if (spec.startsWith("type ")) {
                            typeSpecifiers.push(spec.substring(5).trim());
                        }
                        else {
                            regularSpecifiers.push(spec);
                        }
                    }
                    const deduplicatedRegularSpecifiers = this.deduplicateSpecifiers(regularSpecifiers);
                    if (typeSpecifiers.length > 0) {
                        const result = [];
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
            }
            else if (importStmt.includes("* as ")) {
                const namespaceMatch = importStmt.match(/import\s+\*\s+as\s+(\w+)/);
                if (namespaceMatch) {
                    type = "default";
                    specifiers = [namespaceMatch[1]];
                }
            }
            else {
                type = "default";
                const defaultMatch = importStmt.match(/import\s+(\w+|\*\s+as\s+\w+)/);
                if (defaultMatch) {
                    specifiers = [defaultMatch[1]];
                }
            }
            if (!isSideEffect && specifiers.length === 0) {
                throw new errors_1.ImportParserError("Aucun spécificateur trouvé dans l'import", importStmt);
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
        }
        catch (error) {
            if (error instanceof errors_1.ImportParserError) {
                throw error;
            }
            throw new errors_1.ImportParserError(`Erreur lors du parsing de l'import: ${error instanceof Error ? error.message : String(error)}`, importStmt);
        }
    }
    deduplicateSpecifiers(specifiers) {
        const uniqueSpecs = new Map();
        for (const spec of specifiers) {
            const isTypeSpec = spec.startsWith("type ");
            const specWithoutType = isTypeSpec ? spec.substring(5).trim() : spec;
            let baseSpecName;
            const fullSpec = spec;
            if (specWithoutType.includes(" as ")) {
                const [baseName] = specWithoutType.split(" as ");
                baseSpecName = baseName.trim();
            }
            else {
                baseSpecName = specWithoutType;
            }
            const uniqueKey = (isTypeSpec ? "type_" : "") + baseSpecName;
            if (!uniqueSpecs.has(uniqueKey)) {
                uniqueSpecs.set(uniqueKey, fullSpec);
            }
        }
        return Array.from(uniqueSpecs.values());
    }
    preprocessImport(importStmt) {
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
        }
        catch {
            return importStmt;
        }
    }
    isSourcePriority(source) {
        if (this.priorityImportPatterns.length > 0) {
            return this.priorityImportPatterns.some((pattern) => pattern.test(source));
        }
        const defaultGroup = this.config.importGroups.find((group) => group.isDefault);
        if (defaultGroup) {
            const regexStr = defaultGroup.regex.toString();
            const match = regexStr.match(/\(\s*([^|)]+)/);
            if (match?.[1]) {
                const firstPattern = match[1].replace(/[^a-zA-Z0-9\-_]/g, "");
                return new RegExp(`^${firstPattern}`).test(source);
            }
        }
        return false;
    }
    cleanImportStatement(importStmt) {
        const lines = importStmt.split("\n");
        const cleanedLines = [];
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
    mergeImports(imports) {
        const mergedImportsMap = new Map();
        for (const importObj of imports) {
            const cleanedRaw = this.cleanImportStatement(importObj.raw);
            const key = `${importObj.type}:${importObj.source}`;
            if (mergedImportsMap.has(key)) {
                const existingImport = mergedImportsMap.get(key);
                const specifiersSet = new Set([...existingImport.specifiers, ...importObj.specifiers]);
                existingImport.specifiers = Array.from(specifiersSet).sort();
                if (cleanedRaw.length > this.cleanImportStatement(existingImport.raw).length) {
                    existingImport.raw = cleanedRaw;
                }
                this.validateSpecifiersConsistency(existingImport);
            }
            else {
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
    validateSpecifiersConsistency(importObj) {
        if (importObj.type === "named" || importObj.type === "typeNamed") {
            const prefix = importObj.type === "typeNamed" ? "import type " : "import ";
            const specifiersStr = `{ ${importObj.specifiers.join(", ")} }`;
            const reconstructed = `${prefix}${specifiersStr} from '${importObj.source}';`;
            if (!this.areImportsSemanticallyEquivalent(importObj.raw, reconstructed)) {
                importObj.raw = reconstructed;
            }
        }
        else if (importObj.type === "default" || importObj.type === "typeDefault") {
            const prefix = importObj.type === "typeDefault" ? "import type " : "import ";
            const reconstructed = `${prefix}${importObj.specifiers[0]} from '${importObj.source}';`;
            if (!this.areImportsSemanticallyEquivalent(importObj.raw, reconstructed)) {
                importObj.raw = reconstructed;
            }
        }
    }
    areImportsSemanticallyEquivalent(import1, import2) {
        const normalize = (str) => str.replace(/\s+/g, " ").trim();
        const extractParts = (importStr) => {
            const typeMatch = importStr.includes("import type");
            const sourceMatch = importStr.match(/from\s+['"]([^'"]+)['"]/);
            const source = sourceMatch ? sourceMatch[1] : "";
            const specifiers = [];
            if (importStr.includes("{")) {
                const specifiersMatch = importStr.match(/{([^}]*)}/);
                if (specifiersMatch) {
                    specifiers.push(...specifiersMatch[1]
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean));
                }
            }
            else if (!importStr.includes("{") && importStr.includes("import")) {
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
    determineGroupName(source) {
        // Séparer les groupes normaux et le groupe par défaut
        const defaultGroup = this.config.importGroups.find((group) => group.isDefault);
        const normalGroups = this.config.importGroups.filter((group) => !group.isDefault);
        // Tester d'abord tous les groupes non-défaut
        for (const group of normalGroups) {
            if (group.regex.test(source)) {
                return group.name;
            }
        }
        // Si aucun groupe normal ne correspond, utiliser le groupe par défaut
        if (defaultGroup) {
            return defaultGroup.name;
        }
        return this.defaultGroupName;
    }
    organizeImportsIntoGroups(imports) {
        const groupMap = new Map();
        const appSubfolderGroups = new Map();
        const configGroupMap = new Map();
        this.config.importGroups.forEach((group) => {
            configGroupMap.set(group.name, group.order);
            groupMap.set(group.name, []);
        });
        if (!groupMap.has(this.defaultGroupName)) {
            const defaultOrder = 999;
            groupMap.set(this.defaultGroupName, []);
            configGroupMap.set(this.defaultGroupName, defaultOrder);
        }
        imports.forEach((importObj) => {
            if (importObj.appSubfolder) {
                const subfolder = importObj.appSubfolder;
                const groupName = `@app/${subfolder}`;
                if (!appSubfolderGroups.has(groupName)) {
                    appSubfolderGroups.set(groupName, []);
                }
                appSubfolderGroups.get(groupName).push(importObj);
            }
            else if (importObj.groupName && groupMap.has(importObj.groupName)) {
                groupMap.get(importObj.groupName).push(importObj);
            }
            else {
                groupMap.get(this.defaultGroupName).push(importObj);
            }
        });
        groupMap.forEach((importsInGroup, groupName) => {
            groupMap.set(groupName, this.sortImportsWithinGroup(importsInGroup));
        });
        appSubfolderGroups.forEach((importsInGroup, groupName) => {
            appSubfolderGroups.set(groupName, this.sortImportsWithinGroup(importsInGroup));
        });
        const result = [];
        for (const [name, importsInGroup] of groupMap.entries()) {
            const order = configGroupMap.get(name) ?? 999;
            if (importsInGroup.length > 0) {
                result.push({
                    name,
                    order,
                    imports: importsInGroup,
                });
            }
        }
        const appGroup = this.config.importGroups.find((g) => g.regex.toString().includes("@app"));
        const appGroupOrder = appGroup ? appGroup.order : 2;
        const sortedSubfolders = Array.from(appSubfolderGroups.keys()).sort();
        for (const subfolderName of sortedSubfolders) {
            const subfolderImports = appSubfolderGroups.get(subfolderName);
            if (subfolderImports.length > 0) {
                result.push({
                    name: subfolderName,
                    order: appGroupOrder,
                    imports: subfolderImports,
                });
            }
        }
        return result.sort((a, b) => {
            if (a.order === b.order) {
                return a.name.localeCompare(b.name);
            }
            return a.order - b.order;
        });
    }
    sortImportsWithinGroup(imports) {
        return imports.sort((a, b) => {
            if (a.isPriority && !b.isPriority)
                return -1;
            if (!a.isPriority && b.isPriority)
                return 1;
            if (a.type !== b.type) {
                return this.typeOrder[a.type] - this.typeOrder[b.type];
            }
            return a.source.localeCompare(b.source);
        });
    }
    getAppSubfolders() {
        return Array.from(this.appSubfolders).sort();
    }
}
exports.ImportParser = ImportParser;
