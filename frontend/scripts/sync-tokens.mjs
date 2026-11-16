// Copia los Design Tokens oficiales (docs/design, exportados desde Figma) al
// frontend. Los archivos de src/shared/styles/tokens.* NO se editan a mano:
// se cambia la variable en Figma, se reexporta y se ejecuta `npm run sync:tokens`.
import { copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const archivo of ['tokens.css', 'tokens.json']) {
  copyFileSync(resolve(raiz, '..', 'docs', 'design', archivo), resolve(raiz, 'src', 'shared', 'styles', archivo));
  console.log(`Sincronizado ${archivo}`);
}
