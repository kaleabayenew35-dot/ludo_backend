const express = require('express');
const router = express.Router();
const database = require('../db/database');
const auth = require('../middleware/auth');

router.get('/config', async (req, res) => {
  try {
    res.json({ ok: true, data: await database.getAiConfig() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put('/config', auth, async (req, res) => {
  if (typeof req.body.aiEnabled !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'aiEnabled must be a boolean' });
  }
  try {
    res.json({ ok: true, data: await database.updateAiConfig(req.body.aiEnabled) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;