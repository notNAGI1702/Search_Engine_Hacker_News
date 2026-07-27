const cron = require('node-cron');
const { run } = require('./fetchHN');

console.log('Scheduler started. Crawl job scheduled for every 10 minutes (*/10 * * * *).');

// Run immediately on startup
run().catch(console.error);

// Schedule execution for every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  console.log(`[${new Date().toISOString()}] Running scheduled crawl...`);
  try {
    await run();
  } catch (err) {
    console.error('Scheduled crawl encountered an error:', err);
  }
});
