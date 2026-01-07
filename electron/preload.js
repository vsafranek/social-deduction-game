// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  createPlayerWindow: (playerName, roomCode, sessionId) => 
    ipcRenderer.invoke('create-player-window', playerName, roomCode, sessionId),
  closePlayerWindow: (playerName) => 
    ipcRenderer.invoke('close-player-window', playerName),
  closeAllPlayerWindows: () => 
    ipcRenderer.invoke('close-all-player-windows'),
  closeApp: () => 
    ipcRenderer.invoke('close-app'),
  windowToggleFullscreen: () => 
    ipcRenderer.invoke('window-toggle-fullscreen'),
  windowIsFullscreen: () => 
    ipcRenderer.invoke('window-is-fullscreen'),
  windowSetAlwaysOnTop: (alwaysOnTop) => 
    ipcRenderer.invoke('window-set-always-on-top', alwaysOnTop),
  settingsGet: () => 
    ipcRenderer.invoke('settings-get'),
  settingsSet: (settings) => 
    ipcRenderer.invoke('settings-set', settings),
  settingsGetSetting: (key) => 
    ipcRenderer.invoke('settings-get-setting', key),
  settingsSetSetting: (key, value) => 
    ipcRenderer.invoke('settings-set-setting', key, value)
});