import { ParserConfig } from './types';
export type ConfigValidationError = {
    type: 'regex' | 'order' | 'structure' | 'formatting';
    field: string;
    message: string;
    value?: unknown;
    suggestion?: string;
};
export type ValidationResult = {
    isValid: boolean;
    errors: ConfigValidationError[];
    warnings: ConfigValidationError[];
};
export declare function validateConfig(config: ParserConfig): ValidationResult;
//# sourceMappingURL=validator.d.ts.map