"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfig = validateConfig;
function validateRegExp(regex, field) {
    const errors = [];
    const warnings = [];
    // Only accept RegExp objects
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
    // 1. Test if the regex can be used
    try {
        regexObj.test("test-string");
    }
    catch {
        errors.push({
            type: 'regex',
            field,
            message: 'Invalid regular expression',
            value: regex,
        });
        return { errors, warnings };
    }
    // 2. Check if the regex is well-formed
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
    // 3. Check if the expression is too permissive
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
function validateImportGroup(group) {
    const errors = [];
    const warnings = [];
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
function validateTypeOrder(typeOrder) {
    const errors = [];
    const warnings = [];
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
function validateSourcePatterns(patterns) {
    const errors = [];
    const warnings = [];
    if (patterns.appSubfolderPattern) {
        const validation = validateRegExp(patterns.appSubfolderPattern, 'appSubfolderPattern');
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
    }
    return { errors, warnings };
}
function validateConfig(config) {
    const errors = [];
    const warnings = [];
    // Import groups validation
    if (!Array.isArray(config.importGroups) || config.importGroups.length === 0) {
        errors.push({
            type: 'structure',
            field: 'importGroups',
            message: 'At least one import group must be defined',
        });
    }
    else {
        // Check for duplicate orders
        const orders = new Set();
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
        }
        else {
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
