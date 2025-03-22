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

    // 1. Test if the regex can be used
    try {
        regex.test("test-string");
    } catch {
        errors.push({
            type: 'regex',
            field,
            message: 'Invalid regular expression',
            value: regex,
        });
        return { errors, warnings };
    }

    // 2. Check if the regex is well-formed
    const regexStr = regex.toString();
    if (!regexStr.startsWith('/') || !(/\/[gimsuy]*$/).test(regexStr)) {
        errors.push({
            type: 'regex',
            field,
            message: 'Malformed regular expression',
            value: regex,
        });
        return { errors, warnings };
    }

    // 3. Check if the expression is too permissive
    const regexSource = regex.source;
    if (regexSource === '.*' || regexSource === '.+' || regexSource === '.*?' || regexSource === '.+?' || regexSource === '[^]*' || regexSource === '[\\s\\S]*') {
        warnings.push({
            type: 'regex',
            field,
            message: 'Too permissive regular expression',
            value: regex,
            suggestion: 'Use a more specific pattern',
        });
    }

    return { errors, warnings };
}

function validateImportGroup(group: ConfigImportGroup): ValidationResponse {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationError[] = [];

    // Name validation
    if (!group.name || group.name.trim() === '') {
        errors.push({
            type: 'structure',
            field: 'name',
            message: 'Group name cannot be empty',
            value: group.name,
        });
    }

    // Order validation
    if (typeof group.order !== 'number' || isNaN(group.order)) {
        errors.push({
            type: 'order',
            field: 'order',
            message: "Order must be a valid number",
            value: group.order,
        });
    }

    // Priority validation if defined
    if (group.priority !== undefined && (typeof group.priority !== 'number' || isNaN(group.priority))) {
        errors.push({
            type: 'order',
            field: 'priority',
            message: 'Priority must be a valid number',
            value: group.priority,
        });
    }

    // Regex validation if defined
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

    // Check that each type has a valid order
    for (const [type, order] of Object.entries(typeOrder)) {
        if (!validTypes.includes(type)) {
            errors.push({
                type: 'structure',
                field: 'typeOrder',
                message: `Invalid import type: ${type}`,
                value: type,
                suggestion: `Valid types: ${validTypes.join(', ')}`,
            });
        }

        if (typeof order !== 'number' || isNaN(order)) {
            errors.push({
                type: 'order',
                field: `typeOrder.${type}`,
                message: "Order must be a valid number",
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

    // Import groups validation
    if (!Array.isArray(config.importGroups) || config.importGroups.length === 0) {
        errors.push({
            type: 'structure',
            field: 'importGroups',
            message: 'At least one import group must be defined',
        });
    } else {
        // Check for duplicate orders
        const orders = new Set<number>();
        config.importGroups.forEach(group => {
            if (orders.has(group.order)) {
                warnings.push({
                    type: 'order',
                    field: 'importGroups',
                    message: `Duplicate order detected: ${group.order}`,
                    value: group.order,
                    suggestion: 'Use unique orders to avoid ambiguity',
                });
            }
            orders.add(group.order);

            // Individual group validation
            const validation = validateImportGroup(group);
            errors.push(...validation.errors);
            warnings.push(...validation.warnings);
        });
    }

    // typeOrder validation if defined
    if (config.typeOrder) {
        const validation = validateTypeOrder(config.typeOrder);
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
    }

    // Patterns validation if defined
    if (config.patterns) {
        const validation = validateSourcePatterns(config.patterns);
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
    }

    // Priority imports validation
    if (config.priorityImports) {
        if (!Array.isArray(config.priorityImports)) {
            errors.push({
                type: 'structure',
                field: 'priorityImports',
                message: 'priorityImports must be an array',
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
