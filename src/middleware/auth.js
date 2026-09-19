// src/middleware/auth.js
require('dotenv').config();
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

module.exports = (req, res, next) => {
  // Accept X-Admin-Token header (sent by system_backend proxy)
  const xAdminToken = req.headers['x-admin-token'] || '';
  if (ADMIN_TOKEN && xAdminToken && xAdminToken === ADMIN_TOKEN) {
    return next();
  }

  // Accept Authorization: Bearer <token> (direct admin calls)
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token === ADMIN_TOKEN) return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
};
