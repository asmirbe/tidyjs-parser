"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportParser = void 0;
const fixer_1 = require("./fixer");
const errors_1 = require("./errors");
const types_1 = require("./types");
const validator_1 = require("./validator");
class ImportParser {
    extractPatternsFromRegex(regexStr) {
        const match = regexStr.match(/\(\s*([^)]+)\)/);
        if (!match?.[1])
            return [];
        return match[1].split('|').map(p => p.trim());
    }
    findMatchIndexInRegex(source, regex) {
        const regexStr = regex.toString();
        const patterns = this.extractPatternsFromRegex(regexStr);
        for (let i = 0; i < patterns.length; i++) {
            if (new RegExp(patterns[i]).test(source)) {
                return i;
            }
        }
        return patterns.length;
    }
    constructor(config) {
        const validation = (0, validator_1.validateConfig)(config);
        if (!validation.isValid) {
            throw new errors_1.ImportParserError(`Configuration invalide:\n${validation.errors.map(err => `  - [${err.field}] ${err.message}${err.suggestion ? `\n    Suggestion: ${err.suggestion}` : ''}`).join('\n')}`, JSON.stringify(config, null, 2));
        }
        if (validation.warnings.length > 0) {
            console.warn(`Avertissements de configuration:\n${validation.warnings.map(warn => `  - [${warn.field}] ${warn.message}${warn.suggestion ? `\n    Suggestion: ${warn.suggestion}` : ''}`).join('\n')}`);
        }
        const importGroups = config.importGroups.map(group => {
            if (group.isDefault) {
                return {
                    ...group,
                    isDefault: true
                };
            }
            else {
                if (!group.regex) {
                    throw new errors_1.ImportParserError("Regex is required for non-default groups", JSON.stringify(group));
                }
                return {
                    ...group,
                    isDefault: false
                };
            }
        });
        const patterns = {
            ...types_1.DEFAULT_CONFIG.patterns,
            ...(config.patterns)
        };
        this.config = {
            ...config,
            importGroups,
            typeOrder: { ...types_1.DEFAULT_CONFIG.typeOrder, ...(config.typeOrder ?? {}) },
            patterns
        };
        this.appSubfolders = new Set();
        const defaultGroup = config.importGroups.find((g) => g.isDefault);
        this.defaultGroup = defaultGroup ? defaultGroup.name : "Misc";
        this.typeOrder = this.config.typeOrder;
        this.patterns = this.config.patterns;
    }
    removeComments(code) {
        let result = "";
        let inMultiLineComment = false;
        let i = 0;
        while (i < code.length) {
            // Si on est dans un commentaire multi-lignes
            if (inMultiLineComment) {
                if (code[i] === '*' && code[i + 1] === '/') {
                    inMultiLineComment = false;
                    // Remplacer le commentaire par des espaces mais garder les retours à la ligne
                    result += "  ";
                    i += 2;
                    continue;
                }
                // Préserver les retours à la ligne
                if (code[i] === '\n') {
                    result += '\n';
                }
                else {
                    result += ' ';
                }
                i++;
                continue;
            }
            // Détecter le début d'un commentaire multi-lignes
            if (code[i] === '/' && code[i + 1] === '*') {
                inMultiLineComment = true;
                i += 2;
                continue;
            }
            // Détecter un commentaire sur une ligne
            if (code[i] === '/' && code[i + 1] === '/') {
                // Aller jusqu'à la fin de la ligne
                while (i < code.length && code[i] !== '\n') {
                    result += ' '; // Remplacer par des espaces
                    i++;
                }
                continue;
            }
            result += code[i];
            i++;
        }
        return result;
    }
    parse(sourceCode) {
        // Nettoyer d'abord le code des commentaires
        const cleanedCode = this.removeComments(sourceCode);
        const importRegex = /(?:^|\n)\s*import\s+(?:(?:type\s+)?(?:{[^;]*}|\*\s*as\s*\w+|\w+)?(?:\s*,\s*(?:{[^;]*}|\*\s*as\s*\w+|\w+))?(?:\s*from)?\s*['"]?[^'";]+['"]?;?|['"][^'"]+['"];?)/g;
        const originalImports = [];
        const invalidImports = [];
        const potentialImportLines = [];
        let match;
        while ((match = importRegex.exec(cleanedCode)) !== null) {
            let importStmt = cleanedCode.substring(match.index, match.index + match[0].length).trim();
            // Si la ligne ne commence pas par "import" après nettoyage des commentaires, ce n'est pas un import valide
            if (!importStmt || !importStmt.trim().startsWith("import")) {
                continue;
            }
            // Vérifier si l'import est complet (avec point-virgule)
            if (!importStmt.includes(";")) {
                let searchEnd = match.index + match[0].length;
                let nextLine = "";
                do {
                    const nextLineStart = searchEnd + 1;
                    searchEnd = cleanedCode.indexOf("\n", nextLineStart);
                    if (searchEnd === -1)
                        searchEnd = cleanedCode.length;
                    nextLine = cleanedCode.substring(nextLineStart, searchEnd).trim();
                    if (nextLine && !nextLine.startsWith("import")) {
                        importStmt += "\n" + nextLine;
                    }
                } while (!importStmt.includes(";") && nextLine && !nextLine.startsWith("import") && searchEnd < cleanedCode.length);
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
            if (this.patterns.subfolderPattern) {
                const appSubfolderMatch = source.match(this.patterns.subfolderPattern);
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
    isSourcePriority(source) {
        const currentGroup = this.config.importGroups.find(group => {
            if (!group.regex)
                return false;
            return group.regex.test(source);
        });
        if (!currentGroup?.regex)
            return false;
        const regexStr = currentGroup.regex.toString();
        if (!regexStr.includes('(') || !regexStr.includes('|'))
            return false;
        // Utiliser findMatchIndexInRegex pour déterminer si la source correspond au premier pattern
        return this.findMatchIndexInRegex(source, currentGroup.regex) === 0;
    }
    determineGroupName(source) {
        const defaultGroup = this.config.importGroups.find((group) => group.isDefault);
        const defaultGroupName = defaultGroup ? defaultGroup.name : this.defaultGroup;
        const matchingGroups = this.config.importGroups.filter(group => {
            if (group.isDefault)
                return false;
            if (!group.regex)
                return false;
            return group.regex.test(source);
        });
        if (matchingGroups.length === 0) {
            return defaultGroupName;
        }
        if (matchingGroups.length === 1) {
            return matchingGroups[0].name;
        }
        const groupsByPriority = new Map();
        matchingGroups.forEach(group => {
            const priority = group.priority;
            if (!groupsByPriority.has(priority)) {
                groupsByPriority.set(priority, []);
            }
            groupsByPriority.get(priority).push(group);
        });
        const priorityGroups = Array.from(groupsByPriority.entries())
            .filter(([priority]) => priority !== undefined)
            .sort(([a], [b]) => b - a);
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
            if (a.isDefault && !b.isDefault)
                return 1;
            if (!a.isDefault && b.isDefault)
                return -1;
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
    cleanImportStatement(importStmt) {
        const lines = importStmt.split("\n");
        const cleanedLines = [];
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
    organizeImportsIntoGroups(imports) {
        const groupMap = new Map();
        const appSubfolderGroups = new Map();
        const configGroupMap = new Map();
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
                appSubfolderGroups.get(groupName).push(importObj);
            }
            else if (importObj.groupName && groupMap.has(importObj.groupName)) {
                groupMap.get(importObj.groupName).push(importObj);
            }
            else {
                groupMap.get(this.defaultGroup).push(importObj);
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
            if (!g.regex)
                return false;
            return g.regex && this.patterns.subfolderPattern && g.regex.toString().includes(this.patterns.subfolderPattern.toString().slice(1, -1));
        });
        const appGroupOrder = appGroup ? appGroup.order : 2;
        const appGroupPriority = appGroup ? appGroup.priority : undefined;
        const sortedSubfolders = Array.from(appSubfolderGroups.keys()).sort();
        for (const subfolderName of sortedSubfolders) {
            const subfolderImports = appSubfolderGroups.get(subfolderName);
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
                if (priorityDiff !== 0)
                    return priorityDiff;
            }
            if (a.order !== b.order) {
                return a.order - b.order;
            }
            return a.name.localeCompare(b.name);
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
