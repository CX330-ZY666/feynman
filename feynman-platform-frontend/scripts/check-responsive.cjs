// Test the local frontend with disposable API fixtures, never real user data.
const {app, BrowserWindow} = require('electron');
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor','1');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const out = path.join(__dirname, '../../deploy-local/responsive-results');
fs.mkdirSync(out, {recursive:true});
const point = {_id:'responsive-test',title:'移动适配测试：'+ '长标题'.repeat(12),content:'<p>'+ '长文档EnglishWithoutSpaces'.repeat(35) + '</p><p><img alt="test" style="width:1600px" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1kAAAAASUVORK5CYII="></p><pre>'+ 'code'.repeat(200) + '</pre>',tags:['学习'],status:'learning',reviewList:true,createdAt:'2026-10-28T12:00:00',updatedAt:'2026-10-28T12:00:00'};
const server = http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  let data=[];
  if(req.url.startsWith('/api/users/me')) data={username:'移动端测试',email:'test@example.invalid',id:'test'};
  else if(req.url==='/api/knowledge-points') data={knowledgePoints:[point,{...point,_id:'test-2',title:'短标题',content:'<p>简单内容</p>',reviewList:false}]};
  else if(req.url==='/api/knowledge-points/responsive-test') data=point;
  else if(req.url.includes('/graph')) data={nodes:[],links:[],edges:[]};
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));
});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const evaluate = (w,code) => w.webContents.executeJavaScript(code,true);
const geometry = `JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,items:[...document.querySelectorAll('.auth-card,.auth-header,.auth-body,.shell-nav,.shell-main,.dashboard-header,.kp-card,.search-box,.header-actions')].map(e=>{let r=e.getBoundingClientRect();let s=getComputedStyle(e);return {class:e.className,x:r.x,y:r.y,w:r.width,h:r.height,display:s.display,font:s.fontSize}})})`;
app.whenReady().then(async()=>{
  server.listen(18991,'127.0.0.1');
  const w=new BrowserWindow({show:false,width:1366,height:900,useContentSize:true,webPreferences:{offscreen:true,backgroundThrottling:false,contextIsolation:true,nodeIntegration:false}});
  const results=[];
  try{
    await w.loadURL('http://127.0.0.1:5176/#/login');
    await w.webContents.insertCSS('*{animation:none!important;transition:none!important}');
    for(const width of (process.env.RESPONSIVE_WIDTH ? [Number(process.env.RESPONSIVE_WIDTH)] : [390])){
      w.setContentSize(width,width>=1000?900:844);
      for(const route of ['/login','/register','/','/browse','/kp/new','/kp/edit/responsive-test','/agent','/account','/feynman/responsive-test','/quiz/responsive-test','/feynman-practice']){
        await evaluate(w,`localStorage.${route==='/login'||route==='/register'?'removeItem("token")':'setItem("token","test.'+Buffer.from(JSON.stringify({username:'测试账号'})).toString('base64url')+'.signature")'}`);
        await w.loadURL('http://127.0.0.1:5176/?case='+encodeURIComponent(width+route)+'#'+route);
        await pause(700);
        await w.webContents.insertCSS('*{animation:none!important;transition:none!important}');
        const data=JSON.parse(await evaluate(w,geometry));
        const actualRoute=await evaluate(w,'location.hash.slice(1)');
        const result={width,route,actualRoute,scroll:data.scroll,ok:data.scroll<=width+1&&actualRoute===route};
        if(width<=900&&route!=='/login'&&route!=='/register'){
          result.navigationUsable=await evaluate(w,`(()=>{let nav=document.querySelector('.shell-nav nav');let links=[...nav.querySelectorAll('a')];return nav.getBoundingClientRect().height>=44&&links.length===6&&links.every(e=>getComputedStyle(e).display!=='none')})()`);
          result.ok=result.ok&&result.navigationUsable;
        }
        if(route==='/'){
          result.searchStable=await evaluate(w,`(()=>{let input=document.querySelector('.search-input');let width=input.getBoundingClientRect().width;input.focus();return Math.abs(input.getBoundingClientRect().width-width)<1})()`);
          result.ok=result.ok&&result.searchStable;
        }
        if(!result.ok) result.offenders=await evaluate(w,`[...document.querySelectorAll('body *')].filter(e=>{let r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+2&&getComputedStyle(e).position!=='fixed'}).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width}))`);
        if(width>=1000){
          await evaluate(w,`window.__responsiveStyle=document.querySelector('style[data-vite-dev-id$="/responsive.css"]');window.__nextStyle=__responsiveStyle?.nextSibling;__responsiveStyle?.remove()`);
          const baseline=await evaluate(w,geometry);
          await evaluate(w,`if(window.__responsiveStyle)document.head.insertBefore(__responsiveStyle,__nextStyle)`);
          const current=await evaluate(w,geometry);
          result.desktopUnchanged=baseline===current;
          result.ok=result.ok&&result.desktopUnchanged;
        }
        if((width===390||width===1366)&&['/login','/','/kp/new','/agent'].includes(route)){
          const image=await w.webContents.capturePage();fs.writeFileSync(path.join(out,`${width}-${route.replace(/\W/g,'')||'home'}.png`),image.toPNG());
        }
        results.push(result);console.log(JSON.stringify(result));
      }
    }
    fs.writeFileSync(path.join(out,'results-'+(process.env.RESPONSIVE_WIDTH||'all')+'.json'),JSON.stringify(results,null,2));
    console.log('CHECKS',results.length,'FAILURES',results.filter(r=>!r.ok).length);
    app.exit(results.every(r=>r.ok)?0:1);
  }catch(e){console.error(e);app.exit(2);}finally{server.close();}
});
