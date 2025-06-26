const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Game state
const gameState = {
  players: new Map(), // socketId -> playerData
  doorState: { isOpen: false },
  arcadeMachines: new Map() // machineId -> { isTransparent: false, forPlayer: null }
};

// Track used colors to ensure uniqueness
const usedColors = new Set();

// Function to assign a unique color to a new player
function assignColor() {
  for (let i = 1; i <= 16; i++) {
    const color = i.toString().padStart(2, '0'); // '01', '02', etc.
    if (!usedColors.has(color)) {
      usedColors.add(color);
      return color;
    }
  }
  return '01'; // Fallback if all colors used
}

// Function to release a color when player disconnects
function releaseColor(color) {
  usedColors.delete(color);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', players: gameState.players.size });
});

// Get current game state
app.get('/game-state', (req, res) => {
  res.json({
    players: Array.from(gameState.players.values()),
    doorState: gameState.doorState,
    arcadeMachines: Array.from(gameState.arcadeMachines.entries())
  });
});

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // Handle player join
  socket.on('playerJoin', (playerData) => {
    console.log('Player joining:', playerData);
    
    // Assign a unique color to the new player
    const assignedColor = assignColor();
    
    // Create player data with assigned color and default position
    const playerInfo = {
      id: socket.id,
      name: playerData.name,
      color: assignedColor,
      position: { x: 400, y: 680 }, // Default spawn
      lastUpdate: Date.now()
    };
    
    // Store player in game state
    gameState.players.set(socket.id, playerInfo);
    
    // Send color assignment to the new player
    socket.emit('playerColorAssigned', { color: assignedColor });
    
    // Send current game state to new player (including positions of existing players)
    socket.emit('gameState', {
      players: Array.from(gameState.players.values()),
      doorState: gameState.doorState
    });
    
    // Notify other players about the new player (with assigned color)
    socket.broadcast.emit('playerJoined', playerInfo);
    
    console.log(`Player ${playerData.name} joined with color ${assignedColor}. Total players: ${gameState.players.size}`);
  });
  
  // Handle player movement
  socket.on('playerMove', (position) => {
    const player = gameState.players.get(socket.id);
    if (player) {
      player.position = position;
      player.lastUpdate = Date.now();
      socket.broadcast.emit('playerMoved', { id: socket.id, position });
    }
  });
  
  // Handle door interaction
  socket.on('toggleDoor', () => {
    gameState.doorState.isOpen = !gameState.doorState.isOpen;
    console.log(`Door toggled to: ${gameState.doorState.isOpen ? 'open' : 'closed'}`);
    io.emit('doorStateChanged', gameState.doorState);
  });
  
  // Handle arcade machine transparency
  socket.on('arcadeMachineTransparency', (data) => {
    const { machineId, isTransparent, forPlayer } = data;
    gameState.arcadeMachines.set(machineId, { isTransparent, forPlayer });
    socket.broadcast.emit('arcadeMachineTransparencyChanged', data);
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    const player = gameState.players.get(socket.id);
    if (player) {
      console.log(`Player ${player.name} disconnected`);
      // Release the color for reuse
      releaseColor(player.color);
    }
    gameState.players.delete(socket.id);
    io.emit('playerLeft', socket.id);
    console.log(`Total players: ${gameState.players.size}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Galactic Arcade Server running on port ${PORT}`);
  console.log(`�� Health check: http://localhost:${PORT}/health`);
  console.log(`🎮 Game state: http://localhost:${PORT}/game-state`);
});