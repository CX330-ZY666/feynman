// Local production-bundle integration test; fake microphone and local API only.
const {app,BrowserWindow}=require('electron');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('force-device-scale-factor','1');
const dist=path.resolve(__dirname,'../dist'),out=path.resolve(__dirname,'../../deploy-local/practice-chat');fs.mkdirSync(out,{recursive:true});
let asks=[],summaries=[],evaluations=[],transcribes=0,failNext=false,autoEnd=false,voiceResult='通过语音讲解费曼学习法',guest=false,transcribeDelay=0;
const server=http.createServer(async(req,res)=>{
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const raw=Buffer.concat(chunks).toString();let body={};try{body=JSON.parse(raw);}catch{}
 if(req.url.startsWith('/api/')){
  res.setHeader('Content-Type','application/json');
  if(req.url==='/api/users/me')return res.end(JSON.stringify({_id:'test-user',username:'聊天测试',guest}));
  if(req.url==='/api/users/guest/usage')return res.end(JSON.stringify({remaining:5,evaluationRemaining:1}));
  if(req.url.startsWith('/api/knowledge-points/'))return res.end(JSON.stringify({_id:req.url.split('/').pop(),title:'费曼学习法',content:'<p>用自己的语言讲清楚概念，再用例子检查理解。</p>'}));
  if(req.url==='/api/feynman-practice/ask'){
   asks.push(body);await new Promise(r=>setTimeout(r,150));
   if(failNext){failNext=false;res.statusCode=500;return res.end(JSON.stringify({msg:'本地模拟AI失败'}));}
   return res.end(JSON.stringify({question:'你能举一个例子吗？',shouldContinue:!autoEnd}));
  }
  if(req.url==='/api/feynman-practice/summary'){summaries.push(body);return res.end(JSON.stringify({summary:'本次练习已完成',questionCount:1,suggestions:['继续用例子解释']}));}
  if(req.url==='/api/feynman-practice/evaluate-understanding'){evaluations.push(body);return res.end(JSON.stringify({understandingScore:81,feedback:'能够用自己的语言解释概念'}));}
  if(req.url==='/api/audio/transcribe'){transcribes++;assert.ok(req.headers['content-type'].startsWith('multipart/form-data; boundary='));await new Promise(r=>setTimeout(r,transcribeDelay));return res.end(JSON.stringify({result:voiceResult}));}
  return res.end('{}');
 }
 const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(dist,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
 await new Promise(r=>server.listen(18995,'127.0.0.1',r));
 const w=new BrowserWindow({show:false,width:1366,height:900,webPreferences:{partition:'practice-'+Date.now(),contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 w.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(true));
 w.webContents.session.webRequest.onBeforeRequest((d,cb)=>cb({cancel:/^https?:/.test(d.url)&&!d.url.startsWith('http://127.0.0.1:18995/')}));
 const js=code=>w.webContents.executeJavaScript(code,true);
 const wait=async code=>{for(let i=0;i<150;i++){if(await js(code))return;await pause(100);}throw Error('Timed out: '+code);};
 const fill=async value=>{await js(`(()=>{const e=document.querySelector('#practice-message');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause(50);};
 const session=async id=>{await js(`location.hash='/feynman-practice/${id.repeat(24)}'`);await wait("!!document.querySelector('#practice-message')&&!document.querySelector('.pc-summary')");await pause(250);};
 try{
  await w.loadURL('http://127.0.0.1:18995/#/login');
  await js("localStorage.setItem('token','test.'+btoa(JSON.stringify({sub:'test-user'}))+'.test');location.reload()");await pause(500);
  await session('a');await fill('用简单的语言向别人讲解，发现不足再学习。');
  await js("document.querySelector('#practice-message').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true}))");await pause(100);assert.equal(asks.length,0);
  assert.ok(await js("window.matchMedia('(min-width: 769px) and (pointer: fine)').matches"));
  await js("document.querySelector('#practice-message').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));document.querySelector('.pc-send').click();document.querySelector('.pc-send').click()");await wait("document.querySelectorAll('.pc-ai').length===2");assert.equal(asks.length,1);assert.equal(asks[0].conversationHistory.length,1);
  console.log('PASS: one-click text send, IME safety, duplicate-submit guard');
  failNext=true;await fill('再举一个例子解释。');await js("document.querySelector('.pc-send').click()");await wait("document.querySelector('.pc-composer').textContent.includes('本地模拟AI失败')");
  const count=await js("document.querySelectorAll('.pc-user').length");await js("[...document.querySelectorAll('.pc-user button')].find(b=>b.textContent==='重试').click()");await wait("document.querySelectorAll('.pc-ai').length===3");assert.equal(await js("document.querySelectorAll('.pc-user').length"),count);
  console.log('PASS: AI failure preserves the message; retry does not duplicate it');
  for(const [width,height] of [[1920,1080],[1366,768],[768,1024],[390,844],[375,812]]){w.setContentSize(width,height);await pause(250);assert.ok(await js('document.documentElement.scrollWidth<=innerWidth+1'));fs.writeFileSync(path.join(out,`chat-${width}.png`),(await w.webContents.capturePage()).toPNG());}
  await js("[...document.querySelectorAll('.pc-actions button')][0].click()");await wait("!!document.querySelector('.pc-summary')");assert.equal(summaries.at(-1).conversationHistory.length,5);assert.equal(evaluations.at(-1).conversationHistory.at(-1).role,'ai');
  await js("document.querySelector('.pc-summary h2').click()");assert.ok(await js("!!document.querySelector('.pc-summary')"));await js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  assert.equal(await js("!!document.querySelector('.pc-summary')"),false);
  console.log('PASS: desktop/mobile widths, complete latest summary, accessible modal dismissal');
  w.setContentSize(1366,900);autoEnd=true;await session('b');await fill('最后一轮讲解');await js("document.querySelector('.pc-send').click()");await wait("!!document.querySelector('.pc-summary')");assert.equal(evaluations.at(-1).conversationHistory.at(-2).content,'最后一轮讲解');assert.equal(evaluations.at(-1).conversationHistory.at(-1).role,'ai');
  console.log('PASS: automatic ending includes the newest user and AI messages');autoEnd=false;
  await session('c');await fill('保留的文字草稿');await js("document.querySelector('.pc-mode').click()");await js("[...document.querySelectorAll('.pc-voice button')].find(b=>b.textContent.includes('开始录音')).click()");await wait("document.querySelector('.pc-voice').textContent.includes('正在录音')");await pause(1200);
  const before=asks.length;await js("[...document.querySelectorAll('.pc-voice button')].find(b=>b.textContent==='结束并发送').click()");await wait("document.querySelectorAll('.pc-ai').length===2");assert.equal(transcribes,1);assert.equal(asks.length,before+1);assert.equal(asks.at(-1).userExplanation,voiceResult);
  console.log('PASS: fake microphone -> WAV -> multipart transcription -> automatic single message');
  await js("document.querySelector('.pc-mode').click()");assert.equal(await js("document.querySelector('#practice-message').value"),'保留的文字草稿');await js("document.querySelector('.pc-mode').click()");
  await js("[...document.querySelectorAll('.pc-voice button')].find(b=>b.textContent.includes('开始录音')).click()");await wait("document.querySelector('.pc-voice').textContent.includes('正在录音')");await js("[...document.querySelectorAll('.pc-voice button')].find(b=>b.textContent==='取消').click()");await pause(400);assert.equal(transcribes,1);assert.equal(asks.length,before+1);
  voiceResult='';await js("[...document.querySelectorAll('.pc-voice button')].find(b=>b.textContent.includes('开始录音')).click()");await wait("document.querySelector('.pc-voice').textContent.includes('正在录音')");await pause(1000);await js("[...document.querySelectorAll('.pc-voice button')].find(b=>b.textContent==='结束并发送').click()");await wait("document.querySelector('.pc-voice').textContent.includes('没有识别到有效文字')");assert.equal(asks.length,before+1);
  console.log('PASS: cancellation and empty transcription never send a message');
  voiceResult='不应进入新知识点的旧语音';transcribeDelay=1500;const transcriptsBefore=transcribes;
  await js("[...document.querySelectorAll('.pc-voice button')].find(b=>b.textContent==='重试转写').click();[...document.querySelectorAll('.pc-voice button')].find(b=>b.textContent==='重试转写')?.click()");
  await pause(200);await session('d');await pause(1700);assert.equal(transcribes,transcriptsBefore+1);assert.equal(asks.length,before+1);assert.equal(await js("document.querySelectorAll('.pc-user').length"),0);
  console.log('PASS: transcription retry is single-flight; navigation ignores late transcription');transcribeDelay=0;
  await js("navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('denied','NotAllowedError')};document.querySelector('.pc-mode').click()");
  await js("[...document.querySelectorAll('.pc-voice button')].find(b=>b.textContent.includes('开始录音')).click()");await wait("document.querySelector('.pc-voice').textContent.includes('麦克风权限被拒绝')");assert.equal(asks.length,before+1);
  console.log('PASS: microphone denial shows an actionable error without sending');
  guest=true;await w.reload();await pause(600);await wait("!!document.querySelector('.pc-mode')");await js("document.querySelector('.pc-mode').click()");await wait("document.querySelector('.pc-input-wrap').textContent.includes('体验账号暂不支持')");assert.equal(await js("!!document.querySelector('.pc-voice')"),false);
  console.log('PASS: guest transcription restriction remains unchanged');app.exit(0);
 }catch(e){console.error(e);fs.writeFileSync(path.join(out,'failure.png'),(await w.webContents.capturePage()).toPNG());app.exit(1);}finally{server.close();}
});
