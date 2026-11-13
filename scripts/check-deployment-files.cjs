const fs = require('node:fs');
const path = require('node:path');
const requiredFiles = [
  'package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json', 'postcss.config.mjs',
  'src/app/page.tsx', 'src/app/layout.tsx', 'src/app/globals.css', 'src/app/api/health/route.ts',
  'src/components/website.tsx', 'src/components/studio.tsx',
  'src/lib/site.ts', 'src/lib/auth.ts', 'src/db/index.ts', 'src/db/schema.ts',
  'public/images/hansa-logo.svg', 'public/images/hansa-hero.jpg', 'public/images/desi-vibes.jpg',
  'public/images/tere-naal.jpg', 'public/images/ishq-adhoora.jpg', 'public/images/shiv-shambhu.jpg',
  'public/images/studio.jpg', 'public/images/location-map.svg',
  'public/fonts/dm-sans.ttf', 'public/fonts/dm-sans-semibold.ttf',
  'public/fonts/manrope-bold.ttf', 'public/fonts/manrope-extrabold.ttf',
  'scripts/prepare-production.ts', 'scripts/check-runtime-database.ts', 'scripts/vercel-build.cjs',
  'vercel.json', 'drizzle/meta/_journal.json',
];
function inspectProject(root = process.cwd()) {
  const missing = requiredFiles.filter(file => { try { const info = fs.statSync(path.join(root, file)); return !info.isFile() || info.size === 0; } catch { return true; } });
  const nested = fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && !['node_modules','.next','.git','artifacts'].includes(entry.name)).filter(entry => fs.existsSync(path.join(root, entry.name, 'package.json')) && fs.existsSync(path.join(root, entry.name, 'src/app/page.tsx'))).map(entry => entry.name) : [];
  return { ok: !missing.length, missing, nested };
}
function assertProject(root = process.cwd()) {
  const result = inspectProject(root);
  if (!result.ok) {
    const lines = [
      'DEPLOYMENT SOURCE FILES ARE MISSING OR THE ROOT DIRECTORY IS WRONG.',
      'This is a Next.js App Router project. Its application is in src/app, not a standalone HTML file.',
      'The selected Vercel Root Directory must contain package.json AND src/app/page.tsx.',
      'Missing files:', ...result.missing.map(file => `  - ${file}`),
      'Upload the complete src/, public/, scripts/ and drizzle/ folders with their folder structure intact.',
      'Do not create an empty app/pages folder or a dummy homepage to bypass this check.',
      ...(result.nested.length ? [`Possible app folders inside this directory: ${result.nested.join(', ')}. Choose the actual app folder as Root Directory.`] : []),
      'If package.json is already at the repository root, leave Root Directory at its default repository-root setting; do not choose src or src/app.',
      'See VERCEL-DEPLOY-FIX.md in this project.',
    ];
    throw new Error(lines.join('\n'));
  }
  const journal = JSON.parse(fs.readFileSync(path.join(root, 'drizzle/meta/_journal.json'), 'utf8'));
  for (const migration of journal.entries || []) if (!fs.existsSync(path.join(root, 'drizzle', migration.tag + '.sql'))) throw new Error(`Migration file drizzle/${migration.tag}.sql is missing. Upload the entire drizzle folder.`);
  return result;
}
module.exports = { inspectProject, assertProject, requiredFiles };
if (require.main === module) {
  try { assertProject(); console.log('PASS: Complete Next.js source structure found, including src/app/page.tsx and src/app/layout.tsx.'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
