import { parse } from 'es-module-lexer';
import {
    FormattingOptions,
    EnhancedImportSpecifier,
    EnhancedParsedImport,
    SpecifierType,
    ImportType
} from './types';

/**
 * Extrait les commentaires par ligne du code
 */
function extractComments(code: string): Map<number, string[]> {
    const commentsByLine = new Map<number, string[]>();
    const lines = code.split('\n');

    // Regex pour détecter les commentaires ligne par ligne
    const lineCommentRegex = /\/\/(.*)$/;
    const blockCommentStartRegex = /\/\*(.*)$/;
    const blockCommentEndRegex = /(.*)\*\//;

    let inBlockComment = false;
    let currentBlockComment: string[] = [];
    let blockStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (inBlockComment) {
            const endMatch = line.match(blockCommentEndRegex);
            if (endMatch) {
                currentBlockComment.push(endMatch[1].trim());
                inBlockComment = false;

                // Associer le bloc entier à la ligne où il a commencé
                commentsByLine.set(blockStartLine, [
                    ...(commentsByLine.get(blockStartLine) || []),
                    currentBlockComment.join(' ')
                ]);

                currentBlockComment = [];
            } else {
                currentBlockComment.push(line.trim());
            }
        } else {
            // Commentaires de ligne
            const lineMatch = line.match(lineCommentRegex);
            if (lineMatch && lineMatch[1].trim()) {
                const comments = commentsByLine.get(i) || [];
                comments.push(lineMatch[1].trim());
                commentsByLine.set(i, comments);
            }

            // Début de commentaire de bloc
            const blockStartMatch = line.match(blockCommentStartRegex);
            if (blockStartMatch) {
                blockStartLine = i;
                currentBlockComment = [blockStartMatch[1].trim()];

                // Vérifier si le commentaire de bloc se termine sur la même ligne
                if (line.includes('*/')) {
                    const fullComment = line.match(/\/\*(.*)\*\//);
                    if (fullComment && fullComment[1].trim()) {
                        const comments = commentsByLine.get(i) || [];
                        comments.push(fullComment[1].trim());
                        commentsByLine.set(i, comments);
                    }
                } else {
                    inBlockComment = true;
                }
            }
        }
    }

    return commentsByLine;
}

/**
 * Obtient le numéro de ligne à partir d'un index de caractère
 */
function getLineNumber(code: string, index: number): number {
    return code.substring(0, index).split('\n').length - 1;
}

/**
 * Analyse les différentes formes de spécificateurs d'import
 */
function parseImportSpecifiers(raw: string, importType: ImportType): EnhancedImportSpecifier[] {
    const specifiers: EnhancedImportSpecifier[] = [];
    const isTypeImport = importType === 'typeDefault' || importType === 'typeNamed';

    // Extraction des imports par défaut
    const defaultMatch = raw.match(/import\s+(?:type\s+)?([a-zA-Z0-9_$]+)(?:\s*,|\s+from)/);
    if (defaultMatch && !raw.startsWith('import type {')) {
        specifiers.push({
            type: isTypeImport ? 'typeDefault' : 'default',
            name: defaultMatch[1],
        });
    }

    // Extraction des imports namespace
    const namespaceMatch = raw.match(/\*\s+as\s+([a-zA-Z0-9_$]+)/);
    if (namespaceMatch) {
        specifiers.push({
            type: isTypeImport ? 'typeNamespace' : 'namespace',
            name: namespaceMatch[1],
        });
    }

    // Extraction des imports nommés
    const namedMatches = raw.match(/{([^}]+)}/);
    if (namedMatches) {
        const namedSpecifiers = namedMatches[1]
            .split(',')
            .map(spec => spec.trim())
            .filter(Boolean)
            .map(spec => {
                // Gestion des alias (as) dans les imports
                const [name, alias] = spec.split(/\s+as\s+/).map(s => s.trim());
                return {
                    type: isTypeImport ? 'typeNamed' : 'named' as SpecifierType,
                    name,
                    ...(alias && { alias })
                };
            });

        specifiers.push(...namedSpecifiers);
    }

    return specifiers;
}

/**
 * Fusionne les spécificateurs d'un import existant avec de nouveaux spécificateurs
 */
function mergeSpecifiers(target: EnhancedParsedImport, newSpecifiers: EnhancedImportSpecifier[]): void {
    const existingNames = new Map<string, EnhancedImportSpecifier>();

    // Index des spécificateurs existants par nom
    for (const spec of target.specifiers) {
        const key = `${spec.type}:${spec.name}`;
        existingNames.set(key, spec);
    }

    // Ajout des nouveaux spécificateurs
    for (const spec of newSpecifiers) {
        const key = `${spec.type}:${spec.name}`;
        if (!existingNames.has(key)) {
            target.specifiers.push(spec);
            existingNames.set(key, spec);
        } else if (spec.alias && !existingNames.get(key)?.alias) {
            // Si le nouveau spécificateur a un alias mais pas l'existant, utiliser celui avec alias
            const existing = target.specifiers.find(s => s.type === spec.type && s.name === spec.name);
            if (existing) {
                existing.alias = spec.alias;
            }
        }
    }

    // Tri des spécificateurs pour consistance
    target.specifiers.sort((a, b) => {
        // D'abord par type
        if (a.type !== b.type) {
            const typeOrder = {
                default: 0, typeDefault: 1,
                namespace: 2, typeNamespace: 3,
                named: 4, typeNamed: 5
            };
            return typeOrder[a.type] - typeOrder[b.type];
        }
        // Puis par nom
        return a.name.localeCompare(b.name);
    });
}

/**
 * Génère un import final à partir d'une source et d'un tableau de spécificateurs
 */
function generateImportStatement(
    source: string,
    specifiers: EnhancedImportSpecifier[],
    importType: ImportType = 'named',
    config: FormattingOptions = {}
): string {
    const typeSpecifier = importType === 'typeDefault' || importType === 'typeNamed' ? 'type ' : '';
    const quote = config.quoteStyle === 'double' ? '"' : "'";
    const semicolon = config.semicolons !== false ? ';' : '';

    // Regroupe les spécificateurs par type
    const defaultSpec = specifiers.find(s => s.type === 'default' || s.type === 'typeDefault');
    const namespaceSpec = specifiers.find(s => s.type === 'namespace' || s.type === 'typeNamespace');

    const namedSpecs = specifiers
        .filter(s => s.type === 'named' || s.type === 'typeNamed')
        .map(s => s.alias ? `${s.name} as ${s.alias}` : s.name)
        .sort();

    const parts = [];

    if (defaultSpec) parts.push(defaultSpec.name);
    if (namespaceSpec) parts.push(`* as ${namespaceSpec.name}`);
    if (namedSpecs.length > 0) {
        // Pour les imports avec beaucoup de spécificateurs nommés, format multiligne
        if (namedSpecs.length > 3 && config.multilineIndentation) {
            const indent = typeof config.multilineIndentation === 'number'
                ? ' '.repeat(config.multilineIndentation)
                : '\t';

            const formattedNames = namedSpecs
                .map(name => `${indent}${name}`)
                .join(',\n');

            parts.push(`{\n${formattedNames}\n}`);
        } else {
            parts.push(`{ ${namedSpecs.join(', ')} }`);
        }
    }

    return `import ${typeSpecifier}${parts.join(', ')} from ${quote}${source}${quote}${semicolon}`;
}

/**
 * Analyse et fusionne les imports du code source
 */
export async function mergeImports(code: string, config: FormattingOptions = {}): Promise<EnhancedParsedImport[]> {
    // Extraction des commentaires importants liés aux imports (pour les préserver)
    const commentsByLine = extractComments(code);

    // Utilisation de es-module-lexer pour extraire les imports
    const [imports] = await parse(code);
    const merged = new Map<string, EnhancedParsedImport>();

    for (const i of imports) {
        if (!i.n) continue; // Ignorer les imports sans module source

        const raw = code.slice(i.ss, i.se);
        const importType: ImportType = raw.includes('import type')
            ? (raw.includes('{') ? 'typeNamed' : 'typeDefault')
            : (raw.includes('{') ? 'named' : 'default');

        const key = `${importType}:${i.n}`;

        // Extraction détaillée des specifiers
        const specifiers = parseImportSpecifiers(raw, importType);

        // Extraction des commentaires associés à cet import
        const lineNumber = getLineNumber(code, i.ss);
        const associatedComments = commentsByLine.get(lineNumber) || [];

        if (merged.has(key)) {
            // Fusion des imports avec la même source et le même type
            const existing = merged.get(key)!;
            mergeSpecifiers(existing, specifiers);

            // Fusion des commentaires (si préservation activée)
            if (config.preserveComments !== false && associatedComments.length > 0) {
                existing.comments = [...(existing.comments || []), ...associatedComments];
            }

            // Génération du code fusionné
            existing.raw = generateImportStatement(i.n, existing.specifiers, importType, config);
        } else {
            // Nouvel import
            merged.set(key, {
                source: i.n,
                specifiers,
                raw: generateImportStatement(i.n, specifiers, importType, config),
                type: importType,
                start: i.ss,
                end: i.se,
                comments: config.preserveComments !== false ? associatedComments : undefined,
            });
        }
    }

    return Array.from(merged.values());
}

/**
 * Applique les imports fusionnés au code source
 */
export function applyMergedImports(code: string, mergedImports: EnhancedParsedImport[]): string {
    // Trie les imports par position de fin (de droite à gauche)
    // pour éviter de modifier les indices pendant le remplacement
    const sortedImports = [...mergedImports].sort((a, b) => b.end - a.end);

    let result = code;

    // Tableau des plages à remplacer
    const replacements: { start: number; end: number; value: string }[] = [];

    // Regrouper les imports par source
    const importsBySource = new Map<string, EnhancedParsedImport[]>();

    for (const imp of sortedImports) {
        if (!importsBySource.has(imp.source)) {
            importsBySource.set(imp.source, []);
        }
        importsBySource.get(imp.source)!.push(imp);
    }

    // Pour chaque source, déterminer les plages à remplacer
    importsBySource.forEach((imports, _source) => {
        // Si plusieurs imports de la même source, trouver le premier et le dernier
        if (imports.length > 1) {
            const first = imports.reduce((min, imp) => imp.start < min.start ? imp : min, imports[0]);
            const last = imports.reduce((max, imp) => imp.end > max.end ? imp : max, imports[0]);

            // Remplacer toute la plage par le premier import fusionné
            replacements.push({
                start: first.start,
                end: last.end,
                value: first.raw
            });

            // Marquer les autres comme "à ignorer"
            for (const imp of imports) {
                if (imp !== first) {
                    imp.start = -1;
                    imp.end = -1;
                }
            }
        } else if (imports.length === 1) {
            const imp = imports[0];
            replacements.push({
                start: imp.start,
                end: imp.end,
                value: imp.raw
            });
        }
    });

    // Effectuer les remplacements
    for (const { start, end, value } of replacements) {
        if (start >= 0 && end >= 0) {
            result = result.substring(0, start) + value + result.substring(end);
        }
    }

    return result;
}

/**
 * Fonction principale pour traiter le code source et fusionner les imports
 */
export async function processCodeAndMergeImports(code: string, config: FormattingOptions = {}): Promise<string> {
    try {
        const mergedImports = await mergeImports(code, config);
        return applyMergedImports(code, mergedImports);
    } catch (error) {
        console.error('Error merging imports:', error);
        return code; // Retourne le code original en cas d'erreur
    }
}