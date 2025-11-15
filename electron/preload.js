// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  createPlayerWindow: (playerName, roomCode, sessionId) => 
    ipcRenderer.invoke('create-player-window', playerName, roomCode, sessionId),
  closePlayerWindow: (playerName) => 
    ipcRenderer.invoke('close-player-window', playerName),
  closeAllPlayerWindows: () => 
    ipcRenderer.invoke('close-all-player-windows')
});