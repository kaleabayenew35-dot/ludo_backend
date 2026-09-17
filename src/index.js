// src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static admin UI
app.use('/admin', express.static(path.join(__dirname, '..', '..', 'admin')));

// Routes
const gameRouter = require('./routes/game');
const playerRouter = require('./routes/player');
const adminRouter = require('./routes/admin');
const aiRouter = require('./routes/ai');
const { databaseReady } = require('./db/database');

app.use('/api/game', gameRouter);
app.use('/api/player', playerRouter);
app.use('/api/admin', adminRouter);
app.use('/api/ai', aiRouter);

const PORT = process.env.PORT || 10000;

databaseReady
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Ludo backend listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Ludo backend startup failed:', err);
    process.exit(1);
  });
