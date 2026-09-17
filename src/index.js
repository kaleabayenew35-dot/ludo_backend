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

app.use('/api/game', gameRouter);
app.use('/api/player', playerRouter);
app.use('/api/admin', adminRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ludo backend listening on port ${PORT}`);
});
