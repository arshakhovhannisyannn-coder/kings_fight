// Preload (CommonJS, because sandboxed preload scripts cannot be ES modules).
// Exposes a minimal save API and a few window controls to the renderer (contextIsolation stays on).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('saveAPI', {
  load: () => ipcRenderer.invoke('save:load'),
  save: (json) => ipcRenderer.invoke('save:write', json),
});
contextBridge.exposeInMainWorld('appAPI', {
  quit: () => ipcRenderer.invoke('app:quit'),
  setFullscreen: (on) => ipcRenderer.invoke('app:fullscreen', !!on),
  onFullscreen: (cb) => ipcRenderer.on('app:fullscreen-changed', (_e, on) => cb(on)),
});
