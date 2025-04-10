import { ParserConfig, ConfigImportGroup, TypeOrder, SourcePatterns, FormattingOptions } from './types';

export type ConfigValidationError = {
    type: 'regex' | 'order' | 'structure' | 'formatting';
    field: string;
    message: string;
    value?: unknown;
    suggestion?: string;
}

export type ValidationResult = {
    isValid: boolean;
    errors: ConfigValidationError[];
    warnings: ConfigValidationError[];
}

type ValidationResponse = {
    errors: ConfigValidationError[];
    warnings: ConfigValidationError[];
}

function validateRegExp(regex: RegExp | string, field: string): ValidationResponse {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationError[] = [];

    if (typeof regex === 'string') {
        return {
            errors: [{
                type: 'regex',
                field,
                message: 'String patterns are not allowed. Must be a RegExp object',
                value: regex,
                suggestion: `Use a RegExp object instead, e.g., /${regex}/i`
            }],
            warnings: []
        };
    }

    const regexObj = regex;

    try {
        regexObj.test("test-string");
    } catch {
        errors.push({
            type: 'regex',
            field,
            message: 'Invalid regular expression',
            value: regex,
        });
        return { errors, warnings };
    }

    const regexStr = regexObj.toString();
    if (!regexStr.startsWith('/') || !(/\/[gimsuy]*$/).test(regexStr)) {
        errors.push({
            type: 'regex',
            field,
            message: 'Malformed regular expression',
            value: regex,
        });
        return { errors, warnings };
    }

    const regexSource = regexObj.source;
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

function validateFormatting(formatting: FormattingOptions): ValidationResponse {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationError[] = [];

    if (formatting.quoteStyle && !['single', 'double'].includes(formatting.quoteStyle)) {
        errors.push({
            type: 'formatting',
            field: 'formatting.quoteStyle',
            message: 'Invalid quote style',
            value: formatting.quoteStyle,
            suggestion: 'Use either "single" or "double"'
        });
    }

    if (formatting.multilineIndentation !== undefined) {
        if (formatting.multilineIndentation === 'tab') {
            // Valid case
        } else if (typeof formatting.multilineIndentation === 'number') {
            if (formatting.multilineIndentation < 0 || formatting.multilineIndentation > 8) {
                warnings.push({
                    type: 'formatting',
                    field: 'formatting.multilineIndentation',
                    message: 'Indentation should be between 0 and 8 spaces',
                    value: formatting.multilineIndentation,
                });
            }
        } else {
            errors.push({
                type: 'formatting',
                field: 'formatting.multilineIndentation',
                message: 'Invalid indentation value',
                value: formatting.multilineIndentation,
                suggestion: 'Use a number or "tab"'
            });
        }
    }

    return { errors, warnings };
}

function validateImportGroup(group: ConfigImportGroup): ValidationResponse {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationError[] = [];

    if (!group.name || group.name.trim() === '') {
        errors.push({
            type: 'structure',
            field: 'name',
            message: 'Group name cannot be empty',
            value: group.name,
        });
    }

    if (typeof group.order !== 'number' || isNaN(group.order)) {
        errors.push({
            type: 'order',
            field: 'order',
            message: "Order must be a valid number",
            value: group.order,
        });
    }

    if (group.priority !== undefined && (typeof group.priority !== 'number' || isNaN(group.priority))) {
        errors.push({
            type: 'order',
            field: 'priority',
            message: 'Priority must be a valid number',
            value: group.priority,
        });
    }

    if (group.match && !group.isDefault) {
        const validation = validateRegExp(group.match, 'match');
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
    }

    return { errors, warnings };
}

function validateTypeOrder(typeOrder: TypeOrder): ValidationResponse {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationError[] = [];
    const validTypes = ['default', 'named', 'typeDefault', 'typeNamed', 'sideEffect'];

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

    if (patterns.subfolderPattern) {
        const validation = validateRegExp(patterns.subfolderPattern, 'subfolderPattern');
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
    }

    return { errors, warnings };
}

export function validateConfig(config: ParserConfig): ValidationResult {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationError[] = [];

    if (!Array.isArray(config.importGroups) || config.importGroups.length === 0) {
        errors.push({
            type: 'structure',
            field: 'importGroups',
            message: 'At least one import group must be defined',
        });
    } else {
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

            const validation = validateImportGroup(group);
            errors.push(...validation.errors);
            warnings.push(...validation.warnings);
        });
    }

    if (config.typeOrder) {
        const validation = validateTypeOrder(config.typeOrder);
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
    }

    if (config.patterns) {
        const validation = validateSourcePatterns(config.patterns);
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
    }

    if (config.formatting) {
        const validation = validateFormatting(config.formatting);
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
}
