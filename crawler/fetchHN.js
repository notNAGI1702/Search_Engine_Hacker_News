const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../server/db/index');

const HN_ALGOLIA_BASE_URL = process.env.HN_ALGOLIA_BASE_URL || 'https://hn.algolia.com/api/v1';

// Ingestion Config
const CRAWL_START_DATE = process.env.CRAWL_START_DATE || '';
const CRAWL_END_DATE = process.env.CRAWL_END_DATE || '';
const MAX_PAGES_PER_RUN = parseInt(process.env.MAX_PAGES_PER_RUN || '5', 10);

// Strip HTML tags and decode all HTML entities (named, decimal, hex)
function cleanHtml(html) {
  if (!html) return '';
  // 1. Strip HTML tags
  let text = html.replace(/<[^>]*>/g, ' ');
  // 2. Decode entities (hex, decimal, and common named entities)
  text = text
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x60;/g, "`")
    .replace(/&nbsp;/g, ' ');
  // 3. Normalize whitespace
  return text.replace(/\s+/g, ' ').trim();
}

async function fetchPage(tags, page, numericFilters = '') {
  let url = `${HN_ALGOLIA_BASE_URL}/search_by_date?tags=${tags}&page=${page}&hitsPerPage=100`;
  if (numericFilters) {
    url += `&numericFilters=${encodeURIComponent(numericFilters)}`;
  } else if (tags === 'front_page') {
    // Front page items fetched using standard search
    url = `${HN_ALGOLIA_BASE_URL}/search?tags=front_page&page=${page}&hitsPerPage=100`;
  }
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch page ${page} for ${tags}: ${res.statusText}`);
  }
  return await res.json();
}

async function saveToDatabase(items, type) {
  let inserted = 0;
  let updated = 0;
  for (const item of items) {
    const hnId = parseInt(item.objectID, 10);
    if (isNaN(hnId)) continue;

    let title = '';
    let text = '';
    let url = '';
    const createdAt = item.created_at ? new Date(item.created_at) : new Date();

    if (type === 'story') {
      title = cleanHtml(item.title || '');
      text = cleanHtml(item.story_text || '');
      url = item.url || `https://news.ycombinator.com/item?id=${hnId}`;
    } else if (type === 'comment') {
      const author = item.author || 'anonymous';
      const storyTitle = cleanHtml(item.story_title || 'Story');
      title = `Comment by ${author} on "${storyTitle}"`;
      text = cleanHtml(item.comment_text || '');
      url = `https://news.ycombinator.com/item?id=${item.story_id || hnId}`;
    }

    try {
      // ON CONFLICT returns whether row was inserted or updated using (xmax = 0)
      const res = await db.query(
        `INSERT INTO docs (title, text, url, hn_id, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (hn_id)
         DO UPDATE SET
           title = EXCLUDED.title,
           text = EXCLUDED.text,
           url = EXCLUDED.url,
           created_at = EXCLUDED.created_at
         RETURNING (xmax = 0) AS is_inserted`,
        [title, text, url, hnId, createdAt]
      );
      
      if (res.rows && res.rows.length > 0 && res.rows[0].is_inserted) {
        inserted++;
      } else {
        updated++;
      }
    } catch (err) {
      console.error(`Error saving HN item ${hnId}:`, err.message);
    }
  }
  return { inserted, updated };
}

async function crawlTags(tags, numericFilters = '') {
  let page = 0;
  let hasMore = true;
  let totalInserted = 0;
  let totalUpdated = 0;

  while (page < MAX_PAGES_PER_RUN && hasMore) {
    console.log(`Crawling ${tags} (Page ${page})...`);
    try {
      const data = await fetchPage(tags, page, numericFilters);
      const hits = data.hits || [];
      if (hits.length === 0) {
        hasMore = false;
        break;
      }
      
      const { inserted, updated } = await saveToDatabase(hits, tags === 'comment' ? 'comment' : 'story');
      totalInserted += inserted;
      totalUpdated += updated;
      
      const nbPages = data.nbPages || 0;
      if (page >= nbPages - 1) {
        hasMore = false;
      } else {
        page++;
        // Sleep 1 second to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.error(`Error crawling ${tags} page ${page}:`, err.message);
      break;
    }
  }
  return { totalInserted, totalUpdated };
}

async function run() {
  let numericFilters = '';
  if (CRAWL_START_DATE) {
    const startTimestamp = Math.floor(new Date(CRAWL_START_DATE).getTime() / 1000);
    const endTimestamp = CRAWL_END_DATE 
      ? Math.floor(new Date(CRAWL_END_DATE).getTime() / 1000) 
      : Math.floor(Date.now() / 1000);
    
    if (!isNaN(startTimestamp) && !isNaN(endTimestamp)) {
      numericFilters = `created_at_i>=${startTimestamp},created_at_i<=${endTimestamp}`;
      console.log(`Running historical crawler: ${CRAWL_START_DATE} to ${CRAWL_END_DATE || 'now'} (${numericFilters})`);
    } else {
      console.warn('Invalid CRAWL_START_DATE or CRAWL_END_DATE. Falling back to default crawl.');
    }
  } else {
    console.log('Running live frontpage/recent crawler (CRAWL_START_DATE not set).');
  }

  let totalInserted = 0;
  let totalUpdated = 0;

  try {
    if (numericFilters) {
      // Historical: crawl stories, then comments inside the date range
      const storyStats = await crawlTags('story', numericFilters);
      totalInserted += storyStats.totalInserted;
      totalUpdated += storyStats.totalUpdated;

      await new Promise(resolve => setTimeout(resolve, 1000)); // gap between tags

      const commentStats = await crawlTags('comment', numericFilters);
      totalInserted += commentStats.totalInserted;
      totalUpdated += commentStats.totalUpdated;
    } else {
      // Live: crawl frontpage stories and recent comments
      const storyStats = await crawlTags('front_page');
      totalInserted += storyStats.totalInserted;
      totalUpdated += storyStats.totalUpdated;

      await new Promise(resolve => setTimeout(resolve, 1000)); // gap between tags

      const commentStats = await crawlTags('comment');
      totalInserted += commentStats.totalInserted;
      totalUpdated += commentStats.totalUpdated;
    }

    console.log(`Crawl run completed. Status: New Ingested = ${totalInserted}, Duplicates Updated = ${totalUpdated}`);
  } catch (err) {
    console.error('Crawler execution error:', err);
  } finally {
    if (require.main === module) {
      await db.pool.end();
    }
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
