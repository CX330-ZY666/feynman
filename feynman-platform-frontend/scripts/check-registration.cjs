// Production-bundle regression with local disposable API fixtures only.
const {app,BrowserWindow}=require('electron');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
app.disableHardwareAcceleration();
const dist=path.resolve(__dirname,'../dist');
const token='test.'+Buffer.from(JSON.stringify({sub:'fixture-user'})).toString('base64url')+'.test';
let mode='duplicate',registrations=0,logins=0,profileRequests=0;
const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/api/')){
    res.setHeader('Content-Type','application/json');
    if(req.url==='/api/users/register'){
      registrations++;
      if(mode==='duplicate'){res.statusCode=400;return res.end(JSON.stringify({msg:'邮箱已注册'}));}
      return res.end(JSON.stringify(mode==='missing-token'?{}:{token,refreshToken:'fixture-refresh'}));
    }
    if(req.url==='/api/users/login')logins++;
    if(req.url==='/api/users/me'){
      profileRequests++;assert.equal(req.headers.authorization,'Bearer '+token);
      return res.end(JSON.stringify({id:'fixture-user',username:'注册回归测试',email:'test@example.invalid'}));
    }
    return res.end(JSON.stringify({knowledgePoints:[]}));
  }
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
  await new Promise(r=>server.listen(18993,'127.0.0.1',r));
  const w=new BrowserWindow({show:false,width:390,height:844,webPreferences:{partition:'registration-test-'+Date.now(),contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  w.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:/^https?:/.test(details.url)&&!details.url.startsWith('http://127.0.0.1:18993/')}));
  const js=code=>w.webContents.executeJavaScript(code,true);
  const wait=async code=>{for(let i=0;i<60;i++){if(await js(code))return;await sleep(100);}throw Error('Timed out: '+code);};
  const fill=async(confirm='Example!123')=>{
    for(const [name,value] of Object.entries({username:'注册回归测试',email:'test@example.invalid',password:'Example!123',confirmPassword:confirm})){
      await js(`(()=>{const input=document.querySelector('[name="${name}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await sleep(20);
    }
  };
  try{
    await w.loadURL('http://127.0.0.1:18993/#/register');
    await fill('Mismatch!123');await js("document.querySelector('form').requestSubmit()");
    await wait("document.querySelector('.auth-error')?.textContent.includes('不一致')");
    assert.equal(registrations,0);console.log('PASS: password mismatch makes no registration request');
    await fill();await js("document.querySelector('form').requestSubmit()");
    await wait("document.querySelector('.auth-error')?.textContent.includes('邮箱已注册')");
    assert.equal(await js('location.hash'),'#/register');assert.equal(await js("localStorage.getItem('token')"),null);
    console.log('PASS: failed registration stays on form without creating a session');
    mode='missing-token';await js("document.querySelector('form').requestSubmit()");
    await wait("document.querySelector('.auth-error')?.textContent.includes('未收到登录凭证')");
    assert.equal(await js('location.hash'),'#/register');console.log('PASS: malformed response does not enter protected routes');
    mode='success';await js("document.querySelector('form').requestSubmit()");
    await wait("location.hash==='#/'&&!!document.querySelector('.dashboard-header')");
    await wait("document.querySelector('.shell-account-link')?.textContent.includes('注册回归测试')");
    assert.equal(await js("localStorage.getItem('token')"),token);
    assert.equal(await js("localStorage.getItem('refreshToken')"),'fixture-refresh');
    assert.equal(logins,0);assert.ok(profileRequests>0);
    console.log('PASS: registration enters home, restores nickname, persists both tokens, no extra login request');
    const reloaded=new Promise(resolve=>w.webContents.once('did-finish-load',resolve));
    w.reload();await reloaded;await wait("!!document.querySelector('.dashboard-header')");
    assert.equal(await js('location.hash'),'#/');console.log('PASS: reload retains authenticated home');
    app.exit(0);
  }catch(e){console.error(e);app.exit(1);}finally{server.close();}
});
