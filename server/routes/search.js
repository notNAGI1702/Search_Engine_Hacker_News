const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const path = require('path');
const db = require('../db/index');

const RANKER_BIN_PATH = path.resolve(__dirname, '../../engine/build/ranker');

router.get('/', async (req, res) => {
  const start = process.hrtime.bigint();
  const query = req.query.q;

  const logLatency = () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    console.log(`Latency: ${durationMs.toFixed(2)} ms`);
  };

  if (!query || query.trim() === '') {
    logLatency();
    return res.json([]);
  }

  // Execute C++ ranker binary
  execFile(RANKER_BIN_PATH, [query], { cwd: path.resolve(__dirname, '../../engine') }, async (err, stdout, stderr) => {
    if (err) {
      console.error('Error executing C++ ranker:', err);
      console.error('Stderr:', stderr);
      logLatency();
      return res.status(500).json({ error: 'Search ranker failed' });
    }

    try {
      // Parse ranker output: doc_id score (one per line)
      const lines = stdout.trim().split('\n').filter(line => line.trim() !== '');
      const matches = lines.map(line => {
        const parts = line.split(/\s+/);
        return {
          id: parseInt(parts[0], 10),
          score: parseFloat(parts[1])
        };
      }).filter(item => !isNaN(item.id) && !isNaN(item.score));

      if (matches.length === 0) {
        logLatency();
        return res.json([]);
      }

      // Fetch docs from Postgres for the matched IDs
      const ids = matches.map(m => m.id);
      const queryResult = await db.query(
        'SELECT id, title, text, url, hn_id, created_at FROM docs WHERE id = ANY($1::int[])',
        [ids]
      );

      // Create a map from id to document details
      const docMap = {};
      queryResult.rows.forEach(row => {
        docMap[row.id] = row;
      });

      // Maintain the order returned by the C++ ranker and attach the score
      const orderedResults = matches
        .map(match => {
          const doc = docMap[match.id];
          if (!doc) return null; // skip if doc is missing or deleted
          return {
            id: doc.id,
            title: doc.title,
            text: doc.text,
            url: doc.url,
            hn_id: doc.hn_id,
            created_at: doc.created_at,
            score: match.score
          };
        })
        .filter(Boolean);

      logLatency();
      return res.json(orderedResults);
    } catch (dbErr) {
      console.error('Database error in search route:', dbErr);
      logLatency();
      return res.status(500).json({ error: 'Database search query failed' });
    }
  });
});

module.exports = router;
