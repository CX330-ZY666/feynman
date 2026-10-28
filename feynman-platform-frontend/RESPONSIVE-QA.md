# 移动适配与桌面回归

本轮新增样式集中在 `src/styles/responsive.css`，所有规则仅在不超过900px时生效；没有改后端、API或Three.js业务逻辑。

已用项目自带Electron/Chromium和本地模拟API检查360、375、390、430、768、1366、1920px，共77个路由/宽度组合。使用长标题、连续英文和宽图片作为知识点内容，不接触真实账号数据。

覆盖登录、注册、首页、标题浏览、新增/编辑知识点、AI助手、账号、语音复述、测评设置、费曼问答选择页。检查页面横向溢出、手机全部导航入口、搜索聚焦宽度；1366和1920px分别比较移除/恢复新增CSS后的主要容器位置、宽高、字号，22项桌面比较一致。

3D页面本轮只调整手机画布外壳、搜索和详情浮层的尺寸，仍需实际手机验证WebGL性能、触控和设备键盘；自动布局检查不等于真实iOS/Android兼容性全覆盖。

## 复现

在前端目录PowerShell启动专用Vite服务（不要连接真实后端）：

```powershell
$env:VITE_API_URL='http://127.0.0.1:18991/api'
npx vite --host 127.0.0.1 --port 5176 --strictPort
```

另一个PowerShell，在前端目录执行以下命令。每个宽度使用独立进程，避免截图引擎长期运行累积内存。测试自行启动18991端口模拟API，运行时请保持该端口空闲。

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
foreach ($width in @(360,375,390,430,768,1366,1920)) {
    $env:RESPONSIVE_WIDTH=[string]$width
    $p=Start-Process -FilePath "$PWD\node_modules\electron\dist\electron.exe" -ArgumentList @("$PWD\scripts\check-responsive.cjs") -WindowStyle Hidden -PassThru
    $p.WaitForExit()
    if ($p.ExitCode -ne 0) { throw "Responsive check failed: $width" }
}
```

报告与截图保存在项目根目录 `deploy-local/responsive-results`（不提交Git）。没有指定宽度时仅检查390px。测试通过后仍应在真实手机浏览器检查软键盘、安全区、录音授权和3D触控。
