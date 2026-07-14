// i18n catalog integrity check. For every language + namespace, verifies:
//   • valid JSON
//   • exact key parity with the English source (no missing / extra keys)
//   • every {{placeholder}} and <bold> tag in the English value is present in the
//     translation (order-independent)
// Run: `npm run i18n:check` (exits non-zero on any problem — wire into CI/pre-commit).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = path.join(root, 'shared/i18n/locales');
const SOURCE = 'en';
const NAMESPACES = ['common', 'kiosk', 'partner'];

const langs = fs
  .readdirSync(localesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== SOURCE)
  .map((d) => d.name);

const read = (lang, ns) => JSON.parse(fs.readFileSync(path.join(localesDir, lang, `${ns}.json`), 'utf8'));
const leafKeys = (o, p = '') =>
  Object.keys(o)
    .flatMap((k) => {
      const kp = p ? `${p}.${k}` : k;
      return o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? leafKeys(o[k], kp) : [kp];
    })
    .sort();
const flat = (o, p = '') =>
  Object.keys(o).reduce((r, k) => {
    const kp = p ? `${p}.${k}` : k;
    if (o[k] && typeof o[k] === 'object') Object.assign(r, flat(o[k], kp));
    else r[kp] = o[k];
    return r;
  }, {});
const tokens = (s) => (String(s).match(/{{\s*\w+\s*}}|<\/?\w+>/g) || []).map((t) => t.replace(/\s/g, '')).sort();

let problems = 0;
for (const ns of NAMESPACES) {
  const en = read(SOURCE, ns);
  const enKeys = leafKeys(en);
  const enFlat = flat(en);
  for (const lang of langs) {
    let data;
    try {
      data = read(lang, ns);
    } catch (e) {
      console.error(`❌ ${lang}/${ns}.json — ${e.message}`);
      problems++;
      continue;
    }
    const missing = enKeys.filter((k) => !leafKeys(data).includes(k));
    const extra = leafKeys(data).filter((k) => !enKeys.includes(k));
    const lf = flat(data);
    const tokenMismatches = enKeys.filter(
      (k) => JSON.stringify(tokens(enFlat[k])) !== JSON.stringify(tokens(lf[k] ?? ''))
    );
    if (missing.length || extra.length || tokenMismatches.length) {
      problems++;
      console.error(`❌ ${lang}/${ns}`);
      if (missing.length) console.error(`   missing keys: ${missing.join(', ')}`);
      if (extra.length) console.error(`   extra keys:   ${extra.join(', ')}`);
      if (tokenMismatches.length) console.error(`   placeholder/tag mismatch: ${tokenMismatches.join(', ')}`);
    } else {
      console.log(`✅ ${lang}/${ns} (${enKeys.length} keys)`);
    }
  }
}
if (problems) {
  console.error(`\n${problems} problem(s) found.`);
  process.exit(1);
}
console.log('\nAll catalogs consistent.');
