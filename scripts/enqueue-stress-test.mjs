import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const root = process.cwd();

// adjust these if you want
const dbPath = path.join(root, "jobqueue.sqlite");
const promptPath = path.join(root, "stress-test-prompt.txt");

if (!fs.existsSync(promptPath)) {
  console.error("Missing stress-test-prompt.txt at:", promptPath);
  process.exit(1);
}

const prompt = fs.readFileSync(promptPath, "utf8");

// Create/open DB
const db = new Database(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS job_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
  );
`);

const info = db
  .prepare(`INSERT INTO jobs (type, data, status) VALUES (?, ?, 'pending')`)
  .run("ai-stress-test", JSON.stringify({ prompt }));

const jobId = Number(info.lastInsertRowid);

db
  .prepare(`INSERT INTO job_logs (job_id, message) VALUES (?, ?)`)
  .run(jobId, "Enqueued ai-stress-test from scripts/enqueue-stress-test.mjs");

db.close();

console.log("✅ Enqueued job:", jobId);
console.log("DB:", dbPath);
console.log("Prompt:", promptPath);
