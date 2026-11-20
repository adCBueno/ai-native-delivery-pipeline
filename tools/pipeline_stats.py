"""Delivery metrics from the GitLab API: how long pipelines take, how often
they pass, and which jobs are the slowest. Useful to show the effect of a
change (for example adding the build cache) with numbers.

Usage:
  GITLAB_API_TOKEN=... python tools/pipeline_stats.py <project-id> [--ref main] [--last 30]
Optional: GITLAB_URL (default https://gitlab.com)
"""

from __future__ import annotations

import argparse
import os
import statistics
from collections import defaultdict

import requests


def summarize(pipelines: list[dict], jobs_by_pipeline: dict[int, list[dict]]) -> str:
    finished = [p for p in pipelines if p.get("status") in {"success", "failed"}]
    if not finished:
        return "No finished pipelines found."

    durations = [p["duration"] for p in finished if p.get("duration")]
    passed = sum(1 for p in finished if p["status"] == "success")

    job_times: dict[str, list[float]] = defaultdict(list)
    for jobs in jobs_by_pipeline.values():
        for job in jobs:
            if job.get("duration"):
                job_times[job["name"]].append(job["duration"])
    slowest = sorted(job_times.items(), key=lambda kv: statistics.median(kv[1]), reverse=True)[:5]

    lines = [
        f"Pipelines analysed: {len(finished)}",
        f"Success rate: {passed / len(finished):.0%}",
    ]
    if durations:
        lines.append(f"Median duration: {statistics.median(durations) / 60:.1f} min")
        lines.append(f"Slowest pipeline: {max(durations) / 60:.1f} min")
    lines.append("")
    lines.append("| Job | Median duration (s) | Runs |")
    lines.append("| --- | ---: | ---: |")
    lines += [f"| {name} | {statistics.median(times):.0f} | {len(times)} |" for name, times in slowest]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("project_id")
    parser.add_argument("--ref", default=None)
    parser.add_argument("--last", type=int, default=30)
    args = parser.parse_args()

    base = f"{os.environ.get('GITLAB_URL', 'https://gitlab.com')}/api/v4/projects/{args.project_id}"
    http = requests.Session()
    http.headers["PRIVATE-TOKEN"] = os.environ["GITLAB_API_TOKEN"]

    params = {"per_page": args.last, "order_by": "id", "sort": "desc"}
    if args.ref:
        params["ref"] = args.ref
    summaries = http.get(f"{base}/pipelines", params=params, timeout=30)
    summaries.raise_for_status()

    pipelines, jobs = [], {}
    for item in summaries.json():
        detail = http.get(f"{base}/pipelines/{item['id']}", timeout=30)
        detail.raise_for_status()
        pipelines.append(detail.json())
        job_list = http.get(f"{base}/pipelines/{item['id']}/jobs", params={"per_page": 100}, timeout=30)
        job_list.raise_for_status()
        jobs[item["id"]] = job_list.json()

    print(summarize(pipelines, jobs))


if __name__ == "__main__":
    main()
