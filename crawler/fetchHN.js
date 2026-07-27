const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../server/db/index');

const HN_ALGOLIA_BASE_URL = process.env.HN_ALGOLIA_BASE_URL || 'https://hn.algolia.com/api/v1';

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

async function fetchStories() {
  console.log('Fetching top stories from Algolia HN API...');
  const url = `${HN_ALGOLIA_BASE_URL}/search?tags=front_page&hitsPerPage=100`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch stories: ${res.statusText}`);
  }
  const data = await res.json();
  return data.hits || [];
}

async function fetchComments() {
  console.log('Fetching recent comments from Algolia HN API...');
  const url = `${HN_ALGOLIA_BASE_URL}/search_by_date?tags=comment&hitsPerPage=100`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch comments: ${res.statusText}`);
  }
  const data = await res.json();
  return data.hits || [];
}

async function saveToDatabase(items, type) {
  let count = 0;
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
      await db.query(
        `INSERT INTO docs (title, text, url, hn_id, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (hn_id)
         DO UPDATE SET
           title = EXCLUDED.title,
           text = EXCLUDED.text,
           url = EXCLUDED.url,
           created_at = EXCLUDED.created_at`,
        [title, text, url, hnId, createdAt]
      );
      count++;
    } catch (err) {
      console.error(`Error saving HN item ${hnId}:`, err.message);
    }
  }
  console.log(`Saved ${count} ${type} items to the database.`);
}

async function run() {
  try {
    const stories = await fetchStories();
    await saveToDatabase(stories, 'story');

    const comments = await fetchComments();
    await saveToDatabase(comments, 'comment');

    console.log('Crawl job finished successfully.');
  } catch (err) {
    console.error('Crawl job failed:', err);
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
