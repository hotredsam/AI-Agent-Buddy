import Database from "better-sqlite3";

export type JobStatus = "pending" | "running" | "done" | "failed";

export type AddJobInput = {
  type: string;
  data?: any;
};

type JobRow = {
  id: number;
  type: string;
  data: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
};

type JobLogRow = {
  id: number;
  job_id: number;
  message: string;
  created_at: string;
};

export class JobQueue {
  public db: Database.Database;

  constructor(opts?: { dbPath?: string }) {
    const dbPath = opts?.dbPath ?? ":memory:";
    this.db = new Database(dbPath);

    this.db.exec(`
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
  }

  async addJob(input: AddJobInput): Promise<number> {
    const info = this.db
      .prepare(`INSERT INTO jobs (type, data, status) VALUES (?, ?, 'pending')`)
      .run(input.type, JSON.stringify(input.data ?? null));
    return Number(info.lastInsertRowid);
  }

  async getJob(id: number): Promise<(Omit<JobRow, "data"> & { data: any }) | null> {
    const row = this.db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as JobRow | undefined;
    if (!row) return null;
    return { ...row, data: JSON.parse(row.data) };
  }

  async updateJobStatus(id: number, status: JobStatus): Promise<void> {
    this.db
      .prepare(`UPDATE jobs SET status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(status, id);
  }

  async addJobLog(jobId: number, message: string): Promise<void> {
    this.db.prepare(`INSERT INTO job_logs (job_id, message) VALUES (?, ?)`).run(jobId, message);
  }

  async getJobLogs(jobId: number): Promise<JobLogRow[]> {
    return this.db
      .prepare(`SELECT * FROM job_logs WHERE job_id = ? ORDER BY id ASC`)
      .all(jobId) as JobLogRow[];
  }

  async getPendingJobs(limit: number): Promise<Array<{ id: number; type: string; data: any; status: JobStatus }>> {
    const rows = this.db
      .prepare(`SELECT * FROM jobs WHERE status = 'pending' ORDER BY id ASC LIMIT ?`)
      .all(limit) as JobRow[];

    return rows.map(r => ({ id: r.id, type: r.type, data: JSON.parse(r.data), status: r.status }));
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
