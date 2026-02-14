import fs from "node:fs";
import path from "node:path";
import { JobQueue } from "./JobQueue";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const dbPath = path.join(process.cwd(), "jobqueue.sqlite");
  const queue = new JobQueue({ dbPath });

  console.log("Runner using DB:", dbPath);

  while (true) {
    const jobs = await queue.getPendingJobs(5);

    for (const job of jobs) {
      await queue.updateJobStatus(job.id, "running");
      await queue.addJobLog(job.id, `Starting job type=${job.type}`);

      try {
        if (job.type === "ai-stress-test") {
          // For now: just write the prompt to a file so you can prove pipeline works
          const outDir = path.join(process.cwd(), "agent_outputs");
          fs.mkdirSync(outDir, { recursive: true });

          fs.writeFileSync(path.join(outDir, `stress_prompt_${job.id}.txt`), job.data?.prompt ?? "", "utf8");
          await queue.addJobLog(job.id, "Wrote prompt file to agent_outputs/");
        } else {
          await queue.addJobLog(job.id, `Unknown job type: ${job.type}`);
        }

        await queue.updateJobStatus(job.id, "done");
        await queue.addJobLog(job.id, "Job done ✅");
      } catch (err: any) {
        await queue.addJobLog(job.id, `Job failed: ${err?.stack ?? String(err)}`);
        await queue.updateJobStatus(job.id, "failed");
      }
    }

    await sleep(500);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
