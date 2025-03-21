# TidyJS Parser

A powerful parser to analyze, organize, and clean imports in TypeScript/JavaScript files.

## Description

TidyJS Parser is a tool designed to analyze and organize imports in TypeScript/JavaScript files according to configurable rules. It allows grouping imports by categories, sorting them in a specific order, and detecting and correcting certain syntax errors.

## Features

- **Import analysis**: Detects and analyzes all types of imports (default, named, type, side effect)
- **Configurable grouping**: Organizes imports into groups based on configurable regular expressions
- **Path pattern detection**: Dynamically creates groups based on path patterns (e.g., `@app/{subfolder}/*`)
- **Precise ordering**: Sorts imports according to a specific order (React first, then by import type)
- **Validation and correction**: Detects and corrects certain syntax errors in imports
- **TypeScript support**: Handles TypeScript type imports

## Installation

```bash
npm install tidyjs-parser
```

## Usage

### Basic Configuration

```typescript
import { parseImports, ParserConfig } from "tidyjs-parser";

// Parser configuration
const config: ParserConfig = {
  importGroups: [
    { name: "Misc", regex: /^(react|lodash|uuid)$/, order: 0, isDefault: true },
    { name: "Components", regex: /^@components/, order: 1 },
    { name: "Utils", regex: /^@utils/, order: 2 },
  ],
  // Optional configuration
  defaultGroupName: "Misc",
  typeOrder: {
    sideEffect: 0,
    default: 1,
    named: 2,
    typeDefault: 3,
    typeNamed: 4,
  },
  patterns: {
    appSubfolderPattern: /@app\/([^/]+)/,
  },
};

// Source code to analyze
const sourceCode = `
import React from 'react';
import { useState } from 'react';
import { Button } from '@components/ui';
import { formatDate } from '@utils/date';
`;

// Import analysis
const result = parseImports(sourceCode, config);

console.log(result);
```

### Analysis Result

The analysis result contains the following information:

```typescript
{
  groups: [
    {
      name: 'Misc',
      order: 0,
      imports: [
        {
          type: 'default',
          source: 'react',
          specifiers: ['React'],
          raw: 'import React from \'react\';',
          groupName: 'Misc',
          isPriority: true,
          appSubfolder: null
        },
        {
          type: 'named',
          source: 'react',
          specifiers: ['useState'],
          raw: 'import { useState } from \'react\';',
          groupName: 'Misc',
          isPriority: true,
          appSubfolder: null
        }
      ]
    },
    {
      name: 'Components',
      order: 1,
      imports: [
        {
          type: 'named',
          source: '@components/ui',
          specifiers: ['Button'],
          raw: 'import { Button } from \'@components/ui\';',
          groupName: 'Components',
          isPriority: false,
          appSubfolder: null
        }
      ]
    },
    {
      name: 'Utils',
      order: 2,
      imports: [
        {
          type: 'named',
          source: '@utils/date',
          specifiers: ['formatDate'],
          raw: 'import { formatDate } from \'@utils/date\';',
          groupName: 'Utils',
          isPriority: false,
          appSubfolder: null
        }
      ]
    }
  ],
  originalImports: [
    'import React from \'react\';',
    'import { useState } from \'react\';',
    'import { Button } from \'@components/ui\';',
    'import { formatDate } from \'@utils/date\';'
  ],
  appSubfolders: [],
  invalidImports: []
}
```

### Import Validation and Correction

The parser can also validate and correct certain syntax errors in imports:

```typescript
import { validateAndFixImportWithBabel } from "tidyjs-parser";

const importStmt = "import { Component as C } from 'react';";
const result = validateAndFixImportWithBabel(importStmt);

console.log(result);
// {
//   fixed: "import { Component as C } from 'react';",
//   isValid: true,
//   error: undefined
// }
```

## Advanced Configuration

### Import Groups

Import groups are defined by a name, a regular expression, and an order:

```typescript
const config: ParserConfig = {
  importGroups: [
    { name: "Misc", regex: /^(react|react-.*|lodash|date-fns|classnames|@fortawesome|@reach|uuid|@tanstack|ag-grid-community|framer-motion)$/, order: 0 },
    { name: "DS", regex: /^ds$/, order: 1 },
    { name: "@app/folder", regex: /^@app\/folder/, order: 2 },
    { name: "@app", regex: /^@app/, order: 2 },
    { name: "@core", regex: /^@core/, order: 3 },
    { name: "@library", regex: /^@library/, order: 4 },
    { name: "Utils", regex: /^yutils/, order: 5 },
  ],
  // ...
};
```

### Import Type Order

The order of import types can be configured:

```typescript
const config: ParserConfig = {
  // ...
  typeOrder: {
    sideEffect: 0, // Side effect imports (e.g., import 'module';)
    default: 1, // Default imports (e.g., import React from 'react';)
    named: 2, // Named imports (e.g., import { useState } from 'react';)
    typeDefault: 3, // Default type imports (e.g., import type Test from 'react';)
    typeNamed: 4, // Named type imports (e.g., import type { Test } from 'react';)
  },
  // ...
};
```

### Path Patterns

Path patterns allow dynamically creating groups based on import paths:

```typescript
const config: ParserConfig = {
  // ...
  patterns: {
    appSubfolderPattern: /@app\/([^/]+)/,
  },
  // ...
};
```

## Examples

### Simple Example

```typescript
// Input
import type { Test } from "react";
import { useState } from "react";
import type Test from "react";
import { YpButton } from "ds";
import React from "react";

// Output (after formatting)
// Misc
import React from "react";
import { useState } from "react";
import type Test from "react";
import type { Test } from "react";
// DS
import { YpButton } from "ds";
```

### Example with Dynamic Groups

```typescript
// Input
import AbsenceInitFormComponent from "@app/folder/components/absences/init/AbsenceInitFormComponent";
import { useClientNotification } from "@app/notification/ClientNotificationProvider";
import AccordFormComponent from "@app/folder/components/britania/init/AbsenceInitFormComponent";
import useUtilisateurSearch from "@app/client/providers/parametrage/utilisateurs/UtilisateurSearchProvider";
import AbsencesFormComponent from "@app/folder/components/absences/init/AbsencesFormComponent";

// Output (after formatting)
// @app/client
import useUtilisateurSearch from "@app/client/providers/parametrage/utilisateurs/UtilisateurSearchProvider";
// @app/folder
import AbsenceInitFormComponent from "@app/folder/components/absences/init/AbsenceInitFormComponent";
import AbsencesFormComponent from "@app/folder/components/absences/init/AbsencesFormComponent";
import AccordFormComponent from "@app/folder/components/britania/init/AbsenceInitFormComponent";
// @app/notification
import { useClientNotification } from "@app/notification/ClientNotificationProvider";
```

## Tests

The project includes tests to verify the proper functioning of the parser:

```bash
npm run test
```

## License

MIT
