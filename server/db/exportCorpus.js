const fs = require('fs');
const path = require('path');
const db = require('./index');

async function exportCorpus() {
  console.log('Exporting corpus from database to data/hn_corpus.json...');
  try {
    const res = await db.query('SELECT id, title, text FROM docs ORDER BY id ASC');
    const docs = res.rows.map(row => ({
      id: row.id,
      title: row.title || '',
      text: row.text || ''
    }));

    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const outputPath = path.join(dataDir, 'hn_corpus.json');
    fs.writeFileSync(outputPath, JSON.stringify(docs, null, 2), 'utf8');
    console.log(`Successfully exported ${docs.length} documents to ${outputPath}`);
  } catch (err) {
    console.error('Corpus export failed:', err);
    process.exit(1);
  } finally {
    if (require.main === module) {
      await db.pool.end();
    }
  }
}

if (require.main === module) {
  exportCorpus();
}

module.exports = { exportCorpus };
