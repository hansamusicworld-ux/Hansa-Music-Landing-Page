const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { inspectProject, assertProject, requiredFiles } = require('./check-deployment-files.cjs');
const { deploymentPlan, checkCloudDatabase } = require('./vercel-build.cjs');
const Ajv = require('ajv').default;
const Ajv2020 = require('ajv/dist/2020').default;
const addFormats = require('ajv-formats');
function fixture(root) {
  for (const file of requiredFiles) { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, 'fixture\n'); }
  fs.writeFileSync(path.join(root, 'drizzle/meta/_journal.json'), JSON.stringify({ entries: [{ tag: '0000_fixture' }] }));
  fs.writeFileSync(path.join(root, 'drizzle/0000_fixture.sql'), '-- fixture only; never executed\n');
}
(async () => {
  assertProject();
  console.log('PASS: The actual project includes its Next.js routes, dependencies, assets and production helpers.');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'hansa-source-check-'));
  try {
    const nested = path.join(temporary, 'website'); fixture(nested);
    assertProject(nested);
    assert.equal(inspectProject(temporary).ok, false);
    assert.deepEqual(inspectProject(temporary).nested, ['website']);
    assert.throws(() => assertProject(temporary), /ROOT DIRECTORY IS WRONG/);
    fs.rmSync(path.join(nested, 'src'), { recursive: true });
    fs.writeFileSync(path.join(nested, 'page.tsx'), 'flattened example');
    assert.throws(() => assertProject(nested), /src\/app\/page\.tsx/);
    fixture(nested); fs.writeFileSync(path.join(nested, 'src/app/layout.tsx'), '');
    assert.throws(() => assertProject(nested), /src\/app\/layout\.tsx/);
    console.log('PASS: Nested-root mistakes, missing src uploads and empty route files are identified without creating dummy pages.');
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  assert.throws(() => checkCloudDatabase('postgresql://localhost/app', 'DATABASE_URL'), /local machine/);
  assert.throws(() => checkCloudDatabase('https://database.example/app', 'DATABASE_URL'), /PostgreSQL/);
  assert.throws(() => deploymentPlan({ VERCEL_ENV: 'production', DATABASE_URL: 'postgresql://database.example/app' }), /HANSA_PUBLIC_SITE/);
  assert.throws(() => deploymentPlan({ VERCEL_ENV: 'production', HANSA_PUBLIC_SITE: 'true' }), /DATABASE_URL/);
  const plan = deploymentPlan({ VERCEL_ENV: 'production', HANSA_PUBLIC_SITE: 'true', DATABASE_URL: 'postgresql://pool.example/app', DIRECT_DATABASE_URL: 'postgresql://direct.example/app' });
  assert.equal(plan.prepare, true); assert.equal(plan.migrationUrl, 'postgresql://direct.example/app');
  assert.equal(deploymentPlan({ VERCEL_ENV: 'preview' }).prepare, false);
  assert.throws(() => deploymentPlan({ VERCEL_ENV: 'preview', HANSA_PUBLIC_SITE: 'true' }), /Production/);
  console.log('PASS: Production requires hosted database settings and explicit secure-owner mode; preview builds cannot silently migrate production data.');
  const response = await fetch('https://openapi.vercel.sh/vercel.json', { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('Official Vercel configuration schema could not be read.');
  const schema = await response.json();
  const Draft4 = require('ajv-draft-04');
  const ajv = schema.$schema?.includes('draft-04') ? new Draft4({ strict: false, allErrors: true }) : schema.$schema?.includes('2020-12') ? new Ajv2020({ strict: false, allErrors: true }) : new Ajv({ strict: false, allErrors: true });
  const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  const keys = ['$schema', 'framework', 'installCommand', 'buildCommand'];
  assert.deepEqual(Object.keys(config).sort(), [...keys].sort());
  // The upstream schema mixes drafts in unused experimental triggers. This config uses
  // only these four simple properties; validate every configured value against its
  // unmodified official property rule and reject any unvalidated extra property.
  const properties = Object.fromEntries(keys.map(key => {
    if (!schema.properties?.[key]) throw new Error(`Official rule missing for ${key}`);
    return [key, schema.properties[key]];
  }));
  addFormats(ajv);
  const validate = ajv.compile({ $schema: schema.$schema, type: 'object', properties, required: keys, additionalProperties: false });
  if (!validate(config)) throw new Error(JSON.stringify(validate.errors));
  assert.equal(config.framework, 'nextjs'); assert.equal(config.outputDirectory, undefined); assert.equal(config.rootDirectory, undefined);
  assert.ok(config.buildCommand.includes('vercel-build.cjs'));
  console.log('PASS: Every configured Vercel field matches its official property rules; Next.js output detection remains automatic.');
  console.log('No remote GitHub/Vercel settings or production data were changed.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
