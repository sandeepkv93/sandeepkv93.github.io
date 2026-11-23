#!/usr/bin/env python3
"""
Fetch live GitHub telemetry, all owned public repository metadata, parse
portfolio HTML sections, merge curated LinkedIn data, and generate both
data/github-stats.json and data/knowledge.json using only Python stdlib.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import subprocess
import urllib.request
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

USERNAME = "sandeepkv93"
CAREER_START = dt.date(2015, 7, 1)
ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT_DIR / "data" / "github-stats.json"
KNOWLEDGE_FILE = ROOT_DIR / "data" / "knowledge.json"
LINKEDIN_FILE = ROOT_DIR / "data" / "linkedin-profile.json"
INDEX_HTML = ROOT_DIR / "index.html"

GRAPHQL_QUERY = """
query($login: String!, $cursor: String) {
  user(login: $login) {
    avatarUrl
    repositories(first: 100, after: $cursor, ownerAffiliations: OWNER, isFork: false, orderBy: {field: PUSHED_AT, direction: DESC}) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        name
        isPrivate
        stargazerCount
        pushedAt
        homepageUrl
        description
        primaryLanguage {
          name
          color
        }
        repositoryTopics(first: 10) {
          nodes {
            topic {
              name
            }
          }
        }
      }
    }
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes {
        ... on Repository {
          name
        }
      }
    }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
      }
    }
    pullRequests {
      totalCount
    }
    followers {
      totalCount
    }
  }
}
"""

LANG_FALLBACK_COLORS = {
    "Go": "#00ADD8",
    "Python": "#3572A5",
    "Java": "#B07219",
    "TypeScript": "#3178C6",
    "JavaScript": "#F1E05A",
    "Shell": "#89E051",
    "C": "#555555",
    "C#": "#178600",
    "Kotlin": "#A97BFF",
    "Dockerfile": "#384D54",
}

CURATED_PROJECTS: list[dict[str, Any]] = [
    {
        "name": "everything-backend-starter-kit",
        "title": "everything-backend-starter-kit",
        "summary": "Production-ready Go backend starter kit with secure auth and RBAC APIs, Redis rate limiting and abuse controls, observability, and Kubernetes deployment tooling.",
        "categories": ["pinned", "cloud", "go"],
        "tags": ["Go", "RBAC", "Redis", "Kubernetes"],
    },
    {
        "name": "distributed-systems-visualizer",
        "title": "distributed-systems-visualizer",
        "summary": "Interactive visual simulations for learning distributed systems algorithms with step-by-step playback controls and in-page theory guides.",
        "categories": ["pinned", "distributed", "web", "demo"],
        "tags": ["TypeScript", "Distributed Systems", "Interactive"],
        "demo": "https://sandeepkv93.github.io/distributed-systems-visualizer/",
    },
    {
        "name": "go-observability-demo",
        "title": "go-observability-demo",
        "summary": "Side-by-side comparison of Go observability stacks across metrics, traces, and logs, contrasting OpenTelemetry-first and Prometheus/Promtail pipelines.",
        "categories": ["pinned", "cloud", "go"],
        "tags": ["Go", "OpenTelemetry", "Prometheus", "Grafana"],
    },
    {
        "name": "concurrency-in-golang",
        "title": "concurrency-in-golang",
        "summary": "Structured collection of Go concurrency patterns, synchronization primitives, worker pools, and practical experiments for mastering parallel execution.",
        "categories": ["pinned", "distributed", "go"],
        "tags": ["Go", "Concurrency", "Patterns"],
    },
    {
        "name": "oauth-from-scratch-in-go",
        "title": "oauth-from-scratch-in-go",
        "summary": "RFC-compliant OAuth 2.0 authorization server and OpenID Connect provider implemented from scratch in Go with PKCE, token rotation, and security hardening.",
        "categories": ["pinned", "cloud", "go"],
        "tags": ["Go", "OAuth 2.0", "OIDC", "Security"],
    },
    {
        "name": "k8s-distributed-cron-jobs",
        "title": "k8s-distributed-cron-jobs",
        "summary": "Distributed task processing system built on Kubernetes Jobs, CronJobs, and Redis work queues with authentication, monitoring, and workflow recovery.",
        "categories": ["pinned", "distributed", "cloud", "go"],
        "tags": ["Go", "Kubernetes", "Redis", "Scheduling"],
    },
    {
        "name": "podbeacon",
        "title": "podbeacon",
        "summary": "Kubernetes operator that automatically injects and configures OpenTelemetry Collector sidecars on annotated pods.",
        "categories": ["cloud", "go"],
        "tags": ["Go", "Kubernetes Operator", "OpenTelemetry"],
    },
    {
        "name": "raft-consensus",
        "title": "raft-consensus",
        "summary": "Raft distributed consensus implemented from scratch in Go with leader election, log replication, snapshotting, and a linearizable KV store.",
        "categories": ["distributed", "go"],
        "tags": ["Go", "Raft", "Consensus", "KV Store"],
    },
    {
        "name": "otelviz",
        "title": "otelviz",
        "summary": "Interactive Streamlit application for validating, simulating, and visualizing OpenTelemetry Collector receiver, processor, and exporter pipelines.",
        "categories": ["cloud", "web"],
        "tags": ["Python", "Streamlit", "OpenTelemetry"],
    },
    {
        "name": "retry-budget-validator",
        "title": "retry-budget-validator",
        "summary": "TypeScript library and CLI that statically analyzes declarative retry topologies to catch retry storms and exhaustion budgets before production.",
        "categories": ["distributed", "web"],
        "tags": ["TypeScript", "Reliability", "CLI"],
    },
    {
        "name": "googlysync",
        "title": "googlysync",
        "summary": "Linux desktop client for Google Drive combining a Go sync daemon, GTK4 native interface, and FUSE file streaming built with Bazel.",
        "categories": ["cloud", "go"],
        "tags": ["Go", "Bazel", "GTK4", "FUSE"],
    },
    {
        "name": "lps",
        "title": "lps (Load Pattern Simulator)",
        "summary": "Typed Python HTTP traffic generator and load experiment runner backed by DuckDB analytics storage and Streamlit reporting.",
        "categories": ["distributed", "web"],
        "tags": ["Python", "DuckDB", "Load Testing"],
    },
    {
        "name": "go-saga-lab",
        "title": "go-saga-lab",
        "summary": "Saga lifecycle orchestration in Go featuring explicit state transitions, PostgreSQL persistence with SQL migrations, and a durable outbox dispatcher.",
        "categories": ["distributed", "go"],
        "tags": ["Go", "PostgreSQL", "Saga", "Outbox"],
    },
    {
        "name": "oidc-flow-demo",
        "title": "oidc-flow-demo",
        "summary": "Interactive step-by-step visual walkthrough of the OpenID Connect authentication flow, tokens, and protocol exchanges.",
        "categories": ["cloud", "web", "demo"],
        "tags": ["OIDC", "OAuth 2.0", "Interactive"],
        "demo": "https://sandeepkv93.github.io/oidc-flow-demo/",
    },
]


class PortfolioSectionParser(HTMLParser):
    """Extract readable text from key static sections of index.html."""

    TARGET_SECTIONS = {"overview", "experience", "stack"}
    SKIP_TAGS = {"script", "style", "svg", "button", "input", "form"}

    def __init__(self) -> None:
        super().__init__()
        self.active_section: str | None = None
        self.section_depth = 0
        self.skip_depth = 0
        self.sections: dict[str, list[str]] = {k: [] for k in self.TARGET_SECTIONS}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = dict(attrs)
        if tag in self.SKIP_TAGS:
            self.skip_depth += 1
            return
        if self.active_section is None and tag == "section":
            sec_id = attr_map.get("id")
            if sec_id in self.TARGET_SECTIONS:
                self.active_section = sec_id
                self.section_depth = 1
                return
        if self.active_section is not None:
            self.section_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in self.SKIP_TAGS and self.skip_depth > 0:
            self.skip_depth -= 1
            return
        if self.active_section is not None:
            self.section_depth -= 1
            if self.section_depth <= 0:
                self.active_section = None
                self.section_depth = 0

    def handle_data(self, data: str) -> None:
        if self.active_section is not None and self.skip_depth == 0:
            cleaned = re.sub(r"\s+", " ", data).strip()
            if cleaned:
                self.sections[self.active_section].append(cleaned)


def parse_portfolio_html() -> dict[str, str]:
    if not INDEX_HTML.exists():
        return {}
    parser = PortfolioSectionParser()
    parser.feed(INDEX_HTML.read_text(encoding="utf-8"))
    return {sec: " ".join(parts) for sec, parts in parser.sections.items() if parts}


def load_linkedin_data() -> dict[str, Any]:
    if not LINKEDIN_FILE.exists():
        return {}
    return json.loads(LINKEDIN_FILE.read_text(encoding="utf-8"))


def run_graphql(token: str | None, cursor: str | None) -> dict[str, Any]:
    variables: dict[str, Any] = {"login": USERNAME, "cursor": cursor}
    if token:
        payload = json.dumps({"query": GRAPHQL_QUERY, "variables": variables}).encode("utf-8")
        req = urllib.request.Request(
            "https://api.github.com/graphql",
            data=payload,
            headers={
                "Authorization": f"bearer {token}",
                "Content-Type": "application/json",
                "User-Agent": "sandeepkv93-site-updater",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    cmd = ["gh", "api", "graphql", "-F", f"login={USERNAME}", "-f", f"query={GRAPHQL_QUERY}"]
    if cursor:
        cmd.extend(["-F", f"cursor={cursor}"])
    proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(proc.stdout)


def fetch_site_and_knowledge() -> tuple[dict[str, Any], dict[str, Any]]:
    token = os.environ.get("GH_STATS_TOKEN") or os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    repo_nodes: list[dict[str, Any]] = []
    cursor: str | None = None
    user: dict[str, Any] = {}

    while True:
        data = run_graphql(token, cursor)
        user = data["data"]["user"]
        repos = user["repositories"]
        repo_nodes.extend(repos["nodes"])
        if not repos["pageInfo"]["hasNextPage"]:
            break
        cursor = repos["pageInfo"]["endCursor"]

    public_repos = [r for r in repo_nodes if not r["isPrivate"]]
    repo_by_name = {r["name"]: r for r in public_repos}
    curated_by_name = {item["name"]: item for item in CURATED_PROJECTS}
    pinned_names = {n["name"] for n in (user.get("pinnedItems", {}).get("nodes") or []) if n and n.get("name")}
    total_stars = sum(r["stargazerCount"] for r in repo_nodes)

    lang_counts: Counter[str] = Counter()
    lang_colors: dict[str, str] = {}
    for r in public_repos:
        if r["name"].lower() == USERNAME.lower():
            continue
        pl = r.get("primaryLanguage")
        if pl and pl.get("name"):
            name = pl["name"]
            lang_counts[name] += 1
            lang_colors[name] = pl.get("color") or LANG_FALLBACK_COLORS.get(name, "#29B5E8")

    top_langs: list[dict[str, Any]] = []
    top_items = lang_counts.most_common(5)
    if top_items:
        total_lang_repos = sum(c for _, c in top_items)
        exact_tenths = [(name, count, (count * 1000) / total_lang_repos) for name, count in top_items]
        floored = [int(t) for _, _, t in exact_tenths]
        remainder = 1000 - sum(floored)
        order = sorted(
            range(len(exact_tenths)),
            key=lambda i: (exact_tenths[i][2] - floored[i], exact_tenths[i][1]),
            reverse=True,
        )
        for idx in order[:remainder]:
            floored[idx] += 1
        for (name, count, _), tenths in zip(exact_tenths, floored):
            top_langs.append(
                {
                    "name": name,
                    "count": count,
                    "pct": tenths / 10.0,
                    "color": lang_colors[name],
                }
            )

    flagship_projects: list[dict[str, Any]] = []
    for item in CURATED_PROJECTS:
        live = repo_by_name.get(item["name"], {})
        pl = live.get("primaryLanguage") or {}
        lang_name = pl.get("name") or (item["tags"][0] if item["tags"] else "Code")
        lang_color = pl.get("color") or LANG_FALLBACK_COLORS.get(lang_name, "#29B5E8")
        demo_url = item.get("demo") or live.get("homepageUrl") or ""
        categories = list(item["categories"])
        is_pinned = item["name"] in pinned_names
        if is_pinned and "pinned" not in categories:
            categories.insert(0, "pinned")
        flagship_projects.append(
            {
                "name": item["name"],
                "title": item["title"],
                "url": f"https://github.com/{USERNAME}/{item['name']}",
                "demo": demo_url,
                "summary": item["summary"],
                "language": lang_name,
                "language_color": lang_color,
                "stars": live.get("stargazerCount", 0),
                "pushed_at": (live.get("pushedAt") or "")[:10],
                "pinned": is_pinned,
                "categories": categories,
                "tags": item["tags"],
            }
        )

    all_public_repos: list[dict[str, Any]] = []
    for r in public_repos:
        name = r["name"]
        curated = curated_by_name.get(name)
        pl = r.get("primaryLanguage") or {}
        topics = [
            node["topic"]["name"]
            for node in (r.get("repositoryTopics", {}).get("nodes") or [])
            if node and node.get("topic") and node["topic"].get("name")
        ]
        summary = (curated["summary"] if curated else (r.get("description") or "")).strip()
        tags = list(curated["tags"]) if curated else []
        for topic in topics:
            if topic.lower() not in {t.lower() for t in tags}:
                tags.append(topic)
        demo_url = (curated.get("demo") if curated else "") or (r.get("homepageUrl") or "")
        all_public_repos.append(
            {
                "name": name,
                "title": curated["title"] if curated else name,
                "url": f"https://github.com/{USERNAME}/{name}",
                "demo": demo_url,
                "summary": summary,
                "language": pl.get("name") or "",
                "stars": r.get("stargazerCount", 0),
                "pushed_at": (r.get("pushedAt") or "")[:10],
                "pinned": name in pinned_names,
                "flagship": curated is not None,
                "tags": tags,
            }
        )

    contrib = user["contributionsCollection"]
    today = dt.date.today()
    years_exp = int((today - CAREER_START).days / 365.25)

    metrics = {
        "contributions_yr": contrib["contributionCalendar"]["totalContributions"],
        "commits_yr": contrib["totalCommitContributions"],
        "public_repos": len(public_repos),
        "pull_requests": user["pullRequests"]["totalCount"],
        "total_stars": total_stars,
        "followers": user["followers"]["totalCount"],
        "years_exp": f"{years_exp}+ yrs",
    }

    site_payload = {
        "username": USERNAME,
        "avatar_url": user.get("avatarUrl") or f"https://github.com/{USERNAME}.png",
        "updated_date": today.strftime("%Y-%m-%d"),
        "metrics": metrics,
        "top_langs": top_langs,
        "projects": flagship_projects,
    }

    linkedin = load_linkedin_data()
    html_sections = parse_portfolio_html()

    knowledge_payload = {
        "meta": {
            "username": USERNAME,
            "updated_date": today.strftime("%Y-%m-%d"),
            "public_repo_count": len(all_public_repos),
            "flagship_count": len(flagship_projects),
            "sources": [
                {"name": "Portfolio HTML", "url": "https://sandeepkv93.github.io/"},
                {"name": "GitHub (auto-synced daily)", "url": f"https://github.com/{USERNAME}"},
                {"name": "LinkedIn (curated)", "url": linkedin.get("source_url", "https://www.linkedin.com/in/sandeepkv93")},
            ],
        },
        "profile": linkedin,
        "html_sections": html_sections,
        "metrics": metrics,
        "top_langs": top_langs,
        "repos": all_public_repos,
    }

    return site_payload, knowledge_payload


def main() -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    site_payload, knowledge_payload = fetch_site_and_knowledge()
    DATA_FILE.write_text(json.dumps(site_payload, indent=2) + "\n", encoding="utf-8")
    KNOWLEDGE_FILE.write_text(json.dumps(knowledge_payload, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {DATA_FILE.name} ({len(site_payload['projects'])} flagship) and "
        f"{KNOWLEDGE_FILE.name} ({len(knowledge_payload['repos'])} public repos)"
    )


if __name__ == "__main__":
    main()
