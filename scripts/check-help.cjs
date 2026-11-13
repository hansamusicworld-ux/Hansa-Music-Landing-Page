require('dotenv').config({quiet:true});
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {randomBytes,createHash}=require('node:crypto');
const {chromium,webkit,devices,expect}=require('@playwright/test');
const {eq}=require('drizzle-orm');
const cache=new Map();
function source(name){const file=path.resolve(name);if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const req=s=>s.startsWith('@/')?source('src/'+s.slice(2)+'.ts'):s.startsWith('.')?source(path.resolve(path.dirname(file),s)+'.ts'):require(s);new Function('require','module','exports',code)(req,mod,mod.exports);return mod.exports;}
const {db,pool}=source('src/db/index.ts');
const {sessions,owners,siteSettings}=source('src/db/schema.ts');
const token=randomBytes(32).toString('hex'),tokenHash=createHash('sha256').update(token).digest('hex');
const browsers=[];let originalOwners,originalSites;
(async()=>{
  originalOwners=await db.select().from(owners);originalSites=await db.select().from(siteSettings);
  await db.insert(sessions).values({tokenHash,expiresAt:new Date(Date.now()+600000)});
  fs.mkdirSync('artifacts/guide',{recursive:true});
  for(const [engine,name,mobile] of [[chromium,'desktop',false],[webkit,'iphone',true]]){
    const browser=await engine.launch({headless:true,...(engine===chromium?{args:['--no-sandbox']}:{})});browsers.push(browser);
    const context=await browser.newContext(mobile?devices['iPhone 13']:{viewport:{width:1440,height:1000}});
    await context.addInitScript(token=>{sessionStorage.setItem('hansa.editor.session.v2',token);window.__printed=false;window.print=()=>{window.__printed=true}},token);
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://localhost:3000/studio',{waitUntil:'domcontentloaded'});
    await expect(page.getByRole('heading',{name:'Welcome to your studio.',exact:true})).toBeVisible();
    if(mobile)await page.getByRole('button',{name:'Open editor navigation',exact:true}).click();
    await page.getByRole('button',{name:'Help & go live',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Abhi preview hai — public launch confirm nahi hai',exact:true})).toBeVisible();
    await expect(page.locator('.guide-status')).toContainText('hosting/domain apne aap public live nahi hota');
    await expect(page.locator('.guide-limit')).toContainText('2.0 GB');
    await expect(page.getByRole('link',{name:'Open Render dashboard',exact:true})).toHaveAttribute('href','https://dashboard.render.com');
    const checkbox=page.locator('.guide-checklist input').first();await checkbox.check();
    await expect(page.locator('.guide-progress')).toHaveText('1/6');
    const faq=page.locator('details').filter({has:page.locator('summary',{hasText:'Live hone par kya sabko website dikhegi?'})});
    await faq.locator('summary').click();await expect(faq.locator('p')).toBeVisible();
    await page.getByRole('button',{name:'Print / Save guide as PDF',exact:true}).click();expect(await page.evaluate(()=>window.__printed)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:`artifacts/guide/${name}.png`});
    await page.getByRole('button',{name:'Brand settings kholein',exact:true}).click();await expect(page.getByLabel('Brand name',{exact:true})).toBeVisible();
    if(mobile)await page.getByRole('button',{name:'Open editor navigation',exact:true}).click();
    await page.getByRole('button',{name:'Help & go live',exact:true}).click();await expect(page.locator('.guide-progress')).toHaveText('1/6');
    expect(errors).toEqual([]);await context.close();
    console.log(`PASS ${name}: guide navigation, honest preview status, upload/device notes, hosting links, checklist persistence, FAQ and print control.`);
  }
  expect(await db.select().from(owners)).toEqual(originalOwners);expect(await db.select().from(siteSettings)).toEqual(originalSites);
  console.log('PASS: Help usage did not modify owner credentials or website content.');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{for(const browser of browsers)await browser.close();await db.delete(sessions).where(eq(sessions.tokenHash,tokenHash));await pool.end()});
