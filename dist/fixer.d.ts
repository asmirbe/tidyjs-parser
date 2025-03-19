export interface FixResult {
    fixed: string | null;
    isValid: boolean;
    errors: string[];
}
export declare function fixImportStatement(importStmt: string): FixResult;
export declare function validateAndFixImportWithBabel(importStmt: string): {
    fixed: string | null;
    isValid: boolean;
    error?: string;
};
//# sourceMappingURL=fixer.d.ts.map