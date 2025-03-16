# TidyImport Parser

Un parser puissant pour analyser, organiser et nettoyer les imports dans les fichiers TypeScript/JavaScript.

## Description

TidyImport Parser est un outil conçu pour analyser et organiser les imports dans les fichiers TypeScript/JavaScript selon des règles configurables. Il permet de regrouper les imports par catégories, de les trier selon un ordre spécifique, et de détecter et corriger certaines erreurs de syntaxe.

## Fonctionnalités

- **Analyse des imports** : Détecte et analyse tous les types d'imports (par défaut, nommés, de type, à effets de bord)
- **Regroupement configurable** : Organise les imports en groupes selon des expressions régulières configurables
- **Détection de modèles de chemin** : Crée dynamiquement des groupes basés sur des modèles de chemin (ex: `@app/{sousdossier}/*`)
- **Ordre précis** : Trie les imports selon un ordre spécifique (React d'abord, puis par type d'import)
- **Validation et correction** : Détecte et corrige certaines erreurs de syntaxe dans les imports
- **Support TypeScript** : Prend en charge les imports de type TypeScript

## Installation

```bash
npm install tidyimport-parser
```

## Utilisation

### Configuration de base

```typescript
import { parseImports, ParserConfig } from 'tidyimport-parser';

// Configuration du parser
const config: ParserConfig = {
  importGroups: [
    { name: 'Misc', regex: /^(react|lodash|uuid)$/, order: 0, isDefault: true },
    { name: 'Composants', regex: /^@components/, order: 1 },
    { name: 'Utils', regex: /^@utils/, order: 2 },
  ],
  // Configuration optionnelle
  defaultGroupName: 'Misc',
  typeOrder: {
    'sideEffect': 0,
    'default': 1,
    'named': 2,
    'typeDefault': 3,
    'typeNamed': 4
  },
  patterns: {
    appSubfolderPattern: /@app\/([^/]+)/
  }
};

// Code source à analyser
const sourceCode = `
import React from 'react';
import { useState } from 'react';
import { Button } from '@components/ui';
import { formatDate } from '@utils/date';
`;

// Analyse des imports
const result = parseImports(sourceCode, config);

console.log(result);
```

### Résultat de l'analyse

Le résultat de l'analyse contient les informations suivantes :

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
      name: 'Composants',
      order: 1,
      imports: [
        {
          type: 'named',
          source: '@components/ui',
          specifiers: ['Button'],
          raw: 'import { Button } from \'@components/ui\';',
          groupName: 'Composants',
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

### Validation et correction des imports

Le parser peut également valider et corriger certaines erreurs de syntaxe dans les imports :

```typescript
import { validateAndFixImportWithBabel } from 'tidyimport-parser';

const importStmt = "import { Component as C } from 'react';";
const result = validateAndFixImportWithBabel(importStmt);

console.log(result);
// {
//   fixed: "import { Component as C } from 'react';",
//   isValid: true,
//   error: undefined
// }
```

## Configuration avancée

### Groupes d'imports

Les groupes d'imports sont définis par un nom, une expression régulière et un ordre :

```typescript
const config: ParserConfig = {
  importGroups: [
    { name: 'Misc', regex: /^(react|react-.*|lodash|date-fns|classnames|@fortawesome|@reach|uuid|@tanstack|ag-grid-community|framer-motion)$/, order: 0 },
    { name: 'DS', regex: /^ds$/, order: 1 },
    { name: '@app/dossier', regex: /^@app\/dossier/, order: 2 },
    { name: '@app', regex: /^@app/, order: 2 },
    { name: '@core', regex: /^@core/, order: 3 },
    { name: '@library', regex: /^@library/, order: 4 },
    { name: 'Utils', regex: /^yutils/, order: 5 },
  ],
  // ...
};
```

### Ordre des types d'imports

L'ordre des types d'imports peut être configuré :

```typescript
const config: ParserConfig = {
  // ...
  typeOrder: {
    'sideEffect': 0, // Imports à effets de bord (ex: import 'module';)
    'default': 1,    // Imports par défaut (ex: import React from 'react';)
    'named': 2,      // Imports nommés (ex: import { useState } from 'react';)
    'typeDefault': 3, // Imports de type par défaut (ex: import type Test from 'react';)
    'typeNamed': 4   // Imports de type nommés (ex: import type { Test } from 'react';)
  },
  // ...
};
```

### Modèles de chemin

Les modèles de chemin permettent de créer dynamiquement des groupes basés sur des chemins d'imports :

```typescript
const config: ParserConfig = {
  // ...
  patterns: {
    appSubfolderPattern: /@app\/([^/]+)/
  },
  // ...
};
```

## Exemples

### Exemple simple

```typescript
// Input
import type { Test } from 'react';
import { useState } from 'react';
import type Test from 'react';
import { YpButton } from 'ds';
import React from 'react';

// Output (après formatage)
// Misc
import React from 'react';
import { useState } from 'react';
import type Test from 'react';
import type { Test } from 'react';
// DS
import { YpButton } from 'ds';
```

### Exemple avec groupes dynamiques

```typescript
// Input
import AbsenceInitFormComponent from '@app/dossier/components/absences/init/AbsenceInitFormComponent';
import { useClientNotification } from '@app/notification/ClientNotificationProvider';
import AccordFormComponent from '@app/dossier/components/britania/init/AbsenceInitFormComponent';
import useUtilisateurSearch from '@app/client/providers/parametrage/utilisateurs/UtilisateurSearchProvider';
import AbsencesFormComponent from '@app/dossier/components/absences/init/AbsencesFormComponent';

// Output (après formatage)
// @app/client
import useUtilisateurSearch from '@app/client/providers/parametrage/utilisateurs/UtilisateurSearchProvider';
// @app/dossier
import AbsenceInitFormComponent from '@app/dossier/components/absences/init/AbsenceInitFormComponent';
import AbsencesFormComponent from '@app/dossier/components/absences/init/AbsencesFormComponent';
import AccordFormComponent from '@app/dossier/components/britania/init/AbsenceInitFormComponent';
// @app/notification
import { useClientNotification } from '@app/notification/ClientNotificationProvider';
```

## Tests

Le projet inclut des tests pour vérifier le bon fonctionnement du parser :

```bash
npm run test
```

## Licence

MIT
