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

// Position update throttling
const playerUpdateThrottle = new Map(); // playerId -> last update time
const UPDATE_THROTTLE_MS = 16; // ~60fps (1000ms / 60fps)

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
    
    // Create player data with assigned color and default spawn position
    const playerInfo = {
      id: socket.id,
      name: playerData.name,
      color: assignedColor,
      position: { x: 400, y: 680 }, // Default spawn position
      lastUpdate: Date.now()
    };
    
    // Store player in game state
    gameState.players.set(socket.id, playerInfo);
    
    // Send color assignment to the new player
    socket.emit('playerColorAssigned', { color: assignedColor });
    
    // Send current game state to new player (excluding themselves, only other players)
    const otherPlayers = Array.from(gameState.players.values()).filter(p => p.id !== socket.id);
    socket.emit('gameState', {
      players: otherPlayers,
      doorState: gameState.doorState
    });
    
    // Notify other players about the new player (with current spawn position)
    socket.broadcast.emit('playerJoined', playerInfo);
    
    console.log(`Player ${playerData.name} joined with color ${assignedColor} at position (${playerInfo.position.x}, ${playerInfo.position.y}). Total players: ${gameState.players.size}`);
    console.log(`Sent ${otherPlayers.length} existing players to new player`);
    
    // Log existing player positions for debugging
    otherPlayers.forEach(player => {
      console.log(`  - Existing player: ${player.name} at (${player.position.x}, ${player.position.y})`);
    });
  });
  
  // Handle player movement with throttling
  socket.on('playerMove', (position) => {
    const player = gameState.players.get(socket.id);
    if (player) {
      const now = Date.now();
      const lastUpdate = playerUpdateThrottle.get(socket.id) || 0;
      
      // Throttle updates to ~60fps
      if (now - lastUpdate >= UPDATE_THROTTLE_MS) {
        player.position = position;
        player.lastUpdate = now;
        playerUpdateThrottle.set(socket.id, now);
        
        // Broadcast to other players
        socket.broadcast.emit('playerMoved', { id: socket.id, position });
      }
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
    
    // Clean up player data
    gameState.players.delete(socket.id);
    playerUpdateThrottle.delete(socket.id);
    
    // Notify other players
    io.emit('playerLeft', socket.id);
    console.log(`Total players: ${gameState.players.size}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Galactic Arcade Server running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🎮 Game state: http://localhost:${PORT}/game-state`);
});