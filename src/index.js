// src/index.js
require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const path       = require('path');

const { RoomManager } = require('./rooms/RoomManager');

const app    = express();
const server = http.createServer(app);

// ── CORS origins ──────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Always allow localhost for dev
allowedOrigins.push('http://localhost:3000', 'http://localhost:5173');

const corsOptions = {
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, same-origin server calls)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, true); // open in dev — tighten for prod if needed
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve static admin UI
app.use('/admin', express.static(path.join(__dirname, '..', '..', 'admin')));

// ── HTTP Routes ───────────────────────────────────────────────────────────
const gameRouter   = require('./routes/game');
const playerRouter = require('./routes/player');
const adminRouter  = require('./routes/admin');
const aiRouter     = require('./routes/ai');
const { databaseReady } = require('./db/database');

app.use('/api/game',   gameRouter);
app.use('/api/player', playerRouter);
app.use('/api/admin',  adminRouter);
app.use('/api/ai',     aiRouter);

// ── Socket.io ─────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
});

const roomManager = new RoomManager(io);

io.on('connection', socket => {
  console.log(`[socket] connected: ${socket.id}`);

  // ── Client subscribes to a bet tier (to see its 5 rooms live) ────────────
  socket.on('subscribe:bet', ({ betAmount }) => {
    const tierRoom = `bet-${betAmount}`;
    socket.join(tierRoom);
    // Send current state of all 5 rooms immediately
    const rooms = roomManager.getRoomsForBet(betAmount);
    socket.emit('rooms:snapshot', { betAmount, rooms });
  });

  // ── Client wants to join a specific room ─────────────────────────────────
  socket.on('room:join', ({ roomId, player }) => {
    if (!roomId || !player?.name) {
      socket.emit('room:error', { error: 'Missing roomId or player info' });
      return;
    }
    const result = roomManager.joinRoom(roomId, { ...player, socketId: socket.id });
    if (!result.ok) {
      socket.emit('room:error', { error: result.error });
    } else {
      // Track which room this socket is in so we can clean up on disconnect
      socket._ludoRoomId = roomId;
      socket.emit('room:joined', { room: result.room });
    }
  });

  // ── Client leaves a room explicitly ──────────────────────────────────────
  socket.on('room:leave', () => {
    roomManager.leaveBySocket(socket.id);
    socket._ludoRoomId = null;
  });

  // ── Disconnect cleanup ────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    roomManager.leaveBySocket(socket.id);
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

// ── Start server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 10000;

databaseReady
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Ludo backend (HTTP + Socket.io) listening on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Ludo backend startup failed:', err);
    process.exit(1);
  });
