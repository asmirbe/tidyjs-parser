import { ParserConfig } from './types';
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
export declare function validateConfig(config: ParserConfig): ValidationResult;
//# sourceMappingURL=configValidator.d.ts.map