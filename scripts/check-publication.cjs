/* Publication regression: test credentials/files only. Never resets the owner's password. */
require('dotenv').config({quiet:true});
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),zlib=require('node:zlib');
const {randomBytes,createHash}=require('node:crypto');
const {chromium,firefox,webkit,devices,request,expect}=require('@playwright/test');
const {eq,inArray,sql}=require('drizzle-orm');
const cache=new Map();
function source(name){const file=path.resolve(name);if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const req=s=>s.startsWith('@/')?source('src/'+s.slice(2)+'.ts'):s.startsWith('.')?source(path.resolve(path.dirname(file),s)+'.ts'):require(s);new Function('require','module','exports',code)(req,mod,mod.exports);return mod.exports;}
const {db,pool}=source('src/db/index.ts');
const {owners,sessions,siteSettings,media,mediaUploads}=source('src/db/schema.ts');
const {defaultContent}=source('src/lib/site-data.ts');
const {canonicalContent}=source('src/lib/content-version.ts');
const baseURL='http://localhost:3000',runId=randomBytes(5).toString('hex'),prefix=`__publication_${runId}_`;
const hashes=[],browsers=[],testNames=[];let originalRows,originalOwners,initialContent,anon,api;
const copy=v=>JSON.parse(JSON.stringify(v));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function ownerToken(){const token=randomBytes(32).toString('hex');const tokenHash=createHash('sha256').update(token).digest('hex');hashes.push(tokenHash);await db.insert(sessions).values({tokenHash,expiresAt:new Date(Date.now()+3600000)});return token;}
function crc(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function png(){const part=(type,data)=>{const t=Buffer.from(type),l=Buffer.alloc(4),c=Buffer.alloc(4);l.writeUInt32BE(data.length);c.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([l,t,data,c]);};const h=Buffer.alloc(13);h.writeUInt32BE(2,0);h.writeUInt32BE(3,4);h[8]=8;h[9]=6;const row=Buffer.from([0,0,0,0,0,250,190,40,255]);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),part('IHDR',h),part('IDAT',zlib.deflateSync(Buffer.concat([row,row,row]))),part('IEND',Buffer.alloc(0))]);}
async function snapshot(){return(await(await anon.get('/api/site?format=snapshot')).json());}
async function stored(check){await expect.poll(async()=>check((await snapshot()).content),{timeout:25000,intervals:[200,400,700]}).toBe(true);}
async function cleanupPublished(){
 const rows=await db.select().from(siteSettings).where(eq(siteSettings.id,'main'));if(!rows.length)return;
 const content=copy(rows[0].content);
 const files=await db.select({id:media.id}).from(media).where(sql`left(${media.filename}, ${prefix.length}) = ${prefix}`);
 const urls=new Set(files.map(file=>'/api/media/'+file.id));
 if(testNames.includes(content.brandName))content.brandName=initialContent.brandName;
 content.gallery=content.gallery.filter(item=>!urls.has(item.image));
 content.releases=content.releases.filter(item=>!urls.has(item.videoUrl));
 content.files=(content.files||[]).filter(file=>!urls.has(file.url));
 if(!originalRows.length&&canonicalContent(content)===canonicalContent(initialContent))await db.delete(siteSettings).where(eq(siteSettings.id,'main'));
 else await db.update(siteSettings).set({content,updatedAt:new Date()}).where(eq(siteSettings.id,'main'));
}
async function exercise(engine,label,{bridge=false,mobile=false}={}){
 const token=await ownerToken();
 const browser=await engine.launch({headless:true,...(engine===chromium?{args:['--no-sandbox']}:{})});browsers.push(browser);
 const context=await browser.newContext({viewport:{width:1440,height:1000},...(mobile?devices['iPhone 13']:{})});
 await context.addInitScript(token=>{sessionStorage.setItem('hansa.editor.session.v2',token);window.__xhrUsed=0;const open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(...args){window.__xhrUsed++;return open.apply(this,args)};const nativeFetch=window.fetch.bind(window);window.fetch=(input,init)=>{if(init?.headers instanceof Headers)init={...init,headers:JSON.parse(JSON.stringify(init.headers))};return nativeFetch(input,init);};},token);
 const page=await context.newPage();let actionPosts=0;const errors=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
 page.on('request',r=>{if(r.method()==='POST'&&r.headers()['next-action'])actionPosts++;});
 if(bridge)await page.route('**/api/**',async route=>{const req=route.request(),u=new URL(req.url());if(/^\/api\/media\/[a-f0-9-]{36}$/i.test(u.pathname)){await route.continue();return;}await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Sandbox is secured with traffic access token. Token header e2b-traffic-access-token is missing',code:403})});});
 else await page.route('**/api/**',async route=>{const headers={...route.request().headers()};delete headers.authorization;await route.continue({headers});});
 await page.goto(baseURL+'/studio',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{name:'Welcome to your studio.',exact:true})).toBeVisible({timeout:20000});
 expect((await context.cookies()).filter(c=>c.name==='hansa_owner')).toHaveLength(0);
 const name=`Hansa verified ${runId} ${label}`;testNames.push(name);
 await page.getByLabel('Website / company name',{exact:true}).fill(name);
 await stored(content=>content.brandName===name);
 await expect(page.locator('.autosave-confirmed')).toContainText('Server verified');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(page.locator('.studio-notice.success')).toContainText('verify ho gaya');
 const upload=page.locator('.quick-publish-panel input[type="file"]');
 const posterName=prefix+label.replace(/\W/g,'')+'-poster.PNG';
 await upload.setInputFiles({name:posterName,mimeType:'',buffer:png()});
 await stored(content=>content.gallery[0].title.includes(runId)&&content.gallery[0].image.startsWith('/api/media/'));
 await expect(page.locator('.recent-upload-confirmation.verified')).toContainText(posterName);
 const published=await snapshot();const posterURL=published.content.gallery[0].image;
 expect((await anon.get(posterURL)).headers()['content-type']).toBe('image/png');
 const countBefore=context.pages().length;
 await page.getByRole('button',{name:'Website par dekhein',exact:true}).click();
 const preview=page.getByRole('dialog',{name:'Website live preview',exact:true});
 await expect(preview).toBeVisible({timeout:15000});
 expect(context.pages().length).toBe(countBefore);
 await expect(preview.locator('.brand strong').first()).toHaveText(name);
 await expect(preview.locator('#gallery .gallery-card').first().locator('img')).toHaveAttribute('src',posterURL);
 await expect.poll(async()=>preview.locator('#gallery .gallery-card').first().locator('img').evaluate(img=>img.naturalWidth)).toBe(2);
 expect(await preview.locator('#gallery .gallery-card').first().locator('img').evaluate(img=>getComputedStyle(img).objectFit)).toBe('contain');
 await preview.locator('#gallery .gallery-card').first().click();
 await expect(page.getByRole('dialog')).toHaveCount(2);
 await page.keyboard.press('Escape');await expect(preview).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(1);
 await preview.getByRole('button',{name:'Close dialog',exact:true}).click();
 console.log(`PASS ${label}: real server save verified, new PNG poster is first and fully visible, preview stays in the same screen.`);
 const textName=prefix+label.replace(/\W/g,'')+'.custom';
 await upload.setInputFiles({name:textName,mimeType:'',buffer:Buffer.from('x')});
 await stored(content=>(content.files||[]).some(file=>file.filename===textName));
 await expect(page.locator('.recent-upload-confirmation.verified')).toContainText(textName);
 const text=(await snapshot()).content.files.find(file=>file.filename===textName);
 const response=await anon.get(text.url);expect(response.status()).toBe(200);expect(await response.text()).toBe('x');expect(response.headers()['content-disposition']).toMatch(/^attachment;/);expect(response.headers()['content-security-policy']).toContain('sandbox');
 await page.getByRole('button',{name:'Website par dekhein',exact:true}).click();
 await expect(preview.locator('#downloads')).toContainText(textName);
 await preview.getByRole('button',{name:'Close dialog',exact:true}).click();
 if(mobile)await page.getByRole('button',{name:'Open editor navigation',exact:true}).click();
 await page.locator('.studio-sidebar').getByRole('button',{name:'Media library',exact:true}).click();
 await page.getByLabel('Upload destination',{exact:true}).selectOption('library');
 const jpegName=prefix+label.replace(/\W/g,'')+'-library.JPG';
 await page.locator('.library-publish-controls input[type="file"]').setInputFiles({name:jpegName,mimeType:'image/jpeg',buffer:fs.readFileSync('public/images/desi-vibes.jpg')});
 const card=page.locator('.media-library-card').filter({has:page.locator('strong',{hasText:jpegName})});
 await expect(card).toContainText('Library only',{timeout:15000});
 const before=(await snapshot()).content.gallery.length;
 await card.getByRole('button',{name:'Add to website',exact:true}).click();
 await stored(content=>content.gallery.length===before+1&&content.gallery[0].title.includes('library'));
 await expect(card).toContainText('Added to website');
 await page.getByLabel('Upload destination',{exact:true}).selectOption('publish');
 const pdfName=prefix+label.replace(/\W/g,'')+'.pdf';
 await page.locator('.library-publish-controls input[type="file"]').setInputFiles({name:pdfName,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nTest document for upload verification.\n%%EOF')});
 await stored(content=>(content.files||[]).some(file=>file.filename===pdfName));
 const pdf=(await snapshot()).content.files.find(file=>file.filename===pdfName);
 const pdfResponse=await anon.get(pdf.url);expect(pdfResponse.headers()['content-type']).toBe('application/pdf');expect(pdfResponse.headers()['content-disposition']).toMatch(/^attachment;/);
 await page.getByRole('button',{name:'View downloads on website',exact:true}).click();
 await expect(preview.locator('#downloads')).toContainText(pdfName);
 await preview.getByRole('button',{name:'Close dialog',exact:true}).click();
 expect(await page.evaluate(()=>window.__xhrUsed)).toBe(0);
 if(bridge)expect(actionPosts).toBeGreaterThan(8);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`artifacts/publication-${label.replace(/\W/g,'-')}.png`,fullPage:true});
 await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByRole('heading',{name:'Welcome to your studio.',exact:true})).toBeVisible({timeout:20000});
 await expect(page.getByLabel('Website / company name',{exact:true})).toHaveValue(name);
 expect(errors).toEqual([]);
 console.log(`PASS ${label}: any-extension file, PDF, JPG, library-only→publish, reload persistence, no XHR, ${actionPosts} authenticated Server Actions.`);
 await context.close();await cleanupPublished();
}
async function run(){
 originalRows=await db.select().from(siteSettings).where(eq(siteSettings.id,'main'));originalOwners=await db.select().from(owners);
 anon=await request.newContext({baseURL});initialContent=(await snapshot()).content;
 const token=await ownerToken();api=await request.newContext({baseURL,extraHTTPHeaders:{'X-Hansa-Session':token}});
 expect((await anon.post('/api/site',{data:{content:initialContent}})).status()).toBe(401);
 expect((await anon.post('/api/uploads',{data:{filename:'x.txt',size:1}})).status()).toBe(401);
 expect((await api.post('/api/site',{headers:{Origin:'https://wrong-origin.example'},data:{content:initialContent}})).status()).toBe(403);
 const dangerous=copy(initialContent);dangerous.heroImage='javascript:alert(1)';expect((await api.post('/api/site',{data:{content:dangerous}})).status()).toBe(400);
 fs.mkdirSync('artifacts',{recursive:true});
 await exercise(chromium,'Chrome normal');
 await exercise(chromium,'Restricted preview bridge',{bridge:true});
 await exercise(firefox,'Firefox');
 await exercise(webkit,'iPhone Safari',{bridge:true,mobile:true});
 expect(await db.select().from(owners)).toEqual(originalOwners);
 console.log('ALL PUBLICATION CHECKS PASSED. Password unchanged; actual saved data and on-page rendering verified.');
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
 for(const browser of browsers)await browser.close();
 try{if(initialContent)await cleanupPublished();await db.transaction(async tx=>{await tx.delete(media).where(sql`left(${media.filename}, ${prefix.length}) = ${prefix}`);await tx.delete(mediaUploads).where(sql`left(${mediaUploads.filename}, ${prefix.length}) = ${prefix}`);if(hashes.length)await tx.delete(sessions).where(inArray(sessions.tokenHash,hashes));});console.log('Only test-owned content, sessions and files removed; user content preserved.');}finally{await api?.dispose();await anon?.dispose();await pool.end();}
});
