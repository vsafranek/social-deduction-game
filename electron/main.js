// electron/main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { createProxyMiddleware } = require("http-proxy-middleware");
const os = require("os");

let mainWindow;
let playerWindows = {}; // Ukládáme otevřená player okna

const expressApp = express();
const PORT = 3001;
const VITE_PORT = 5173;
const isDev = !app.isPackaged;

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
    if (app.isPackaged && !process.env.NODE_ENV) {
      process.env.NODE_ENV = "production";
    }

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
      res.json({ status: "ok", ip: LOCAL_IP, port: PORT });
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

    // Vite proxy in development
    if (isDev) {
      console.log("🔧 Development mode - setting up Vite proxy...");
      const viteProxy = createProxyMiddleware({
        target: `http://localhost:${VITE_PORT}`,
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
        viteProxy(req, res, next);
      });
    } else {
      console.log("📦 Production mode - serving static files...");
      expressApp.use(express.static(path.join(__dirname, "../frontend/dist")));
      expressApp.get("*", (req, res) => {
        if (req.path.startsWith("/api")) return;
        res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
      });
    }

    expressApp.use("/api/*", (req, res) => {
      res.status(404).json({ error: "API endpoint not found", path: req.path });
    });

    // Start server
    const serverInstance = expressApp.listen(PORT, "0.0.0.0", () => {
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
      console.log(" 📱 Hráči zadají do mobilu:");
      console.log(` http://${LOCAL_IP}:${PORT}`);
      console.log("");
      console.log("╚═══════════════════════════════════════════════════════╝");
      console.log("");
    });

    serverInstance.setMaxListeners(50);
    createWindow();
  } catch (error) {
    console.error("❌ FATAL ERROR during startup:", error);
    process.exit(1);
  }
});

function createWindow() {
  console.log("🪟 Creating Moderator window...");
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#0a080f", // Tmavá barva pozadí (stejná jako v AppLoadingScreen)
    show: false, // Okno se nezobrazí dokud není připravené
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"), // ✅ PŘIDÁNO
    },
    title: "Moderátorská Obrazovka",
  });

  mainWindow.loadURL(`http://localhost:${PORT}?mode=moderator`);

  // Zobrazit okno až když je obsah připravený
  mainWindow.once("ready-to-show", () => {
    console.log("✅ Window content ready, showing window...");
    mainWindow.show();
    // Fokus na okno
    if (mainWindow) {
      mainWindow.focus();
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  console.log("✅ Moderator window created");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ✅ Funkce pro vytvoření player okna
function createPlayerWindow(playerName, roomCode, sessionId) {
  console.log(`🎮 Creating player window for: ${playerName}`);

  const playerWindow = new BrowserWindow({
    width: 500,
    height: 800,
    backgroundColor: "#0a080f", // Tmavá barva pozadí
    show: false, // Okno se nezobrazí dokud není připravené
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    title: `Hráč: ${playerName}`,
  });

  // ✅ Přidej sessionId do URL
  const playerUrl = `http://localhost:${PORT}?mode=player&room=${roomCode}&playerName=${encodeURIComponent(
    playerName
  )}&sessionId=${sessionId}`;
  playerWindow.loadURL(playerUrl);

  // Zobrazit okno až když je obsah připravený
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

// ✅ IPC handler s sessionId
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

app.on("window-all-closed", () => {
  console.log("👋 All windows closed");
  if (process.platform !== "darwin") app.quit();
});
