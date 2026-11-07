const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tripd-app';

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("Connected to MongoDB successfully!");
}).catch(err => {
  console.error("MongoDB connection error:", err);
});

// Define Mongoose Schema for Trip Data
const TripSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: 'main_trip' },
  expenses: { type: Array, default: [] },
  photos: { type: Array, default: [] },
  tickets: { type: Array, default: [] },
  members: { type: Array, default: ["Leader"] },
  logs: { type: Array, default: [] }
}, { strict: false });

const TripModel = mongoose.model('TripData', TripSchema);

// Default in-memory state fallback
let globalState = {
  expenses: [],
  photos: [],
  tickets: [],
  members: ["Leader"],
  logs: []
};

// Load state from DB on startup
async function loadStateFromDB() {
  try {
    let data = await TripModel.findOne({ id: 'main_trip' });
    if (!data) {
      data = await TripModel.create({ id: 'main_trip', ...globalState });
    }
    globalState = {
      expenses: data.expenses || [],
      photos: data.photos || [],
      tickets: data.tickets || [],
      members: data.members || ["Leader"],
      logs: data.logs || []
    };
    console.log("State loaded from MongoDB");
  } catch (err) {
    console.error("Error loading state from DB:", err);
  }
}
loadStateFromDB();

// Save state to DB
async function saveStateToDB() {
  try {
    await TripModel.findOneAndUpdate(
      { id: 'main_trip' },
      { $set: globalState },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("Error saving state to DB:", err);
  }
}

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  const publicIndexPath = path.join(__dirname, 'public', 'index.html');
  if (mongoose.os || true) {
    // Fallback file routing
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// WebSocket Setup
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'INIT_STATE', payload: globalState }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'UPDATE_STATE') {
        globalState = { ...globalState, ...data.payload };
        
        // Save to Database permanently
        await saveStateToDB();

        // Broadcast to all devices in real-time
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'SYNC_STATE', payload: globalState }));
          }
        });
      }
    } catch (e) {
      console.error("WebSocket error:", e);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});