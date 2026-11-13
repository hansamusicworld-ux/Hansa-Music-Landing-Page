const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { assertProject } = require('./check-deployment-files.cjs');

function checkCloudDatabase(value, label) {
  if (!value) throw new Error(`${label} is missing. Add your hosted PostgreSQL connection string to Vercel Project Settings → Environment Variables → Production. Do not upload the local .env file.`);
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} must be a valid PostgreSQL connection URL.`); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error(`${label} must be a PostgreSQL connection URL.`);
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(host)) throw new Error(`${label} points to a local machine. Vercel needs a hosted PostgreSQL database, not the preview's localhost database.`);
}
function deploymentPlan(env) {
  if (env.VERCEL_ENV === 'production') {
    if (env.HANSA_PUBLIC_SITE !== 'true') throw new Error('Set HANSA_PUBLIC_SITE=true for the Vercel Production environment before deploying. The owner is then prepared privately rather than through public registration.');
    checkCloudDatabase(env.DATABASE_URL, 'DATABASE_URL');
    if (env.DIRECT_DATABASE_URL) checkCloudDatabase(env.DIRECT_DATABASE_URL, 'DIRECT_DATABASE_URL');
    return { prepare: true, migrationUrl: env.DIRECT_DATABASE_URL || env.DATABASE_URL };
  }
  if (env.HANSA_PUBLIC_SITE === 'true') throw new Error('Public-site preparation is restricted to Vercel Production deployments. Enable Vercel System Environment Variables and deploy the production branch. Do not share production database settings with preview deployments.');
  return { prepare: false, migrationUrl: null };
}
function run(command, args, env) {
  const result = spawnSync(command, args, { stdio: 'inherit', env, cwd: process.cwd(), shell: process.platform === 'win32' && command.endsWith('.cmd') });
  if (result.error) throw new Error('A deployment step could not start. Check that the complete project and dependencies were uploaded.');
  if (result.status !== 0) throw new Error(`Deployment step failed: ${path.basename(command)} ${args.join(' ')}. Read the preceding log for details.`);
}
function main() {
  assertProject();
  console.log('Source structure verified: package.json + src/app + complete application folders.');
  if (process.argv.includes('--check-only')) return;
  const plan = deploymentPlan(process.env);
  if (plan.prepare) {
    console.log('Preparing the Production database and private owner account. Credentials are not printed.');
    const tsx = path.resolve('node_modules/tsx/dist/cli.mjs');
    run(process.execPath, [tsx, 'scripts/prepare-production.ts'], { ...process.env, DATABASE_URL: plan.migrationUrl });
    run(process.execPath, [tsx, 'scripts/check-runtime-database.ts'], process.env);
  } else console.log('Non-production build: no production database migration or owner-password reset will be performed. Preview backends need their own initialized database.');
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], process.env);
}
module.exports = { checkCloudDatabase, deploymentPlan };
if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
