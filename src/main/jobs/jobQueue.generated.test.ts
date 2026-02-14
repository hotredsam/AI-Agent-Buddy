import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { JobQueue } from "./JobQueue";

describe("JobQueue basic behaviors", () => {
  let jobQueue: JobQueue;

  beforeEach(() => {
    jobQueue = new JobQueue({ dbPath: ":memory:" });
  });

  afterEach(async () => {
    await jobQueue.close();
  });

  it("should update job status", async () => {
    const jobId = await jobQueue.addJob({
      type: "status-test",
      data: { message: "Status test" },
    });

    await jobQueue.updateJobStatus(jobId, "running");

    const job = await jobQueue.getJob(jobId);
    expect(job?.status).toBe("running");
  });

  it("should add job logs", async () => {
    const jobId = await jobQueue.addJob({
      type: "log-test",
      data: { message: "Log test" },
    });

    await jobQueue.addJobLog(jobId, "First log message");
    await jobQueue.addJobLog(jobId, "Second log message");

    const logs = await jobQueue.getJobLogs(jobId);

    expect(logs.length).toBe(2);
    expect(logs[0].message).toBe("First log message");
    expect(logs[1].message).toBe("Second log message");
  });

  it("should handle multiple jobs correctly", async () => {
    const job1Id = await jobQueue.addJob({
      type: "job-1",
      data: { message: "First job" },
    });

    const job2Id = await jobQueue.addJob({
      type: "job-2",
      data: { message: "Second job" },
    });

    const jobs = await jobQueue.getPendingJobs(10);

    expect(jobs.length).toBeGreaterThanOrEqual(2);
    expect(jobs[0].id).toBe(job1Id);
    expect(jobs[1].id).toBe(job2Id);
  });
});
