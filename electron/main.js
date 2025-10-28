const { app, BrowserWindow } = require('electron');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');
const os = require('os');

let mainWindow;
const expressApp = express();
const PORT = 3001;
const VITE_PORT = 5173;
const isDev = !app.isPackaged;

console.log('🚀 Starting Electron app...');

function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIPAddress();

// Middleware
expressApp.use(cors());
expressApp.use(bodyParser.json());

// REQUEST LOGGER
expressApp.use((req, res, next) => {
  if (!req.path.includes('/@vite') && !req.path.includes('/node_modules')) {
    //console.log(`📨 ${req.method} ${req.path}`);
  }
  next();
});

console.log('📦 Middleware configured');

app.whenReady().then(async () => {
  console.log('⚡ Electron ready, starting server...');
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    const connectDB = require('./database');
    await connectDB();
    console.log('✅ MongoDB connected successfully');
    
    console.log('📡 Registering API routes...');
    const gameRoutes = require('./routes/gameRoutes');
    expressApp.use('/api/game', gameRoutes);
    console.log('✅ API routes registered at /api/game');
    
    // Health check
    expressApp.get('/api/health', (req, res) => {
      res.json({ status: 'ok', ip: LOCAL_IP, port: PORT });
    });
    
    // Vite proxy in development - FIX MEMORY LEAK
    if (isDev) {
      console.log('🔧 Development mode - setting up Vite proxy...');
      
      // Create proxy ONCE
      const viteProxy = createProxyMiddleware({
        target: `http://localhost:${VITE_PORT}`,
        changeOrigin: true,
        ws: true,
        logLevel: 'silent',
        // FIX: Increase max listeners
        onProxyReq: (proxyReq) => {
          proxyReq.setMaxListeners(50);
        },
        onProxyRes: (proxyRes) => {
          proxyRes.setMaxListeners(50);
        }
      });
      
      // Use proxy for non-API requests
      expressApp.use((req, res, next) => {
        if (req.path.startsWith('/api')) {
          return next();
        }
        viteProxy(req, res, next);
      });
      
    } else {
      console.log('📦 Production mode - serving static files...');
      expressApp.use(express.static(path.join(__dirname, '../dist')));
      expressApp.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return;
        res.sendFile(path.join(__dirname, '../dist/index.html'));
      });
    }
    
    // 404 handler for unmatched API routes
    expressApp.use('/api/*', (req, res) => {
      res.status(404).json({ error: 'API endpoint not found', path: req.path });
    });
    
    // Start server
    const serverInstance = expressApp.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('╔═══════════════════════════════════════════════════════╗');
      console.log('║         🎮  SOCIÁLNÍ DEDUKČNÍ HRA  🎮                ║');
      console.log('╚═══════════════════════════════════════════════════════╝');
      console.log('');
      console.log(`  🌐  Server: http://${LOCAL_IP}:${PORT}`);
      console.log(`  🔌  API: http://${LOCAL_IP}:${PORT}/api`);
      console.log(`  📊  MongoDB: Connected`);
      console.log('');
      console.log('  📱  Hráči zadají do mobilu:');
      console.log(`      http://${LOCAL_IP}:${PORT}`);
      console.log('');
      console.log('╚═══════════════════════════════════════════════════════╝');
      console.log('');
    });
    
    // Increase max listeners for server
    serverInstance.setMaxListeners(50);
    
    createWindow();
    
  } catch (error) {
    console.error('❌ FATAL ERROR during startup:', error);
    process.exit(1);
  }
});

function createWindow() {
  console.log('🪟 Creating Electron window...');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'Moderátorská Obrazovka'
  });
  
  // Connect to port 3001 (Express)
  mainWindow.loadURL(`http://localhost:${PORT}?mode=moderator`);
  
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  
  console.log('✅ Window created');
}

app.on('window-all-closed', () => {
  console.log('👋 All windows closed');
  if (process.platform !== 'darwin') app.quit();
});
