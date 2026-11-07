const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Use Render's provided PORT or fallback to 3000
const PORT = process.env.PORT || 3000;

// Serve static frontend files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for root routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Setup WebSocket Server
const wss = new WebSocket.Server({ server });

let globalState = {
  expenses: [],
  photos: [],
  tickets: [],
  members: ["Leader"],
  logs: []
};

wss.on('connection', (ws) => {
  // Send current state on connection
  ws.send(JSON.stringify({ type: 'INIT_STATE', payload: globalState }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'UPDATE_STATE') {
        globalState = { ...globalState, ...data.payload };
        // Broadcast to all connected clients
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