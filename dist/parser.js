"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportParser = void 0;
const parser_1 = require("@babel/parser");
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
                if (!group.match) {
                    throw new errors_1.ImportParserError("Match is required for non-default groups", JSON.stringify(group));
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
        this.subFolders = new Set();
        const defaultGroup = config.importGroups.find((g) => g.isDefault);
        this.defaultGroup = defaultGroup ? defaultGroup.name : "Misc";
        this.typeOrder = this.config.typeOrder;
        this.patterns = this.config.patterns;
    }
    parse(sourceCode) {
        const originalImports = [];
        const invalidImports = [];
        const potentialImportLines = [];
        try {
            const ast = (0, parser_1.parse)(sourceCode, {
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
        }
        catch (error) {
            invalidImports.push({
                raw: sourceCode,
                error: error instanceof Error ? error.message : String(error),
            });
            return { groups: [], originalImports, invalidImports };
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
                const currentImports = Array.isArray(imports) ? imports : [imports];
                for (const newImport of currentImports) {
                    // Gérer spécifiquement les imports par défaut (et typeDefault) pour les fusionner immédiatement
                    if (newImport.type === 'default' || newImport.type === 'typeDefault') {
                        const existingImportIndex = parsedImports.findIndex(p => (p.type === 'default' || p.type === 'typeDefault') && p.source === newImport.source);
                        if (existingImportIndex !== -1) {
                            // Import par défaut existant trouvé pour cette source.
                            // Remplacer le spécificateur existant par le nouveau (le dernier rencontré).
                            // Il ne peut y avoir qu'un seul spécificateur pour un import par défaut.
                            const existingImport = parsedImports[existingImportIndex];
                            existingImport.specifiers = [...newImport.specifiers]; // Prend le dernier spécificateur
                            existingImport.raw = newImport.raw; // Utiliser aussi le raw du dernier import rencontré
                            // Si le nouvel import est 'typeDefault' et l'existant est 'default', promouvoir en 'typeDefault'.
                            // Ou si l'existant est 'typeDefault', il le reste.
                            if (newImport.type === 'typeDefault' && existingImport.type === 'default') {
                                existingImport.type = 'typeDefault';
                            }
                            // La mise à jour du 'raw' sera gérée par mergeImports plus tard si nécessaire.
                        }
                        else {
                            // Aucun import par défaut existant pour cette source, ajouter le nouveau
                            parsedImports.push(newImport);
                        }
                    }
                    else {
                        // Pour les autres types (named, sideEffect, etc.), les ajouter directement.
                        // mergeImports s'occupera de fusionner les imports nommés plus tard.
                        parsedImports.push(newImport);
                    }
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
            const ast = (0, parser_1.parse)(importStmt, {
                sourceType: "module",
                plugins: ["typescript"],
                errorRecovery: true,
            });
            const importNode = ast.program.body[0];
            if (importNode?.type !== "ImportDeclaration") {
                throw new errors_1.ImportParserError("Invalid import statement", importStmt);
            }
            const source = importNode.source.value;
            if (!source || typeof source !== "string") {
                throw new errors_1.ImportParserError("Impossible d'extraire la source du module d'import", importStmt);
            }
            const isPriority = this.isSourcePriority(source);
            const groupName = this.determineGroupName(source);
            let appSubfolder = null;
            if (this.patterns.subfolderPattern) {
                const appSubfolderMatch = source.match(this.patterns.subfolderPattern);
                if (appSubfolderMatch?.[1]) {
                    appSubfolder = appSubfolderMatch[1];
                    this.subFolders.add(appSubfolder);
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
            const defaultImports = [];
            const namedImports = [];
            const typeImports = [];
            let hasNamed = false;
            let hasDefault = false;
            if (importNode.specifiers) {
                for (const specifier of importNode.specifiers) {
                    if (specifier.type === "ImportDefaultSpecifier") {
                        defaultImports.push(specifier.local.name);
                        hasDefault = true;
                    }
                    else if (specifier.type === "ImportNamespaceSpecifier") {
                        // For namespace imports, we keep the full "* as name" syntax
                        defaultImports.push(`* as ${specifier.local.name}`);
                        hasDefault = true;
                    }
                    else if (specifier.type === "ImportSpecifier") {
                        const importedName = specifier.imported.type === 'Identifier'
                            ? specifier.imported.name
                            : specifier.imported.value;
                        const localName = specifier.local.name;
                        const specifierStr = importedName === localName
                            ? importedName
                            : `${importedName} as ${localName}`;
                        // Vérifier si c'est un import de type individuel (comme `type FC`)
                        const isIndividualTypeImport = specifier.importKind === "type";
                        if (isTypeImport || isIndividualTypeImport) {
                            // Si c'est un import de type individuel avec le préfixe "type ", extraire le nom réel
                            const cleanedSpecifierStr = specifierStr.startsWith('type ')
                                ? specifierStr.substring(5) // Enlever "type " du début
                                : specifierStr;
                            typeImports.push(cleanedSpecifierStr);
                        }
                        else {
                            namedImports.push(specifierStr);
                        }
                        hasNamed = true;
                    }
                }
            }
            if (hasDefault && hasNamed) {
                const result = [];
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
            // Si nous avons à la fois des imports nommés et des imports de type, retourner un tableau
            if (namedImports.length > 0 && typeImports.length > 0) {
                const result = [];
                result.push({
                    type: "named",
                    source,
                    specifiers: namedImports,
                    raw: importStmt,
                    groupName,
                    isPriority,
                    appSubfolder,
                });
                result.push({
                    type: "typeNamed",
                    source,
                    specifiers: typeImports,
                    raw: importStmt,
                    groupName,
                    isPriority,
                    appSubfolder,
                });
                return result;
            }
            else if (namedImports.length > 0) {
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
            else if (typeImports.length > 0) {
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
            throw new errors_1.ImportParserError("Aucun spécificateur trouvé dans l'import", importStmt);
        }
        catch (error) {
            if (error instanceof errors_1.ImportParserError) {
                throw error;
            }
            throw new errors_1.ImportParserError(`Erreur lors du parsing de l'import: ${error instanceof Error ? error.message : String(error)}`, importStmt);
        }
    }
    isSourcePriority(source) {
        const currentGroup = this.config.importGroups.find(group => {
            if (!group.match)
                return false;
            return group.match.test(source);
        });
        if (!currentGroup?.match)
            return false;
        const regexStr = currentGroup.match.toString();
        if (!regexStr.includes('(') || !regexStr.includes('|'))
            return false;
        // Utiliser findMatchIndexInRegex pour déterminer si la source correspond au premier pattern
        return this.findMatchIndexInRegex(source, currentGroup.match) === 0;
    }
    determineGroupName(source) {
        const defaultGroup = this.config.importGroups.find((group) => group.isDefault);
        const defaultGroupName = defaultGroup ? defaultGroup.name : this.defaultGroup;
        const matchingGroups = this.config.importGroups.filter(group => {
            if (group.isDefault)
                return false;
            if (!group.match)
                return false;
            return group.match.test(source);
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
                    const aPattern = a.match?.toString().replace(/[/^$|]/g, '') ?? '';
                    const bPattern = b.match?.toString().replace(/[/^$|]/g, '') ?? '';
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
            const aPattern = a.match?.toString().replace(/[/^$|]/g, '') ?? '';
            const bPattern = b.match?.toString().replace(/[/^$|]/g, '') ?? '';
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
        const formatting = this.config.formatting || types_1.DEFAULT_CONFIG.formatting;
        const cleanedLines = [];
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
        }
        else if (formatting?.quoteStyle === 'single') {
            cleaned = cleaned.replace(/"/g, "'");
        }
        // Gestion des point-virgules
        if (formatting?.semicolons === false) {
            cleaned = cleaned.replace(/;+$/, '');
        }
        else if (!cleaned.endsWith(";")) {
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
        const subfolderGroups = new Map();
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
                if (!subfolderGroups.has(groupName)) {
                    subfolderGroups.set(groupName, []);
                }
                subfolderGroups.get(groupName).push(importObj);
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
        subfolderGroups.forEach((importsInGroup, groupName) => {
            subfolderGroups.set(groupName, this.sortImportsWithinGroup(importsInGroup));
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
            if (!g.match)
                return false;
            return g.match && this.patterns.subfolderPattern && g.match.toString().includes(this.patterns.subfolderPattern.toString().slice(1, -1));
        });
        const groupOrder = appGroup ? appGroup.order : 2;
        const appGroupPriority = appGroup ? appGroup.priority : undefined;
        const sortedSubfolders = Array.from(subfolderGroups.keys()).sort();
        for (const subfolderName of sortedSubfolders) {
            const subfolderImports = subfolderGroups.get(subfolderName);
            if (subfolderImports.length > 0) {
                const subfolderGroup = {
                    name: subfolderName,
                    order: groupOrder,
                    imports: subfolderImports,
                };
                if (appGroupPriority !== undefined) {
                    configGroupMap.set(subfolderName, {
                        order: groupOrder,
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
    getSubfolders() {
        return Array.from(this.subFolders).sort();
    }
}
exports.ImportParser = ImportParser;
