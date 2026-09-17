// src/middleware/auth.js
require('dotenv').config();
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  next();
};
