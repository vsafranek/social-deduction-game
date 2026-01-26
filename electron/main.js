// electron/main.js
const { app, BrowserWindow, ipcMain, Menu, screen } = require("electron");
const path = require("path");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { createProxyMiddleware } = require("http-proxy-middleware");
const os = require("os");
const settingsStore = require("./store");

let mainWindow;
let splashWindow;
let playerWindows = {}; // Store open player windows

const expressApp = express();
const PORT = 3001;
const NEXTJS_PORT = 3010;
// Check both app.isPackaged and NODE_ENV to determine if we're in production
// Note: NODE_ENV may be set later, so use a function to evaluate dynamically
function isDev() {
  return !app.isPackaged && process.env.NODE_ENV !== "production";
}

console.log("🚀 Starting Electron app...");

function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

const LOCAL_IP = getLocalIPAddress();

// Middleware
expressApp.use(cors());
expressApp.use(bodyParser.json());

// REQUEST LOGGER
expressApp.use((req, res, next) => {
  if (!req.path.includes("/@vite") && !req.path.includes("/node_modules")) {
    //console.log(`📨 ${req.method} ${req.path}`);
  }
  next();
});

console.log("📦 Middleware configured");

app.whenReady().then(async () => {
  console.log("⚡ Electron ready, starting server...");
  try {
    // Set NODE_ENV to production if app is packaged (production build)
    // Also respect NODE_ENV if it's already set (from npm start)
    if (app.isPackaged && !process.env.NODE_ENV) {
      process.env.NODE_ENV = "production";
    }
    // Ensure NODE_ENV is set for production mode detection
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = "development";
    }

    // Now that NODE_ENV is set, log the mode
    console.log(`📦 Mode: ${isDev() ? "Development" : "Production"}`);

    // In production, remove application menu (File/Edit/View...) globally
    if (!isDev()) {
      Menu.setApplicationMenu(null);
    }

    // Initialize settings store
    await settingsStore.initStore();
    console.log("✅ Settings store initialized");

    console.log("🔌 Connecting to Supabase...");
    const { connectDB } = require("./database");
    await connectDB();
    console.log("✅ Supabase connected successfully");
    console.log("📡 Registering API routes...");
    const gameRoutes = require("./routes/gameRoutes");
    expressApp.use("/api/game", gameRoutes);
    console.log("✅ API routes registered at /api/game");

    // Health check
    expressApp.get("/api/health", (req, res) => {
      console.log("🔍 [DEBUG] Health endpoint called");
      try {
        const response = { status: "ok", ip: LOCAL_IP, port: PORT };
        console.log("🔍 [DEBUG] Health endpoint response:", response);
        res.json(response);
      } catch (error) {
        console.error("🔍 [DEBUG] Health endpoint error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Debug/telemetry ingest endpoint (silently accepts and discards data)
    expressApp.post("/ingest/:id", (req, res) => {
      // Silently accept telemetry/debug data (no-op)
      res.status(200).json({ status: "ok" });
    });

    // Separate Express app for ingest endpoint on port 7242
    const ingestApp = express();
    ingestApp.use(cors());
    ingestApp.use(bodyParser.json());
    ingestApp.post("/ingest/:id", (req, res) => {
      // Silently accept telemetry/debug data (no-op)
      res.status(200).json({ status: "ok" });
    });

    const INGEST_PORT = 7242;
    ingestApp.listen(INGEST_PORT, "127.0.0.1", () => {
      console.log(`🔍 Debug ingest endpoint: http://127.0.0.1:${INGEST_PORT}/ingest/:id`);
    });

    // Next.js proxy in development
    if (isDev()) {
      console.log("🔧 Development mode - setting up Next.js proxy...");
      const nextjsProxy = createProxyMiddleware({
        target: `http://localhost:${NEXTJS_PORT}`,
        changeOrigin: true,
        ws: true,
        logLevel: "silent",
        onProxyReq: (proxyReq) => {
          proxyReq.setMaxListeners(50);
        },
        onProxyRes: (proxyRes) => {
          proxyRes.setMaxListeners(50);
        },
      });

      expressApp.use((req, res, next) => {
        if (req.path.startsWith("/api")) {
          return next();
        }
        nextjsProxy(req, res, next);
      });
    } else {
      console.log("📦 Production mode - proxying to Next.js standalone server...");
      // Next.js standalone build runs its own server
      // We need to start it and proxy to it, or proxy directly if it's already running
      const standalonePath = path.join(__dirname, "../frontend/.next/standalone");
      const staticPath = path.join(__dirname, "../frontend/.next/static");
      const publicPath = path.join(__dirname, "../frontend/public");

      // Check if standalone build exists
      if (require("fs").existsSync(standalonePath)) {
        // Next.js standalone server runs on a different port internally
        // We proxy all non-API requests to it
        const nextjsStandaloneProxy = createProxyMiddleware({
          target: "http://localhost:3000", // Next.js standalone default port
          changeOrigin: true,
          ws: true,
          logLevel: "silent",
          onProxyReq: (proxyReq) => {
            proxyReq.setMaxListeners(50);
          },
          onProxyRes: (proxyRes) => {
            proxyRes.setMaxListeners(50);
          },
        });

        // Serve static files from .next/static (for better performance)
        if (require("fs").existsSync(staticPath)) {
          expressApp.use("/_next/static", express.static(staticPath));
        }

        // Serve public files
        if (require("fs").existsSync(publicPath)) {
          expressApp.use(express.static(publicPath));
        }

        // Proxy all non-API requests to Next.js standalone server
        expressApp.use((req, res, next) => {
          if (req.path.startsWith("/api")) {
            return next();
          }
          nextjsStandaloneProxy(req, res, next);
        });
      } else {
        console.warn("⚠️ Next.js standalone build not found, falling back to static export");
        // Fallback to static export if standalone doesn't exist
        const outPath = path.join(__dirname, "../frontend/out");
        if (require("fs").existsSync(outPath)) {
          expressApp.use(express.static(outPath));
          expressApp.get("*", (req, res) => {
            if (req.path.startsWith("/api")) return;
            res.sendFile(path.join(outPath, "index.html"));
          });
        } else {
          console.error("❌ No Next.js build found! Please run 'npm run build' in frontend directory.");
        }
      }
    }

    expressApp.use("/api/*", (req, res) => {
      console.log("🔍 [DEBUG] Catch-all API route hit:", req.path);
      res.status(404).json({ error: "API endpoint not found", path: req.path });
    });

    // Error handler (must be last, after all routes)
    expressApp.use((err, req, res, next) => {
      console.error('🔍 [DEBUG] Express error handler:', err.message);
      console.error('🔍 [DEBUG] Express error stack:', err.stack);
      res.status(500).json({ error: err.message });
    });

    // Start server
    const serverInstance = expressApp.listen(PORT, "0.0.0.0", () => {
      console.log(`🔍 [DEBUG] Express server started on port ${PORT}`);
      console.log("");
      const GAME_NAME = "Shadows of Gloaming";
      console.log("╔═══════════════════════════════════════════════════════╗");
      console.log(`║ 🎮 ${GAME_NAME.toUpperCase()} 🎮 ║`);
      console.log("╚═══════════════════════════════════════════════════════╝");
      console.log("");
      console.log(` 🌐 Server: http://${LOCAL_IP}:${PORT}`);
      console.log(` 🔌 API: http://${LOCAL_IP}:${PORT}/api`);
      console.log(` 📊 Supabase: Connected`);
      console.log("");
      console.log(" 📱 Players enter on mobile:");
      console.log(` http://${LOCAL_IP}:${PORT}`);
      console.log("");
      console.log("╚═══════════════════════════════════════════════════════╝");
      console.log("");
    });

    serverInstance.setMaxListeners(50);

    serverInstance.on('error', (err) => {
      console.error("🔍 [DEBUG] Express server error:", err);
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use!`);
      }
    });

    // Show splash screen while main window loads
    splashWindow = await createSplashWindow();

    createWindow();
  } catch (error) {
    console.error("❌ FATAL ERROR during startup:", error);
    console.error("🔍 [DEBUG] Error stack:", error.stack);
    process.exit(1);
  }
});

// Helper function to get icon path (case-insensitive check)
function getIconPath() {
  const fs = require("fs");
  const buildDir = path.join(__dirname, "../build");

  // Helper to check if file exists (case-insensitive on Windows)
  function fileExists(filePath) {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  // Helper to find file with any case variation
  function findFile(dir, baseName, extensions) {
    for (const ext of extensions) {
      // Try exact case first
      let filePath = path.join(dir, `${baseName}${ext}`);
      if (fileExists(filePath)) return filePath;

      // Try lowercase
      filePath = path.join(dir, `${baseName.toLowerCase()}${ext}`);
      if (fileExists(filePath)) return filePath;

      // Try uppercase
      filePath = path.join(dir, `${baseName.toUpperCase()}${ext}`);
      if (fileExists(filePath)) return filePath;
    }
    return null;
  }

  let iconPath;
  if (process.platform === "win32") {
    // Windows: prefer .ico, fallback to .png, then favicon.*
    iconPath = findFile(buildDir, "icon", [".ico", ".ICO"]);
    if (!iconPath) iconPath = findFile(buildDir, "icon", [".png", ".PNG"]);
    if (!iconPath) iconPath = findFile(buildDir, "favicon", [".ico", ".ICO", ".png", ".PNG"]);
  } else if (process.platform === "darwin") {
    // macOS: prefer .icns, fallback to .png, then favicon.*
    iconPath = findFile(buildDir, "icon", [".icns", ".ICNS"]);
    if (!iconPath) iconPath = findFile(buildDir, "icon", [".png", ".PNG"]);
    if (!iconPath) iconPath = findFile(buildDir, "favicon", [".icns", ".ICNS", ".png", ".PNG"]);
  } else {
    // Linux and others: use .png, then favicon.*
    iconPath = findFile(buildDir, "icon", [".png", ".PNG"]);
    if (!iconPath) iconPath = findFile(buildDir, "favicon", [".png", ".PNG", ".ico", ".ICO"]);
  }

  // Fallback path for logging; may not exist if icons are missing
  return iconPath || path.join(buildDir, "icon.png");
}

// Lightweight splash screen shown while the main window is loading
// Uses same size as main window (1400x900) or fullscreen if main window will be fullscreen
async function createSplashWindow() {
  // Load settings to check if main window will be fullscreen
  await settingsStore.initStore();
  const settings = settingsStore.getSettings();
  const willBeFullscreen = settings.fullscreen !== false; // Default true

  // Main window dimensions
  const MAIN_WINDOW_WIDTH = 1400;
  const MAIN_WINDOW_HEIGHT = 900;

  let splashOptions;

  if (willBeFullscreen) {
    // If main window will be fullscreen, make splash fullscreen too
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    splashOptions = {
      width,
      height,
      fullscreen: true,
      fullscreenable: false,
    };
  } else {
    // Use same size as main window
    splashOptions = {
      width: MAIN_WINDOW_WIDTH,
      height: MAIN_WINDOW_HEIGHT,
      fullscreen: false,
      fullscreenable: false,
    };
  }

  const splash = new BrowserWindow({
    ...splashOptions,
    resizable: false,
    movable: false,
    frame: false,
    show: true,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    backgroundColor: "#040309",
    autoHideMenuBar: true,
  });

  try {
    splash.loadFile(path.join(__dirname, "splash.html"));
  } catch (error) {
    console.error("⚠️ Could not load splash screen:", error);
  }

  return splash;
}

function createWindow() {
  console.log("🪟 Creating Moderator window...");

  // Get icon path using helper function
  const iconPath = getIconPath();

  // Only set icon if file exists
  const iconOptions = {};
  if (require("fs").existsSync(iconPath)) {
    iconOptions.icon = iconPath;
    console.log(`🖼️ Using icon: ${iconPath}`);
  } else {
    console.log(`⚠️ Icon not found at ${iconPath}, using default Electron icon`);
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#0a080f", // Dark background color (same as in AppLoadingScreen)
    show: false, // Window won't show until ready
    frame: true, // Show title bar (will be hidden automatically in fullscreen)
    autoHideMenuBar: !isDev(), // Hide menu bar in production (Alt can show if setMenuBarVisibility true)
    ...iconOptions, // Include icon if available
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"), // ✅ ADDED
    },
    title: "Moderator Screen",
  });

  // Ensure menu bar is hidden in production
  if (!isDev()) {
    try {
      mainWindow.setMenuBarVisibility(false);
    } catch (_) { }
  }

  mainWindow.loadURL(`http://localhost:${PORT}?mode=moderator`);

  // Show window only when content is ready
  mainWindow.once("ready-to-show", async () => {
    console.log("✅ Window content ready, showing window...");

    // Ensure store is initialized before loading settings
    await settingsStore.initStore();

    // Load settings and apply them
    const settings = settingsStore.getSettings();
    console.log("📋 Loaded settings:", settings);
    const shouldFullscreen = settings.fullscreen !== false; // Default true
    const shouldAlwaysOnTop = settings.alwaysOnTop === true;

    if (shouldFullscreen) {
      mainWindow.setFullScreen(true);
      console.log("🖥️ Window set to fullscreen mode (from saved settings)");
    } else {
      console.log("🖥️ Window will show with title bar (fullscreen disabled in settings)");
    }

    if (shouldAlwaysOnTop) {
      mainWindow.setAlwaysOnTop(true);
      console.log("📌 Window set to always on top (from saved settings)");
    } else {
      // Ensure always on top is explicitly disabled if setting says so
      mainWindow.setAlwaysOnTop(false);
      console.log("📌 Window always on top disabled (from saved settings)");
    }

    // Show main window first
    mainWindow.show();

    // Close splash screen after a short delay to ensure React app is ready
    // This prevents flicker between splash and AppLoadingScreen (which is skipped in Electron)
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
        console.log("🎬 Splash screen closed");
      }
    }, 300); // Small delay to let React app prepare

    // Focus on window
    if (mainWindow) {
      mainWindow.focus();
    }
  });

  // Listen for fullscreen changes
  mainWindow.on('enter-full-screen', () => {
    // Frame is automatically hidden in fullscreen
    // Close DevTools when entering fullscreen
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
      console.log("🖥️ Entered fullscreen - DevTools closed, title bar automatically hidden");
    } else {
      console.log("🖥️ Entered fullscreen - title bar automatically hidden");
    }
  });

  mainWindow.on('leave-full-screen', () => {
    // When leaving fullscreen, frame (title bar) automatically becomes visible
    // Keep DevTools closed in production, only reopen in dev mode
    if (isDev() && mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.openDevTools();
      console.log("🖥️ Left fullscreen - DevTools reopened (dev mode)");
    } else {
      console.log("🖥️ Left fullscreen - title bar automatically visible");
    }
  });

  // Only open DevTools in development mode
  if (isDev()) {
    mainWindow.webContents.openDevTools();
  }

  console.log("✅ Moderator window created");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ✅ Function to create player window
function createPlayerWindow(playerName, roomCode, sessionId) {
  console.log(`🎮 Creating player window for: ${playerName}`);

  // Use same icon logic as main window
  const playerIconPath = getIconPath();
  const playerIconOptions = {};
  if (require("fs").existsSync(playerIconPath)) {
    playerIconOptions.icon = playerIconPath;
  }

  const playerWindow = new BrowserWindow({
    width: 500,
    height: 800,
    backgroundColor: "#0a080f", // Dark background color
    show: false, // Window won't show until ready
    frame: false, // Remove title bar
    autoHideMenuBar: !isDev(), // Hide menu bar in production
    ...playerIconOptions, // Include icon if available
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    title: `Player: ${playerName}`,
  });

  // Ensure menu bar is hidden in production
  if (!isDev()) {
    try {
      playerWindow.setMenuBarVisibility(false);
    } catch (_) { }
  }

  // ✅ Add sessionId to URL
  const playerUrl = `http://localhost:${PORT}?mode=player&room=${roomCode}&playerName=${encodeURIComponent(
    playerName
  )}&sessionId=${sessionId}`;
  playerWindow.loadURL(playerUrl);

  // Show window only when content is ready
  playerWindow.once("ready-to-show", () => {
    console.log(`✅ Player window content ready: ${playerName}`);
    playerWindow.show();
    if (playerWindow) {
      playerWindow.focus();
    }
  });

  playerWindow.on("closed", () => {
    delete playerWindows[playerName];
    console.log(`❌ Player window closed: ${playerName}`);
  });

  playerWindows[playerName] = playerWindow;
  console.log(
    `✅ Player window created: ${playerName} (session: ${sessionId.substring(
      0,
      12
    )}...)`
  );

  return playerWindow;
}

// ✅ IPC handler with sessionId
ipcMain.handle(
  "create-player-window",
  (event, playerName, roomCode, sessionId) => {
    createPlayerWindow(playerName, roomCode, sessionId);
    return { success: true };
  }
);

ipcMain.handle("close-player-window", (event, playerName) => {
  if (playerWindows[playerName]) {
    playerWindows[playerName].close();
    delete playerWindows[playerName];
  }
  return { success: true };
});

ipcMain.handle("close-all-player-windows", () => {
  Object.values(playerWindows).forEach((window) => {
    if (window && !window.isDestroyed()) {
      window.close();
    }
  });
  playerWindows = {};
  return { success: true };
});

ipcMain.handle("close-app", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
  return { success: true };
});

// Window control IPC handlers
ipcMain.handle("window-toggle-fullscreen", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const isFullscreen = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFullscreen);
    return { success: true, isFullscreen: !isFullscreen };
  }
  return { success: false, error: "Window not available" };
});

ipcMain.handle("window-is-fullscreen", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return { success: true, isFullscreen: mainWindow.isFullScreen() };
  }
  return { success: false, error: "Window not available" };
});

ipcMain.handle("window-set-always-on-top", (event, alwaysOnTop) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(alwaysOnTop);
    console.log(`📌 Always on top set to: ${alwaysOnTop}`);

    // When disabling always on top, ensure window can be brought to front normally
    if (!alwaysOnTop) {
      mainWindow.show();
      mainWindow.focus();
    }

    return { success: true };
  }
  return { success: false, error: "Window not available" };
});

// Settings storage IPC handlers
ipcMain.handle("settings-get", () => {
  try {
    const settings = settingsStore.getSettings();
    return { success: true, settings };
  } catch (error) {
    console.error("Error getting settings:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("settings-set", async (event, settings) => {
  try {
    await settingsStore.setSettings(settings);
    return { success: true };
  } catch (error) {
    console.error("Error setting settings:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("settings-get-setting", (event, key) => {
  try {
    const value = settingsStore.getSetting(key);
    return { success: true, value };
  } catch (error) {
    console.error("Error getting setting:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("settings-set-setting", async (event, key, value) => {
  try {
    await settingsStore.setSetting(key, value);

    // Apply changes immediately to main window
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (key === "fullscreen") {
        const currentFullscreen = mainWindow.isFullScreen();
        if (currentFullscreen !== value) {
          // Close DevTools before entering fullscreen
          if (value && mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools();
          }

          // Set fullscreen
          mainWindow.setFullScreen(value);

          // Force window to update and show
          if (value) {
            // Entering fullscreen
            mainWindow.show();
            mainWindow.focus();
            console.log("🖥️ Fullscreen enabled - DevTools closed, title bar hidden");
          } else {
            // Leaving fullscreen - only reopen DevTools in dev mode
            mainWindow.show();
            mainWindow.focus();
            if (isDev() && !mainWindow.webContents.isDevToolsOpened()) {
              // Small delay to ensure window is ready
              setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.openDevTools();
                }
              }, 100);
            }
            console.log("🖥️ Fullscreen disabled - title bar visible");
          }
        }
      } else if (key === "alwaysOnTop") {
        mainWindow.setAlwaysOnTop(value);
        console.log(`📌 Always on top ${value ? 'enabled' : 'disabled'}`);

        // When disabling always on top, ensure window can be brought to front normally
        if (!value) {
          // Bring window to front to ensure it's accessible
          mainWindow.show();
          mainWindow.focus();
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error setting setting:", error);
    return { success: false, error: error.message };
  }
});

app.on("window-all-closed", () => {
  console.log("👋 All windows closed");
  if (process.platform !== "darwin") app.quit();
});
