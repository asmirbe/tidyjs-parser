import { ParserConfig, ConfigImportGroup, TypeOrder, SourcePatterns } from './types';

export interface ConfigValidationError {
    type: 'regex' | 'order' | 'structure';
    field: string;
    message: string;
    value?: unknown;
    suggestion?: string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ConfigValidationError[];
    warnings: ConfigValidationError[];
}

interface ValidationResponse {
    errors: ConfigValidationError[];
    warnings: ConfigValidationError[];
}

function validateRegExp(regex: RegExp, field: string): ValidationResponse {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationError[] = [];

    // 1. Test si la regex peut être utilisée
    try {
        regex.test("test-string");
    } catch {
        errors.push({
            type: 'regex',
            field,
            message: 'Expression régulière invalide',
            value: regex,
        });
        return { errors, warnings };
    }

    // 2. Vérifie que la regex est bien formée
    const regexStr = regex.toString();
    if (!regexStr.startsWith('/') || !(/\/[gimsuy]*$/).test(regexStr)) {
        errors.push({
            type: 'regex',
            field,
            message: 'Expression régulière malformée',
            value: regex,
        });
        return { errors, warnings };
    }

    // 3. Vérifie si l'expression est trop permissive
    const regexSource = regex.source;
    if (regexSource === '.*' || regexSource === '.+' || regexSource === '.*?' || regexSource === '.+?' || regexSource === '[^]*' || regexSource === '[\\s\\S]*') {
        warnings.push({
            type: 'regex',
            field,
            message: 'Expression régulière trop permissive',
            value: regex,
            suggestion: 'Utilisez un pattern plus spécifique',
        });
    }

    return { errors, warnings };
}

function validateImportGroup(group: ConfigImportGroup): ValidationResponse {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationError[] = [];

    // Validation du nom
    if (!group.name || group.name.trim() === '') {
        errors.push({
            type: 'structure',
            field: 'name',
            message: 'Le nom du groupe ne peut pas être vide',
            value: group.name,
        });
    }

    // Validation de l'ordre
    if (typeof group.order !== 'number' || isNaN(group.order)) {
        errors.push({
            type: 'order',
            field: 'order',
            message: "L'ordre doit être un nombre valide",
            value: group.order,
        });
    }

    // Validation de la priorité si définie
    if (group.priority !== undefined && (typeof group.priority !== 'number' || isNaN(group.priority))) {
        errors.push({
            type: 'order',
            field: 'priority',
            message: 'La priorité doit être un nombre valide',
            value: group.priority,
        });
    }

    // Validation du regex si défini
    if (group.regex && !group.isDefault) {
        const validation = validateRegExp(group.regex, 'regex');
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
    }

    return { errors, warnings };
}

function validateTypeOrder(typeOrder: TypeOrder): ValidationResponse {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationError[] = [];
    const validTypes = ['default', 'named', 'typeDefault', 'typeNamed', 'sideEffect'];

    // Vérifie que chaque type a un ordre valide
    for (const [type, order] of Object.entries(typeOrder)) {
        if (!validTypes.includes(type)) {
            errors.push({
                type: 'structure',
                field: 'typeOrder',
                message: `Type d'import invalide: ${type}`,
                value: type,
                suggestion: `Types valides: ${validTypes.join(', ')}`,
            });
        }

        if (typeof order !== 'number' || isNaN(order)) {
            errors.push({
                type: 'order',
                field: `typeOrder.${type}`,
                message: "L'ordre doit être un nombre valide",
                value: order,
            });
        }
    }

    return { errors, warnings };
}

function validateSourcePatterns(patterns: SourcePatterns): ValidationResponse {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationError[] = [];

    if (patterns.appSubfolderPattern) {
        const validation = validateRegExp(patterns.appSubfolderPattern, 'appSubfolderPattern');
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
    }

    return { errors, warnings };
}

export function validateConfig(config: ParserConfig): ValidationResult {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationError[] = [];

    // Validation des groupes d'imports
    if (!Array.isArray(config.importGroups) || config.importGroups.length === 0) {
        errors.push({
            type: 'structure',
            field: 'importGroups',
            message: 'Au moins un groupe d\'import doit être défini',
        });
    } else {
        // Vérifie les doublons d'ordre
        const orders = new Set<number>();
        config.importGroups.forEach(group => {
            if (orders.has(group.order)) {
                warnings.push({
                    type: 'order',
                    field: 'importGroups',
                    message: `Ordre en doublon détecté: ${group.order}`,
                    value: group.order,
                    suggestion: 'Utilisez des ordres uniques pour éviter les ambiguïtés',
                });
            }
            orders.add(group.order);

            // Validation individuelle des groupes
            const validation = validateImportGroup(group);
            errors.push(...validation.errors);
            warnings.push(...validation.warnings);
        });
    }

    // Validation de typeOrder si défini
    if (config.typeOrder) {
        const validation = validateTypeOrder(config.typeOrder);
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
    }

    // Validation des patterns si définis
    if (config.patterns) {
        const validation = validateSourcePatterns(config.patterns);
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
    }

    // Validation des imports prioritaires
    if (config.priorityImports) {
        if (!Array.isArray(config.priorityImports)) {
            errors.push({
                type: 'structure',
                field: 'priorityImports',
                message: 'priorityImports doit être un tableau',
                value: config.priorityImports,
            });
        } else {
            config.priorityImports.forEach((regex, index) => {
                const validation = validateRegExp(regex, `priorityImports[${index}]`);
                errors.push(...validation.errors);
                warnings.push(...validation.warnings);
            });
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
}
