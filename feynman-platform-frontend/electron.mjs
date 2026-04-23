import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 开发模式：加载 Vite dev server
  // 生产模式：加载打包后的 index.html
  // 打包后使用 app.getAppPath() 获取正确路径
  const basePath = app.isPackaged ? app.getAppPath() : __dirname;
  const indexHtmlPath = path.join(basePath, 'dist', 'index.html');
  const indexHtmlUrl = pathToFileURL(indexHtmlPath).href;
  const startUrl = process.env.ELECTRON_START_URL || indexHtmlUrl;
  
  console.log('App is packaged:', app.isPackaged);
  console.log('Base path:', basePath);
  console.log('Loading URL:', startUrl);
  
  win.loadURL(startUrl);
  
  // 加载失败时显示错误
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // 开发模式或按 F12 打开 DevTools
  if (process.env.ELECTRON_START_URL) {
    win.webContents.openDevTools();
  }
  
  // 按 F12 打开 DevTools（生产模式也可用）
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      win.webContents.toggleDevTools();
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
