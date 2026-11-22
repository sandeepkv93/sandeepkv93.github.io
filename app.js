(function () {
  "use strict";

  const SNAKE_DARK = "https://raw.githubusercontent.com/sandeepkv93/sandeepkv93/output/github-snake-dark.svg";
  const SNAKE_LIGHT = "https://raw.githubusercontent.com/sandeepkv93/sandeepkv93/output/github-snake.svg";

  const FALLBACK_DATA = {
    username: "sandeepkv93",
    updated_date: "2026-11-22",
    metrics: {
      contributions_yr: 614,
      commits_yr: 426,
      public_repos: 83,
      pull_requests: 41,
      total_stars: 15,
      followers: 24,
      years_exp: "11+ yrs",
    },
    top_langs: [
      { name: "Go", count: 25, pct: 37.9, color: "#00ADD8" },
      { name: "Java", count: 17, pct: 25.7, color: "#b07219" },
      { name: "Python", count: 13, pct: 19.7, color: "#3572A5" },
      { name: "TypeScript", count: 6, pct: 9.1, color: "#3178c6" },
      { name: "JavaScript", count: 5, pct: 7.6, color: "#f1e05a" },
    ],
    projects: [],
  };

  let siteData = FALLBACK_DATA;
  let activeFilter = "all";
  let searchQuery = "";
  const commandHistory = [];
  let historyIndex = -1;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const snake = document.getElementById("contribution-snake");
    if (snake) {
      snake.src = theme === "light" ? SNAKE_LIGHT : SNAKE_DARK;
    }
  }

  function initTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current);

    const toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
        localStorage.setItem("sv-theme", next);
        applyTheme(next);
      });
    }
  }

  function renderTelemetry(data) {
    const m = data.metrics || FALLBACK_DATA.metrics;
    const setText = function (id, val) {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };

    setText("metric-contribs", m.contributions_yr);
    setText("metric-repos", m.public_repos);
    setText("metric-prs", m.pull_requests);
    setText("metric-stars", m.total_stars);
    setText("metric-exp", m.years_exp);
    setText("portrait-exp", "Seattle, WA \u00b7 " + m.years_exp);

    if (data.updated_date) {
      setText("sync-timestamp", "Synced " + data.updated_date + " via GitHub Actions");
      setText("terminal-synced", "synced " + data.updated_date);
    }

    const bar = document.getElementById("lang-bar");
    const legend = document.getElementById("lang-legend");
    const langs = data.top_langs && data.top_langs.length ? data.top_langs : FALLBACK_DATA.top_langs;

    if (bar && legend) {
      bar.innerHTML = langs
        .map(function (lang) {
          return (
            '<span class="lang-seg" style="width:' +
            lang.pct +
            "%;background:" +
            escapeHtml(lang.color) +
            '" title="' +
            escapeHtml(lang.name) +
            " " +
            lang.pct.toFixed(1) +
            '%"></span>'
          );
        })
        .join("");

      legend.innerHTML = langs
        .map(function (lang) {
          return (
            '<li><span class="lang-dot" style="background:' +
            escapeHtml(lang.color) +
            '"></span><span>' +
            escapeHtml(lang.name) +
            '</span><span class="lang-pct">' +
            lang.pct.toFixed(1) +
            "%</span></li>"
          );
        })
        .join("");
    }
  }

  function renderProjects() {
    const grid = document.getElementById("projects-grid");
    const countEl = document.getElementById("project-count");
    if (!grid) return;

    const query = searchQuery.trim().toLowerCase();
    const filtered = (siteData.projects || []).filter(function (project) {
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "pinned" && project.pinned) ||
        (activeFilter === "demo" && Boolean(project.demo)) ||
        (project.categories || []).indexOf(activeFilter) !== -1;

      if (!matchesFilter) return false;
      if (!query) return true;

      const haystack = [
        project.title,
        project.name,
        project.summary,
        project.language,
        (project.tags || []).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.indexOf(query) !== -1;
    });

    if (countEl) {
      const total = (siteData.projects || []).length;
      countEl.textContent =
        filtered.length === total
          ? total + " flagship projects"
          : filtered.length + " of " + total + " shown";
    }

    if (!filtered.length) {
      grid.innerHTML =
        '<div class="empty-state">No projects matched your filter. Try clearing the search or choosing All.</div>';
      return;
    }

    grid.innerHTML = filtered
      .map(function (project) {
        const pinnedBadge = project.pinned
          ? '<span class="badge-pill badge-pinned">Pinned</span>'
          : "";
        const starsHtml =
          project.stars > 0
            ? "<span>&#9733; " + escapeHtml(project.stars) + "</span>"
            : "";
        const demoLink = project.demo
          ? '<a class="project-demo-link" href="' +
            escapeHtml(project.demo) +
            '" target="_blank" rel="noopener noreferrer">Live Demo &rarr;</a>'
          : "";

        return (
          '<article class="project-card">' +
          "<div>" +
          '<div class="project-top">' +
          '<h3 class="project-title"><a href="' +
          escapeHtml(project.url) +
          '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(project.title) +
          "</a></h3>" +
          '<div class="project-badges">' +
          pinnedBadge +
          "</div>" +
          "</div>" +
          '<p class="project-summary">' +
          escapeHtml(project.summary) +
          "</p>" +
          "</div>" +
          '<div class="project-footer">' +
          '<div class="project-meta">' +
          '<span class="project-lang"><span class="lang-dot" style="background:' +
          escapeHtml(project.language_color || "#29B5E8") +
          '"></span>' +
          escapeHtml(project.language) +
          "</span>" +
          starsHtml +
          "</div>" +
          '<div class="project-actions">' +
          demoLink +
          '<a class="project-source-link" href="' +
          escapeHtml(project.url) +
          '" target="_blank" rel="noopener noreferrer">Source</a>' +
          "</div>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function initProjectControls() {
    const buttons = document.querySelectorAll(".filter-btn");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeFilter = btn.getAttribute("data-filter") || "all";
        buttons.forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === btn));
        });
        renderProjects();
      });
    });

    const searchInput = document.getElementById("project-search");
    if (searchInput) {
      searchInput.addEventListener("input", function (event) {
        searchQuery = event.target.value || "";
        renderProjects();
      });
    }
  }

  function buildCommandLines(cmd) {
    const m = siteData.metrics || FALLBACK_DATA.metrics;
    const langs = (siteData.top_langs || FALLBACK_DATA.top_langs)
      .map(function (l) {
        return l.name + " (" + l.pct.toFixed(1) + "%)";
      })
      .join(", ");

    const commands = {
      neofetch: [
        '<span class="term-accent">sandeepkv93@snowflake-data-cloud</span>',
        '<span class="term-muted">-----------------------------------------------</span>',
        '<span class="term-key">role</span>        <span class="term-muted">..</span> <span class="term-accent">Senior Software Engineer @ Snowflake (SiS)</span>',
        '<span class="term-key">experience</span>  <span class="term-muted">..</span> ' + escapeHtml(m.years_exp) + " (Snowflake, Microsoft Azure, VMware)",
        '<span class="term-key">education</span>   <span class="term-muted">..</span> M.S. Computer Science, Stony Brook University',
        '<span class="term-key">focus</span>       <span class="term-muted">..</span> Cloud-Native Runtimes, Distributed Systems, OpenTelemetry',
        '<span class="term-key">languages</span>   <span class="term-muted">..</span> <span class="term-green">Go, Python, Java, TypeScript, C</span>',
        '<span class="term-key">infra</span>       <span class="term-muted">..</span> Kubernetes, Docker, Bazel, Prometheus, Grafana, RabbitMQ',
        '<span class="term-key">patent</span>      <span class="term-muted">..</span> US12056521B2 (ML Spot VM Replenishment, Azure)',
        '<span class="term-key">github.live</span> <span class="term-muted">..</span> ' +
          escapeHtml(m.public_repos) +
          " public repos | " +
          escapeHtml(m.contributions_yr) +
          " contribs/yr | " +
          escapeHtml(m.total_stars) +
          " stars",
      ],
      experience: [
        '<span class="term-accent">2022 - Present</span>  Snowflake | Senior Software Engineer, Streamlit in Snowflake (SiS)',
        '<span class="term-accent">2019 - 2022</span>     Microsoft Azure | Senior Software Engineer, Spot VMs &amp; Partner Solutions',
        '<span class="term-accent">2015 - 2017</span>     VMware / Digital Fuel | Member of Technical Staff (R&amp;D)',
      ],
      projects: (siteData.projects || []).slice(0, 8).map(function (p) {
        return (
          '<span class="term-key">' +
          escapeHtml(p.name) +
          "</span>  " +
          '<span class="term-muted">[' +
          escapeHtml(p.language) +
          "]</span>  " +
          escapeHtml(p.summary)
        );
      }),
      skills: [
        '<span class="term-key">Languages</span>      <span class="term-muted">..</span> Go, Python, Java, TypeScript, C',
        '<span class="term-key">Cloud</span>          <span class="term-muted">..</span> Kubernetes, Snowpark Container Services, Docker, Bazel, Azure, AWS',
        '<span class="term-key">Observability</span>  <span class="term-muted">..</span> OpenTelemetry, Prometheus, Grafana',
        '<span class="term-key">Data &amp; Async</span>   <span class="term-muted">..</span> PostgreSQL, DuckDB, Redis, RabbitMQ, gRPC / ConnectRPC',
      ],
      patent: [
        '<span class="term-key">Patent</span>         <span class="term-muted">..</span> US12056521B2 (Microsoft Azure Spot)',
        '<span class="term-key">Title</span>          <span class="term-muted">..</span> Machine-learning-based replenishment of interruptible workloads in cloud environment',
        '<span class="term-key">Impact</span>         <span class="term-muted">..</span> 4x workload runtime, 5x core consumption, 65% to 95% cluster utilization',
        '<span class="term-key">Publication</span>    <span class="term-muted">..</span> DSAdvisor: Facilitating Deeper Inquiry in the Data Structures Course (IEEE LaTiCE 2016)',
      ],
      stats: [
        '<span class="term-key">Contributions</span>  <span class="term-muted">..</span> <span class="term-green">' + escapeHtml(m.contributions_yr) + "</span> (past 12 months)",
        '<span class="term-key">Public Repos</span>   <span class="term-muted">..</span> <span class="term-accent">' + escapeHtml(m.public_repos) + "</span> (non-fork owned)",
        '<span class="term-key">Pull Requests</span>  <span class="term-muted">..</span> ' + escapeHtml(m.pull_requests),
        '<span class="term-key">Stars Earned</span>   <span class="term-muted">..</span> ' + escapeHtml(m.total_stars),
        '<span class="term-key">Top Languages</span>  <span class="term-muted">..</span> ' + escapeHtml(langs),
        '<span class="term-key">Synced</span>         <span class="term-muted">..</span> ' + escapeHtml(siteData.updated_date),
      ],
      help: [
        "Available commands:",
        '  <span class="term-accent">neofetch</span>    Profile &amp; live telemetry summary',
        '  <span class="term-accent">experience</span>  Career timeline (Snowflake, Microsoft Azure, VMware)',
        '  <span class="term-accent">projects</span>    Flagship systems and open-source builds',
        '  <span class="term-accent">skills</span>      Core languages, cloud, observability, and data stack',
        '  <span class="term-accent">patent</span>      US12056521B2 patent &amp; IEEE publication details',
        '  <span class="term-accent">stats</span>       Live GitHub metrics and top language breakdown',
        '  <span class="term-accent">clear</span>       Clear terminal output',
      ],
    };

    return commands[cmd] || null;
  }

  function runTerminalCommand(rawInput) {
    const output = document.getElementById("terminal-output");
    if (!output) return;

    const cmd = rawInput.trim().toLowerCase();
    if (!cmd) return;

    if (cmd === "clear") {
      output.innerHTML = "";
      return;
    }

    const lines = buildCommandLines(cmd);
    const entry = document.createElement("div");
    entry.className = "term-entry";

    const header =
      '<div class="term-cmd-line">' +
      '<span class="term-prompt-sym">&#10140;</span> ' +
      '<span class="term-prompt-dir">~/systems</span> ' +
      '<span class="term-muted">$</span> ' +
      escapeHtml(cmd) +
      "</div>";

    const bodyLines = lines
      ? lines
      : [
          '<span class="term-muted">zsh: command not found: ' +
            escapeHtml(cmd) +
            '. Type <span class="term-accent">help</span> to see available commands.</span>',
        ];

    entry.innerHTML =
      header +
      bodyLines
        .map(function (line) {
          return '<div class="term-line">' + line + "</div>";
        })
        .join("");

    output.appendChild(entry);
    output.scrollTop = output.scrollHeight;
  }

  function initTerminal() {
    const knownCommands = ["neofetch", "experience", "projects", "skills", "patent", "stats", "help", "clear"];
    const form = document.getElementById("terminal-form");
    const input = document.getElementById("terminal-input");

    document.querySelectorAll(".cmd-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        const cmd = chip.getAttribute("data-cmd");
        if (cmd) runTerminalCommand(cmd);
      });
    });

    if (form && input) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        const val = input.value.trim();
        if (!val) return;
        commandHistory.push(val);
        historyIndex = commandHistory.length;
        runTerminalCommand(val);
        input.value = "";
      });

      input.addEventListener("keydown", function (event) {
        if (event.key === "ArrowUp") {
          if (historyIndex > 0) {
            historyIndex -= 1;
            input.value = commandHistory[historyIndex];
          }
          event.preventDefault();
        } else if (event.key === "ArrowDown") {
          if (historyIndex < commandHistory.length - 1) {
            historyIndex += 1;
            input.value = commandHistory[historyIndex];
          } else {
            historyIndex = commandHistory.length;
            input.value = "";
          }
          event.preventDefault();
        } else if (event.key === "Tab") {
          const partial = input.value.trim().toLowerCase();
          if (partial) {
            const match = knownCommands.find(function (c) {
              return c.indexOf(partial) === 0;
            });
            if (match) {
              input.value = match;
              event.preventDefault();
            }
          }
        }
      });
    }
  }

  async function hydrateData() {
    try {
      const resp = await fetch("./data/github-stats.json", { cache: "no-cache" });
      if (resp.ok) {
        siteData = await resp.json();
      }
    } catch (_err) {
      siteData = FALLBACK_DATA;
    }

    renderTelemetry(siteData);
    renderProjects();
    const output = document.getElementById("terminal-output");
    if (output && !output.children.length) {
      runTerminalCommand("neofetch");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initProjectControls();
    initTerminal();
    hydrateData();
  });
})();
