const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow;
let apiServer;

// Start the API server
function startApiServer() {
  return new Promise((resolve, reject) => {
    console.log("Starting InventoryPro API server...");
    
    apiServer = spawn("node", [path.join(__dirname, "../src/api/server.js")], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: path.join(__dirname, "..")
    });

    apiServer.stdout.on("data", (data) => {
      const message = data.toString();
      console.log(`API Server: ${message}`);
      
      if (message.includes("InventoryPro API Server started successfully")) {
        resolve();
      }
    });

    apiServer.stderr.on("data", (data) => {
      console.error(`API Server Error: ${data}`);
    });

    apiServer.on("error", (error) => {
      console.error("Failed to start API server:", error);
      reject(error);
    });

    apiServer.on("close", (code) => {
      console.log(`API server process exited with code ${code}`);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      resolve(); // Continue even if we don't see the success message
    }, 10000);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    icon: path.join(__dirname, "../src/images/manjaros-logo.png"),
    titleBarStyle: "default",
    show: false // Don't show until ready
  });

  // Load main page
  mainWindow.loadFile(path.join(__dirname, "../src/index.html"));

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    console.log("InventoryPro application ready!");
  });

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Uncomment for development
  // mainWindow.webContents.openDevTools();
}

// IPC handlers for communication with renderer
ipcMain.handle("api-request", async (event, { method, endpoint, data, token }) => {
  const fetch = require("node-fetch");
  
  try {
    const url = `http://localhost:3001${endpoint}`;
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` })
      }
    };

    if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();

    return {
      ok: response.ok,
      status: response.status,
      data: result
    };
  } catch (error) {
    console.error("API request error:", error);
    return {
      ok: false,
      status: 500,
      data: { success: false, message: "Connection error" }
    };
  }
});

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

app.whenReady().then(async () => {
  try {
    // Start API server first
    await startApiServer();
    
    // Then create the window
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

  } catch (error) {
    console.error("Failed to start application:", error);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  // Stop API server when closing
  if (apiServer) {
    console.log("Stopping API server...");
    apiServer.kill("SIGTERM");
    
    // Force kill after 5 seconds if not closed gracefully
    setTimeout(() => {
      if (apiServer) {
        apiServer.kill("SIGKILL");
      }
    }, 5000);
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (apiServer) {
    apiServer.kill("SIGTERM");
  }
});

// Handle app quit
app.on("will-quit", (event) => {
  if (apiServer) {
    event.preventDefault();
    
    apiServer.kill("SIGTERM");
    
    setTimeout(() => {
      app.quit();
    }, 2000);
  }
});
