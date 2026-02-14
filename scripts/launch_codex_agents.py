import concurrent.futures
import datetime
import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "agent_runs"
OUT_DIR.mkdir(parents=True, exist_ok=True)


IMPLEMENTATION_PROMPTS = [
    "Implementer A01: review VS Code-like top menu UX and propose precise patch steps.",
    "Implementer A02: improve code AI pane with plan/build/bugfix and fast feedback.",
    "Implementer A03: propose robust file-action menu for chat code blocks.",
    "Implementer A04: refine sidebar vertical nav and collapsed behavior.",
    "Implementer A05: design drag/reorder UX for file library list.",
    "Implementer A06: propose multi-sort file controls with open-in-code shortcut.",
    "Implementer A07: validate tab rename UX and persistence behavior.",
    "Implementer A08: system prompt settings design for chat/coding/plan/build/bugfix/image.",
]

BUGFIX_PROMPTS = [
    "Bugfix B01: scan for renderer prop/type mismatches caused by new code features.",
    "Bugfix B02: scan IPC contracts for payload mismatch and null/undefined risks.",
    "Bugfix B03: review code AI timeout and loading UX for failure states.",
    "Bugfix B04: review file operations edge cases: rename, move, duplicate, download.",
    "Bugfix B05: review sidebar keyboard shortcut regressions and nav consistency.",
    "Bugfix B06: review CSS overflow issues for code menubar and download shelf.",
]

DOC_PROMPTS = [
    "Docs C01: draft concise changelog entries for new IDE features.",
    "Docs C02: draft architecture notes for new IPC and AI mode routing.",
    "Docs C03: draft QA checklist for code view, files, settings, chat.",
    "Docs C04: draft release notes plus known limitations and next steps.",
]


def run_agent(phase: str, idx: int, prompt: str) -> tuple[str, int]:
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    out_file = OUT_DIR / f"{phase}_{idx:02d}_{stamp}.md"
    cmd = [
        "powershell",
        "-NoProfile",
        "-Command",
        f'codex exec "{prompt}"',
    ]
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(ROOT),
            text=False,
            capture_output=True,
            timeout=120,
            check=False,
        )
        stdout = (proc.stdout or b"").decode("utf-8", errors="replace")
        stderr = (proc.stderr or b"").decode("utf-8", errors="replace")
        exit_code = proc.returncode
    except subprocess.TimeoutExpired as exc:
        stdout = (exc.stdout or b"").decode("utf-8", errors="replace")
        stderr = ((exc.stderr or b"").decode("utf-8", errors="replace") + "\nTIMEOUT")
        exit_code = 124
    body = [
        f"# {phase} Agent {idx:02d}",
        "",
        f"- Prompt: {prompt}",
        f"- Exit code: {exit_code}",
        "",
        "## Stdout",
        "```",
        stdout.strip(),
        "```",
        "",
        "## Stderr",
        "```",
        stderr.strip(),
        "```",
        "",
    ]
    out_file.write_text("\n".join(body), encoding="utf-8")
    return (str(out_file), exit_code)


def run_phase(name: str, prompts: list[str]) -> list[tuple[str, int]]:
    print(f"Running phase: {name} ({len(prompts)} agents)")
    results: list[tuple[str, int]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(prompts)) as ex:
        futs = [ex.submit(run_agent, name, i + 1, p) for i, p in enumerate(prompts)]
        for fut in concurrent.futures.as_completed(futs):
            path, code = fut.result()
            print(f"[{name}] completed: exit={code} file={path}")
            results.append((path, code))
    return results


def main() -> None:
    all_results: list[tuple[str, int]] = []
    all_results.extend(run_phase("implementation", IMPLEMENTATION_PROMPTS))
    all_results.extend(run_phase("bugfix", BUGFIX_PROMPTS))
    all_results.extend(run_phase("docs", DOC_PROMPTS))

    ok = sum(1 for _, c in all_results if c == 0)
    print(f"All phases complete. Successful agents: {ok}/{len(all_results)}")


if __name__ == "__main__":
    main()
