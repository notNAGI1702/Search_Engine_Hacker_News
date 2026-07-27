# Hacker News Search Engine

A full-stack, high-performance search engine for Hacker News using a custom C++ BM25 ranking backend, Node.js crawler, Postgres database, and React + Tailwind CSS v4 frontend.

## Architecture Overview

- **Crawler (Node.js)**: Periodic fetch of top/new stories and recent comments via the Algolia HN search API.
- **Database (PostgreSQL)**: Stores normalized documents (`docs` table) and guarantees uniqueness via `hn_id`.
- **Search Backend (Express)**: Provides a JSON endpoint (`/search`) that executes the compiled C++ ranker binary per query using `execFile`.
- **Search Engine (C++17)**:
  - `indexer`: Tokenizes the corpus, constructs an inverted index containing term frequencies, and outputs `inverted_index.json`.
  - `ranker`: Implements the BM25 relevance ranking algorithm, takes a query string via command-line arguments, and prints ranked doc IDs and scores to stdout.
- **Frontend (Vite + Tailwind CSS v4)**: A React-based single-page search dashboard with micro-animations.

---

## Directory Structure

```
search-engine/
├── client/                 # Vite + React + Tailwind v4 frontend
├── crawler/                # Node.js HN API crawler + cron scheduler
├── data/                   # Search index and corpus artifacts (git-ignored)
├── engine/                 # C++ indexer and ranker code + Makefile
├── server/                 # Express backend server and Postgres migrations
├── .env.example            # Environment variables configuration template
└── README.md               # Setup and usage guide
```

---

## Getting Started

### 1. Environment Configuration

1. Copy `.env.example` to create your local `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your local Postgres connection credentials (`PGUSER`, `PGPASSWORD`, etc.).

### 2. Database Migration

1. Ensure your local PostgreSQL server is running and the database matches `PGDATABASE` (default `hn_search`).
2. Run database migrations to create the `docs` table:
   ```bash
   cd server
   npm run migrate
   ```

### 3. C++ Compilation

Compile the indexer and ranker binaries from the `engine` directory:
```bash
cd engine
make
```
*Note: This will download the header-only `nlohmann/json` dependency and output compiled binaries to `engine/build/indexer` and `engine/build/ranker`.*

---

## System Workflows

> [!IMPORTANT]
> **Data & Index Consistency Rule**:
> Because the indexer assigns term weights based on document frequencies in the database at a specific snapshot, the database corpus and the inverted index must always match.
>
> You **must** run the workflow below as a sequenced chain whenever new documents are crawled or updated. Do not run indexing and crawling independently.

### The Indexing Sequence:

1. **Crawl**: Run the crawler to fetch new stories and comments from the Algolia API:
   ```bash
   cd crawler
   npm run crawl
   ```
2. **Export**: Export the database documents to the corpus file (`data/hn_corpus.json`):
   ```bash
   cd server
   node db/exportCorpus.js
   ```
3. **Index**: Run the indexer binary to build a fresh inverted index:
   ```bash
   cd engine
   ./build/indexer
   ```

---

## Running the Application

### 1. Crawler Scheduler (Daemon)
To keep the search engine updated automatically every 10 minutes:
```bash
cd crawler
npm start
```

### 2. Express API Server
Start the Express server on port 3000:
```bash
cd server
npm start
```

### 3. Frontend Web App
Start the Vite development server:
```bash
cd client
npm run dev
```
Open `http://localhost:5173` in your browser.
