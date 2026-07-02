const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const qrcode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

let mainWindow;
let client;
let userDataDir;
let configPath;
let lockConfigPath;
let sessionDir;
let config;
let targetDigits;
let targetChatId;
let lockConfig;

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return { targetPhoneNumber: '' };
  }
}

function saveConfig() {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function loadLockConfig() {
  try {
    return JSON.parse(fs.readFileSync(lockConfigPath, 'utf-8'));
  } catch {
    return { method: null, hash: null };
  }
}

function saveLockConfig(cfg) {
  fs.writeFileSync(lockConfigPath, JSON.stringify(cfg, null, 2));
}

function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function initStorage() {
  userDataDir = app.getPath('userData');
  fs.mkdirSync(userDataDir, { recursive: true });
  configPath = path.join(userDataDir, 'config.json');
  lockConfigPath = path.join(userDataDir, 'lock.json');
  sessionDir = path.join(userDataDir, 'wwebjs_auth');

  config = loadConfig();
  targetDigits = (config.targetPhoneNumber || '').replace(/[^0-9]/g, '');
  targetChatId = targetDigits ? `${targetDigits}@c.us` : null;
  lockConfig = loadLockConfig();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 700,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  mainWindow.setContentProtection(true);
  mainWindow.loadFile('index.html');

  mainWindow.on('blur', () => send('lock', true));
  mainWindow.on('focus', () => send('lock', false));
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

let isClientReady = false;

async function loadChatHistory() {
  try {
    const numberId = await client.getNumberId(targetDigits);
    if (!numberId) {
      send('status', `error: ${config.targetPhoneNumber} is not a WhatsApp number`);
      return;
    }
    targetChatId = numberId._serialized;
    const chat = await client.getChatById(targetChatId);
    const messages = await chat.fetchMessages({ limit: 50 });
    const history = await Promise.all(messages.map(formatMessage));
    send('history', history);
  } catch (err) {
    console.error('LOAD CHAT ERROR', err);
    send('status', `error: could not load chat (${err.message})`);
  }
}

function getChromiumExecutablePath() {
  const base = app.isPackaged ? path.join(process.resourcesPath, 'chromium') : path.join(__dirname, 'chromium');
  const exe = path.join(base, 'chrome-win64', 'chrome.exe');
  return fs.existsSync(exe) ? exe : undefined;
}

function startClient() {
  if (client) return;
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionDir }),
    puppeteer: { headless: true, executablePath: getChromiumExecutablePath() },
    webVersionCache: {
      type: 'remote',
      remotePath:
        'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1023239809-alpha.html',
    },
  });

  client.on('qr', async (qr) => {
    console.log('QR RECEIVED');
    const dataUrl = await qrcode.toDataURL(qr);
    send('qr', dataUrl);
  });

  client.on('auth_failure', (msg) => {
    console.error('AUTH FAILURE', msg);
  });

  client.on('loading_screen', (percent, message) => {
    console.log('LOADING', percent, message);
  });

  client.on('ready', async () => {
    console.log('CLIENT READY');
    isClientReady = true;
    send('status', 'connected');
    await loadChatHistory();
  });

  client.on('message', async (msg) => {
    if (msg.from === targetChatId || msg.to === targetChatId) {
      send('message', await formatMessage(msg));
    }
  });

  client.on('disconnected', () => {
    isClientReady = false;
    send('status', 'disconnected');
  });

  client.initialize().catch((err) => {
    console.error('INITIALIZE ERROR', err);
  });
}

async function formatMessage(msg) {
  const out = {
    id: msg.id._serialized,
    body: msg.body,
    fromMe: msg.fromMe,
    timestamp: msg.timestamp,
    hasMedia: msg.hasMedia,
    mediaType: msg.type,
  };
  if (msg.hasMedia) {
    try {
      const media = await msg.downloadMedia();
      if (media) {
        out.media = {
          mimetype: media.mimetype,
          data: media.data,
        };
      }
    } catch (err) {
      console.error('MEDIA DOWNLOAD ERROR', err);
    }
  }
  return out;
}

ipcMain.handle('send-message', async (_event, text) => {
  await client.sendMessage(targetChatId, text);
  return true;
});

ipcMain.handle('pick-and-send-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const filePath = result.filePaths[0];
  const media = MessageMedia.fromFilePath(filePath);
  await client.sendMessage(targetChatId, media);
  return { mimetype: media.mimetype, data: media.data };
});

ipcMain.handle('get-target', () => config.targetPhoneNumber);

ipcMain.handle('set-target-number', async (_event, number) => {
  config.targetPhoneNumber = number;
  saveConfig();
  targetDigits = number.replace(/[^0-9]/g, '');
  targetChatId = `${targetDigits}@c.us`;
  if (isClientReady) {
    send('status', 'connected');
    await loadChatHistory();
  } else {
    startClient();
  }
  return true;
});

ipcMain.handle('lock-get-status', () => ({
  method: lockConfig.method,
  configured: !!lockConfig.hash,
}));

ipcMain.handle('lock-set-secret', (_event, { method, secret }) => {
  lockConfig = { method, hash: hashSecret(secret) };
  saveLockConfig(lockConfig);
  return true;
});

ipcMain.handle('lock-clear-secret', () => {
  lockConfig = { method: null, hash: null };
  saveLockConfig(lockConfig);
  return true;
});

ipcMain.handle('lock-verify', (_event, secret) => {
  if (!lockConfig.hash) return true;
  return hashSecret(secret) === lockConfig.hash;
});

ipcMain.on('window-close', () => mainWindow && mainWindow.close());
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

function initAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    send('update-status', { state: 'available', version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    send('update-status', { state: 'downloading', percent: Math.floor(progress.percent) });
  });

  autoUpdater.on('update-downloaded', () => {
    send('update-status', { state: 'ready' });
  });

  autoUpdater.on('error', (err) => {
    console.error('updater error', err.message);
  });

  setTimeout(() => autoUpdater.checkForUpdates(), 5000);
}

ipcMain.on('update-install', () => {
  autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
  initStorage();
  createWindow();
  if (config.targetPhoneNumber) startClient();
  initAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
