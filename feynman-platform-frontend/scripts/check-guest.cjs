// End-to-end UI flow against local API fixtures. No real users or AI requests.
const {app,BrowserWindow}=require('electron');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
app.disableHardwareAcceleration();app.commandLine.appendSwitch('force-device-scale-factor','1');
const dist=path.resolve(__dirname,'../dist'),out=path.resolve(__dirname,'../../deploy-local/guest-results');fs.mkdirSync(out,{recursive:true});
const guestToken='test.'+Buffer.from(JSON.stringify({sub:'guest-test'})).toString('base64url')+'.guest';
const normalToken='test.'+Buffer.from(JSON.stringify({sub:'guest-test'})).toString('base64url')+'.normal';
let created=false,upgraded=false,remaining=5,loginRequests=0;
const points=[1,2,3].map(i=>({_id:'sample-'+i,title:'示例知识点 '+i,content:'<p>这是独立的体验内容。</p>',tags:[],status:'learning',createdAt:'2026-10-29T10:00:00'}));
const server=http.createServer((req,res)=>{
 if(req.url.startsWith('/api/')){
  res.setHeader('Content-Type','application/json');
  if(req.url==='/api/users/guest'){created=true;return res.end(JSON.stringify({token:guestToken}));}
  if(req.url==='/api/users/login'){loginRequests++;res.statusCode=400;return res.end('{}');}
  if(req.url==='/api/users/me')return res.end(JSON.stringify({_id:'guest-test',username:upgraded?'正式测试用户':'体验访客',email:upgraded?'test@example.invalid':null,guest:!upgraded,guestExpiresAt:upgraded?null:new Date(Date.now()+86400000).toISOString()}));
  if(req.url==='/api/users/guest/usage')return res.end(JSON.stringify({remaining,evaluationRemaining:1}));
  if(req.url==='/api/users/register'){assert.equal(req.headers.authorization,'Bearer '+guestToken);upgraded=true;return res.end(JSON.stringify({token:normalToken,refreshToken:'new-refresh'}));}
  if(req.url==='/api/ai/rag-qa-stream'){remaining=0;res.setHeader('X-Guest-AI-Remaining','0');res.statusCode=429;return res.end(JSON.stringify({msg:'体验额度已达上限，请注册正式账号'}));}
  return res.end(JSON.stringify({knowledgePoints:points}));
 }
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 await new Promise(r=>server.listen(18994,'127.0.0.1',r));
 const w=new BrowserWindow({show:false,width:390,height:844,webPreferences:{partition:'guest-test-'+Date.now(),contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 w.webContents.session.webRequest.onBeforeRequest((d,cb)=>cb({cancel:/^https?:/.test(d.url)&&!d.url.startsWith('http://127.0.0.1:18994/')}));
 const js=c=>w.webContents.executeJavaScript(c,true);
 const wait=async c=>{for(let i=0;i<70;i++){if(await js(c))return;await pause(100);}throw Error('Timed out: '+c);};
 try{
  await w.loadURL('http://127.0.0.1:18994/#/login');await wait("!!document.querySelector('.guest-entry-button')");await pause(1200);
  for(const width of [390,1366]){w.setContentSize(width,900);await pause(100);assert.ok(await js('document.documentElement.scrollWidth<=innerWidth+1'));fs.writeFileSync(path.join(out,`login-${width}.png`),(await w.webContents.capturePage()).toPNG());}
  await js("document.querySelector('.guest-entry-button').click()");await wait("!!document.querySelector('.guest-banner')&&document.querySelectorAll('.kp-card').length===3");
  assert.ok(created);assert.equal(loginRequests,0);assert.equal(await js("localStorage.getItem('refreshToken')"),null);console.log('PASS: one-click guest entry, no credentials or login request');await pause(1200);
  assert.ok(await js("document.querySelector('.guest-banner').textContent.includes('AI交流剩余 5 次')&&document.querySelector('.guest-banner').textContent.includes('结束评估剩余 1 次')"));
  for(const width of [390,1366]){w.setContentSize(width,900);await pause(100);assert.ok(await js('document.documentElement.scrollWidth<=innerWidth+1'));fs.writeFileSync(path.join(out,`home-${width}.png`),(await w.webContents.capturePage()).toPNG());}
  await js("location.hash='/agent'");await wait("!!document.querySelector('.chat-input-form input')");
  await js(`(()=>{let e=document.querySelector('.chat-input-form input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'什么是费曼学习法？');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause(50);
  await js("document.querySelector('.chat-input-form').requestSubmit()");await wait("document.querySelector('.chat-window').textContent.includes('体验额度已达上限')");
  await wait("document.querySelector('.guest-banner').textContent.includes('剩余 0 次')");console.log('PASS: trial AI limit is shown to the user, counter updates');
  await js("document.querySelector('.guest-banner a').click()");await wait("!!document.querySelector('.guest-upgrade-note')");assert.equal(await js("!!document.querySelector('.shell-nav')"),false);
  for(const [name,value]of Object.entries({username:'正式测试用户',email:'test@example.invalid',password:'Example!123',confirmPassword:'Example!123'})){
   await js(`(()=>{let e=document.querySelector('[name="${name}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause(20);
  }
  await js("document.querySelector('form').requestSubmit()");await wait("!!document.querySelector('.dashboard-header')&&!document.querySelector('.guest-banner')");
  assert.equal(await js("document.querySelectorAll('.kp-card').length"),3);assert.equal(await js("localStorage.getItem('token')"),normalToken);assert.equal(await js("localStorage.getItem('refreshToken')"),'new-refresh');
  console.log('PASS: registration upgrades the active trial, preserves examples and replaces session');app.exit(0);
 }catch(e){console.error(e);app.exit(1);}finally{server.close();}
});
