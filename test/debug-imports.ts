import { parseImports, ParserConfig, DEFAULT_CONFIG } from "../src/index";

const config: ParserConfig = {
    importGroups: [
        {
            name: "Misc",
            order: 0,
            isDefault: true,
            match: /^(react|react-.*|lodash|date-fns|classnames|@fortawesome|@reach|uuid|@tanstack|ag-grid-community|framer-motion)$/,
        },
        {
            name: "DS",
            order: 1,
            match: /^ds$/,
        },
        {
            name: "@app/dossier",
            order: 2,
            match: /^@app\/dossier/,
        },
        {
            name: "@app",
            order: 3,
            match: /^@app/,
        },
        {
            name: "@core",
            order: 4,
            match: /^@core/,
        },
        {
            name: "@library",
            order: 5,
            match: /^@library/,
        },
        {
            name: "Utils",
            order: 6,
            match: /^yutils/,
        },
    ],
    patterns: {
        ...DEFAULT_CONFIG.patterns,
        subfolderPattern: /@app\/([^/]+)/,
    },
};

function generateImportReport(result: ReturnType<typeof parseImports>) {
    const lines: string[] = ["📚 Rapport des imports :"];

    for (const group of result.groups) {
        lines.push(`\nGroupe : ${group.name}`);

        for (const imp of group.imports) {
            const typeLabelMap = {
                default: "Default",
                named: "Named",
                namespace: "Namespace",
                typeNamed: "TypeNamed",
            };
            const typeLabel = typeLabelMap[imp.type] || imp.type;
            const specs = imp.specifiers.join(", ");

            lines.push(`- ${typeLabel} from '${imp.source}'`);
            lines.push(`  ${specs}`);
        }
    }

    if (result.invalidImports && result.invalidImports.length > 0) {
        lines.push("\nImports invalides détectés :");
        for (const imp of result.invalidImports) {
            lines.push(`- ${typeof imp === "string" ? imp : JSON.stringify(imp)}`);
        }
    }

    return lines.join("\n");
}

const code = `
// DS
import picto                          from '@core/resources/assets/images/yeap/picto-yeap.png';
import cn                             from 'classnames';
import {
    type FC,
    useMemo,
    Fragment,
    useState,
    useCallback
}                                     from 'react';
import { FontAwesomeIcon }            from '@fortawesome/react-fontawesome';
import { getDateFormat }              from '@library/utils/dates';
import { getFormattedDecimalDigits }  from '@library/utils/number';
import { useSearch }                  from '@library/utils/search';
import { useTable }                   from '@library/utils/table';
import {
    YpTab,
    YpTag,
    YpMenu,
    YpInput,
    YpTable,
    YpButton,
    YpElement,
    YpTagsList,
    useYpModal,
    YpDataTable,
    YpTypography,
    YpConfirmModal
}                                     from 'ds';`;

const result = parseImports(code, config);
console.log(generateImportReport(result));
