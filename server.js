const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data.json');

// Initial default state
let globalState = {
  expenses: [],
  photos: [],
  tickets: [],
  members: ["Leader"],
  logs: []
};

// File se data load karein agar exist karta hai
if (fs.existsSync(DATA_FILE)) {
  try {
    const fileData = fs.readFileSync(DATA_FILE, 'utf8');
    globalState = JSON.parse(fileData);
  } catch (err) {
    console.error("Error reading data.json:", err);
  }
}

// Data.json mein safe save karne ka function
function saveStateToFile() {
  fs.writeFile(DATA_FILE, JSON.stringify(globalState, null, 2), (err) => {
    if (err) console.error("Error saving data:", err);
  });
}

// Serve static files from 'public' folder or root
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  const publicIndexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(publicIndexPath)) {
    res.sendFile(publicIndexPath);
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// Setup WebSocket Server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'INIT_STATE', payload: globalState }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'UPDATE_STATE') {
        globalState = { ...globalState, ...data.payload };
        
        // Disk par save karein
        saveStateToFile();

        // Connected clients ko realtime sync karein
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'SYNC_STATE', payload: globalState }));
          }
        });
      }
    } catch (e) {
      console.error("Invalid WebSocket message:", e);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});