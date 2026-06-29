
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 256,
    height: 256,
    show: false,
    transparent: true,
    webPreferences: { offscreen: true }
  });
  await win.loadURL(process.argv[2]);
  const image = await win.webContents.capturePage();
  fs.writeFileSync('public/app-icon.png', image.toPNG());
  app.quit();
});
