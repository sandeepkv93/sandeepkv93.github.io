(function (globalScope) {
  "use strict";

  const STOP_WORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "been", "being", "by", "can",
    "could", "did", "do", "does", "done", "for", "from", "get", "give", "got",
    "had", "has", "have", "he", "her", "here", "him", "his", "how", "i", "if",
    "in", "into", "is", "it", "its", "know", "like", "me", "more", "most", "my",
    "of", "on", "or", "our", "out", "please", "sandeep", "sandeepkv93", "vishnu",
    "show", "some", "tell", "than", "that", "the", "their", "them", "there",
    "these", "they", "this", "to", "up", "us", "use", "used", "using", "was",
    "we", "were", "what", "when", "where", "which", "who", "why", "will", "with",
    "would", "you", "your", "any", "all", "about", "anything", "built", "build",
    "made", "make", "worked", "work", "working", "ever", "really", "actually"
  ]);

  const SYNONYMS = {
    k8s: ["kubernetes", "operator", "pods", "cronjobs"],
    kubernetes: ["k8s", "operator", "pods", "containers"],
    otel: ["opentelemetry", "observability", "telemetry", "tracing", "metrics"],
    opentelemetry: ["otel", "observability", "telemetry", "tracing"],
    observability: ["opentelemetry", "otel", "prometheus", "grafana", "logging", "metrics", "tracing"],
    sis: ["snowflake", "streamlit", "spcs", "runtime"],
    spcs: ["snowpark", "container", "snowflake", "sis"],
    snowpark: ["snowflake", "spcs", "containers"],
    golang: ["go"],
    go: ["golang"],
    py: ["python"],
    python: ["py", "streamlit", "duckdb"],
    ts: ["typescript"],
    typescript: ["ts"],
    js: ["javascript"],
    javascript: ["js"],
    pg: ["postgresql", "postgres", "sql"],
    postgres: ["postgresql", "sql"],
    postgresql: ["postgres", "sql"],
    rmq: ["rabbitmq", "pubsub", "messaging"],
    rabbitmq: ["rmq", "pubsub", "queue"],
    ms: ["microsoft", "azure"],
    msft: ["microsoft", "azure"],
    microsoft: ["azure", "spot"],
    azure: ["microsoft", "spot", "partner"],
    sbu: ["stony", "brook", "university", "masters"],
    pes: ["pes", "university", "bachelors", "dsadvisor"],
    auth: ["oauth", "oidc", "rbac", "security", "openid"],
    oauth: ["oidc", "auth", "security", "openid"],
    oidc: ["oauth", "openid", "auth", "security"],
    ml: ["machine", "learning", "replenishment", "spot"],
    cv: ["experience", "career", "background", "resume"],
    resume: ["experience", "career", "background"],
    bio: ["overview", "summary", "background", "experience"],
    paper: ["publication", "ieee", "latice", "dsadvisor", "research"],
    research: ["patent", "publication", "ieee", "dsadvisor"],
    demos: ["demo", "interactive", "visualizer", "live"],
    demo: ["demos", "interactive", "visualizer", "live"],
    distributed: ["raft", "consensus", "saga", "outbox", "retry", "scheduler", "cron"],
    consensus: ["raft", "distributed", "linearizable", "kv"],
    saga: ["outbox", "distributed", "postgresql"],
    load: ["lps", "traffic", "duckdb", "simulator"],
    drive: ["googlysync", "fuse", "gtk4", "bazel"],
    os: ["sbunix", "kernel", "linux", "c"],
    kernel: ["sbunix", "c", "os"],
    android: ["kotlin", "cowsnbulls", "compose"]
  };

  const PRIVATE_OR_SENSITIVE_RE = /\b(salary|compensation|tc|total\s+comp|pay|wage|bonus|equity|stock|phone|cell|mobile|email|gmail|home\s+address|street\s+address|age|birthday|born|married|wife|husband|family|kids|visa|h1b|h-1b|green\s+card|sponsorship|citizenship|immigration|politics|political|religion|password|secret|private\s+repo|private\s+repos|ssn|net\s+worth)\b/i;

  const PROMPT_INJECTION_RE = /(ignore\s+(all\s+|previous\s+|prior\s+|above\s+)?instructions|system\s+prompt|pretend\s+(you\s+are|to\s+be)|act\s+as\s+(?!a\s+recruiter)|jailbreak|dan\s+mode|bypass\s+rules|override\s+rules)/i;

  const GENERAL_OFFTOPIC_RE = /^(write|generate|create|code|implement)\s+(me\s+)?(a|an|some)\s+(?:[a-z0-9+#.-]+\s+)?(code|script|program|function|algorithm|poem|essay|story|email|song|joke|recipe)\b|^(solve\s+\d|what\s+is\s+the\s+(weather|capital|population|time|date|president)|tell\s+me\s+a\s+joke|translate\s+|calculate\s+|\d+\s*[\+\-\*\/]\s*\d+)/i;

  const KNOWN_TECH_LIST = [
    "rust", "swift", "ruby", "rails", "php", "laravel", "elixir", "erlang",
    "scala", "clojure", "haskell", "perl", "r", "matlab", "julia", "zig",
    "flutter", "dart", "vue", "angular", "svelte", "nextjs", "next.js",
    "kafka", "spark", "flink", "airflow", "terraform", "ansible", "pulumi",
    "graphql", "grpc", "connectrpc", "mongodb", "mysql", "cassandra", "dynamodb",
    "snowflake", "streamlit", "kubernetes", "docker", "bazel", "opentelemetry",
    "prometheus", "grafana", "postgresql", "postgres", "duckdb", "redis",
    "rabbitmq", "go", "golang", "python", "java", "typescript", "javascript",
    "kotlin", "c#", "csharp", "c++", "cpp", "react", "linux", "fuse", "gtk4",
    "oauth", "oidc", "raft", "saga", "spring", "aws", "azure", "gcp"
  ];

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tokenize(text) {
    const raw = String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9+#.-]+/g, " ")
      .trim();
    if (!raw) return [];
    const tokens = [];
    raw.split(/\s+/).forEach(function (part) {
      const cleaned = part.replace(/^[.-]+|[.-]+$/g, "");
      if (!cleaned) return;
      tokens.push(cleaned);
      if (cleaned.indexOf("-") !== -1) {
        cleaned.split("-").forEach(function (sub) {
          if (sub) tokens.push(sub);
        });
      }
    });
    return tokens;
  }

  function expandQueryTokens(question) {
    const base = tokenize(question).filter(function (t) {
      return !STOP_WORDS.has(t);
    });
    const weighted = new Map();
    base.forEach(function (t) {
      weighted.set(t, Math.max(weighted.get(t) || 0, 1.0));
      const syns = SYNONYMS[t];
      if (syns) {
        syns.forEach(function (s) {
          if (!weighted.has(s)) {
            weighted.set(s, 0.55);
          }
        });
      }
    });
    return { base: base, weighted: weighted };
  }

  function cite(label, url) {
    return { label: label, url: url };
  }

  function dedupeCitations(list) {
    const seen = new Set();
    const out = [];
    (list || []).forEach(function (item) {
      if (!item || !item.label) return;
      const key = item.label + "|" + (item.url || "");
      if (!seen.has(key)) {
        seen.add(key);
        out.push(item);
      }
    });
    return out;
  }

  function mdLink(label, url) {
    return (
      '<a class="chat-inline-link" href="' +
      escapeHtml(url) +
      '" target="_blank" rel="noopener noreferrer">' +
      escapeHtml(label) +
      "</a>"
    );
  }

  function formatRepoBullet(repo) {
    const langPart = repo.language ? " (" + escapeHtml(repo.language) + ")" : "";
    const starPart = repo.stars > 0 ? " &middot; &#9733; " + escapeHtml(repo.stars) : "";
    const demoPart = repo.demo ? " &middot; " + mdLink("Live Demo", repo.demo) : "";
    const desc = repo.summary
      ? ": " + escapeHtml(repo.summary)
      : ": Public repository on GitHub (last updated " + escapeHtml(repo.pushed_at || "recently") + ").";
    return (
      "<li>" +
      "<strong>" + mdLink(repo.title || repo.name, repo.url) + "</strong>" +
      '<span class="chat-repo-meta">' + langPart + starPart + demoPart + "</span>" +
      desc +
      "</li>"
    );
  }

  function scoreRepos(knowledge, queryInfo) {
    const repos = knowledge.repos || [];
    const scored = [];
    const baseSet = new Set(queryInfo.base);

    repos.forEach(function (repo) {
      const nameTokens = new Set(tokenize(repo.name));
      const langTokens = new Set(tokenize(repo.language));
      const tagTokens = new Set(tokenize((repo.tags || []).join(" ")));
      const summaryTokens = new Set(tokenize(repo.summary || ""));

      let score = 0;
      let directHit = false;

      queryInfo.weighted.forEach(function (weight, tok) {
        const isBase = baseSet.has(tok);
        if (nameTokens.has(tok)) {
          score += 5.0 * weight;
          if (isBase) directHit = true;
        }
        if (tagTokens.has(tok)) {
          score += 3.5 * weight;
          if (isBase) directHit = true;
        }
        if (langTokens.has(tok)) {
          score += 3.2 * weight;
          if (isBase) directHit = true;
        }
        if (summaryTokens.has(tok)) {
          score += 2.0 * weight;
          if (isBase) directHit = true;
        }
      });

      if (score > 0 && directHit) {
        if (repo.pinned) score += 1.25;
        if (repo.flagship) score += 0.9;
        score += Math.min(repo.stars || 0, 5) * 0.2;
        scored.push({ repo: repo, score: score });
      }
    });

    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return (b.repo.stars || 0) - (a.repo.stars || 0);
    });
    return scored;
  }

  function findExactRepoMention(knowledge, question) {
    const qLower = question.toLowerCase();
    const repos = knowledge.repos || [];
    let best = null;
    repos.forEach(function (repo) {
      const nameLower = repo.name.toLowerCase();
      if (nameLower.length < 3 || nameLower === "sandeepkv93") return;
      const escaped = nameLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp("(^|[^a-z0-9_-])" + escaped + "([^a-z0-9_-]|$)", "i");
      if (re.test(qLower)) {
        if (!best || nameLower.length > best.name.length) {
          best = repo;
        }
      }
    });
    return best;
  }

  function detectQueriedTechNotFound(knowledge, question) {
    const qLower = question.toLowerCase();
    const allCorpus = [
      JSON.stringify(knowledge.profile || {}),
      JSON.stringify(knowledge.html_sections || {}),
      (knowledge.repos || [])
        .map(function (r) {
          return [r.name, r.language, r.summary, (r.tags || []).join(" ")].join(" ");
        })
        .join(" ")
    ]
      .join(" ")
      .toLowerCase();

    const mentioned = [];
    KNOWN_TECH_LIST.forEach(function (tech) {
      const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp("(^|[^a-z0-9+#])" + escaped + "([^a-z0-9+#]|$)", "i");
      if (re.test(qLower)) {
        mentioned.push(tech);
      }
    });

    if (!mentioned.length) return null;

    const missing = mentioned.filter(function (tech) {
      const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp("(^|[^a-z0-9+#])" + escaped + "([^a-z0-9+#]|$)", "i");
      return !re.test(allCorpus);
    });

    if (missing.length === mentioned.length) {
      return missing;
    }
    return null;
  }

  function buildScopeRefusal(knowledge, reason) {
    const links = (knowledge.profile && knowledge.profile.links) || {};
    const linkedinUrl = links.linkedin || "https://www.linkedin.com/in/sandeepkv93";
    const githubUrl = links.github || "https://github.com/sandeepkv93";
    const lead =
      reason === "private"
        ? "I can only answer questions grounded in Sandeep's public portfolio page, public GitHub repositories, and curated LinkedIn profile. Private or personal details (such as contact info, compensation, or immigration status) are out of scope."
        : "I am strictly scoped to answering questions about Sandeep Vishnu using only his portfolio HTML, auto-synced public GitHub repositories, and curated LinkedIn profile.";

    return {
      html:
        "<p>" +
        escapeHtml(lead) +
        "</p>" +
        "<p>Try asking about his work at Snowflake, Microsoft Azure, or VMware, his US Patent (US12056521B2), IEEE publication, live demos, or specific technologies across his public GitHub repos. For anything else, you can reach him via " +
        mdLink("LinkedIn", linkedinUrl) +
        ".</p>",
      citations: [
        cite("Portfolio Scope", "#overview"),
        cite("GitHub", githubUrl),
        cite("LinkedIn", linkedinUrl)
      ],
      inScope: false
    };
  }

  function answerQuestion(question, knowledge) {
    const trimmed = String(question || "").trim();
    const profile = knowledge.profile || {};
    const metrics = knowledge.metrics || {};
    const links = profile.links || {
      portfolio: "https://sandeepkv93.github.io/",
      github: "https://github.com/sandeepkv93",
      linkedin: "https://www.linkedin.com/in/sandeepkv93",
      medium: "https://medium.com/@sandeepkv93",
      patent: "https://patents.google.com/patent/US12056521B2/en",
      publication: "https://dblp.org/rec/conf/latice/SandeepASK16",
      repo_index: "https://sandeepkv93.github.io/repo-index/"
    };

    if (!trimmed) {
      return buildScopeRefusal(knowledge, "offtopic");
    }

    if (PROMPT_INJECTION_RE.test(trimmed)) {
      return buildScopeRefusal(knowledge, "offtopic");
    }

    if (PRIVATE_OR_SENSITIVE_RE.test(trimmed)) {
      return buildScopeRefusal(knowledge, "private");
    }

    if (/^(hi|hello|hey|yo|greetings|good\s+(morning|afternoon|evening))[\s!?.]*$/i.test(trimmed)) {
      const repoCount = (knowledge.repos || []).length || metrics.public_repos || 83;
      return {
        html:
          "<p>Hi! I answer questions strictly from Sandeep's portfolio page, " +
          escapeHtml(repoCount) +
          " auto-synced public GitHub repositories, and curated LinkedIn career profile.</p>" +
          "<p>Ask me about his current role at <strong>Snowflake</strong>, his <strong>Azure Spot VM patent</strong>, <strong>Kubernetes &amp; OpenTelemetry</strong> builds, <strong>distributed systems</strong> projects, or his live demos.</p>",
        citations: [
          cite("Portfolio HTML", "#overview"),
          cite("GitHub (" + repoCount + " repos)", links.github),
          cite("LinkedIn (curated)", links.linkedin)
        ],
        inScope: true
      };
    }

    if (GENERAL_OFFTOPIC_RE.test(trimmed)) {
      return buildScopeRefusal(knowledge, "offtopic");
    }

    const qLower = trimmed.toLowerCase();

    // 1. Exact repository lookup
    const exactRepo = findExactRepoMention(knowledge, trimmed);
    if (exactRepo) {
      const citations = [cite("GitHub · " + exactRepo.name, exactRepo.url)];
      if (exactRepo.demo) citations.push(cite("Live Demo", exactRepo.demo));
      const tagsLine =
        exactRepo.tags && exactRepo.tags.length
          ? "<p><strong>Topics &amp; stack:</strong> " + escapeHtml(exactRepo.tags.join(", ")) + ".</p>"
          : "";
      const metaBits = [];
      if (exactRepo.language) metaBits.push("Primary language: " + exactRepo.language);
      if (exactRepo.stars > 0) metaBits.push(exactRepo.stars + " stars");
      if (exactRepo.pinned) metaBits.push("Pinned on GitHub");
      if (exactRepo.pushed_at) metaBits.push("Last updated " + exactRepo.pushed_at);

      return {
        html:
          "<p><strong>" +
          mdLink(exactRepo.title || exactRepo.name, exactRepo.url) +
          "</strong>" +
          (exactRepo.demo ? " (" + mdLink("Live Demo", exactRepo.demo) + ")" : "") +
          ": " +
          escapeHtml(
            exactRepo.summary ||
              "Public repository owned by Sandeep on GitHub."
          ) +
          "</p>" +
          (metaBits.length ? "<p>" + escapeHtml(metaBits.join(" | ")) + ".</p>" : "") +
          tagsLine,
        citations: dedupeCitations(citations),
        inScope: true
      };
    }

    // 2. Patent & Publication
    if (/\b(patent|us12056521b2|publication|paper|ieee|latice|dsadvisor|published|research)\b/i.test(qLower)) {
      const pat = profile.patent || {};
      const pub = profile.publication || {};
      const wantPatent = /\b(patent|us12056521b2|spot|replenish|azure)\b/i.test(qLower);
      const wantPub = /\b(publication|paper|ieee|latice|dsadvisor|published)\b/i.test(qLower);
      const blocks = [];
      const citations = [];

      if (wantPatent || !wantPub) {
        blocks.push(
          "<p><strong>US Patent " +
            mdLink(pat.number || "US12056521B2", pat.url || links.patent) +
            ":</strong> <em>" +
            escapeHtml(pat.title || "Machine-learning-based replenishment of interruptible workloads in cloud environment") +
            "</em> (" +
            escapeHtml(pat.assignee_context || "Microsoft Azure Spot VMs") +
            "). " +
            escapeHtml(pat.impact || "") +
            "</p>"
        );
        citations.push(cite("Patent · " + (pat.number || "US12056521B2"), pat.url || links.patent));
      }

      if (wantPub || !wantPatent) {
        blocks.push(
          "<p><strong>IEEE Publication:</strong> " +
            mdLink(pub.title || "DSAdvisor: Facilitating Deeper Inquiry in the Data Structures Course", pub.url || links.publication) +
            " (" +
            escapeHtml(pub.venue || "IEEE LaTiCE 2016") +
            ").</p>"
        );
        citations.push(cite("IEEE LaTiCE 2016", pub.url || links.publication));
      }

      citations.push(cite("Portfolio · Credentials", "#experience"));
      return {
        html: blocks.join(""),
        citations: dedupeCitations(citations),
        inScope: true
      };
    }

    // 3. Company-specific experience (Snowflake, Microsoft Azure, VMware)
    const expList = profile.experience || [];
    const matchedCompanies = [];
    if (/\b(snowflake|sis|streamlit\s+in\s+snowflake|spcs|snowpark|current\s+(role|job|company|work)|currently\s+work|where\s+does\s+.*work)\b/i.test(qLower)) {
      const item = expList.find(function (e) {
        return /snowflake/i.test(e.company);
      });
      if (item) matchedCompanies.push(item);
    }
    if (/\b(microsoft|azure|spot\s+vm|spot\s+vms|replenishment|partner\s+solutions|datadog|nginx|elastic|confluent|resource\s+provider)\b/i.test(qLower)) {
      const item = expList.find(function (e) {
        return /microsoft|azure/i.test(e.company);
      });
      if (item) matchedCompanies.push(item);
    }
    if (/\b(vmware|digital\s+fuel|vrealize)\b/i.test(qLower)) {
      const item = expList.find(function (e) {
        return /vmware/i.test(e.company);
      });
      if (item) matchedCompanies.push(item);
    }

    if (matchedCompanies.length) {
      const citations = [
        cite("Portfolio · Experience", "#experience"),
        cite("LinkedIn (curated)", links.linkedin)
      ];
      const htmlParts = matchedCompanies.map(function (item) {
        if (/microsoft|azure/i.test(item.company)) {
          citations.push(cite("Patent · US12056521B2", links.patent));
        }
        return (
          "<p><strong>" +
          escapeHtml(item.company) +
          "</strong> (" +
          escapeHtml(item.period) +
          ") | " +
          escapeHtml(item.role) +
          "</p><ul>" +
          (item.highlights || [])
            .map(function (h) {
              return "<li>" + escapeHtml(h) + "</li>";
            })
            .join("") +
          "</ul>"
        );
      });

      return {
        html: htmlParts.join(""),
        citations: dedupeCitations(citations),
        inScope: true
      };
    }

    // 4. Education
    if (/\b(education|degree|degrees|university|college|school|stony\s+brook|sbu|pes\s+university|masters|bachelors|grad|study|studied)\b/i.test(qLower)) {
      const eduList = profile.education || [];
      return {
        html:
          "<p>Sandeep's academic background:</p><ul>" +
          eduList
            .map(function (ed) {
              return (
                "<li><strong>" +
                escapeHtml(ed.degree) +
                "</strong>, " +
                escapeHtml(ed.school) +
                (ed.notes ? ": " + escapeHtml(ed.notes) : "") +
                "</li>"
              );
            })
            .join("") +
          "</ul>",
        citations: [
          cite("Portfolio · Education", "#experience"),
          cite("LinkedIn (curated)", links.linkedin)
        ],
        inScope: true
      };
    }

    // 5. Live Demos
    if (/\b(live\s+demo|live\s+demos|demos|interactive|visualizer|deployed|websites)\b/i.test(qLower)) {
      const demoRepos = (knowledge.repos || []).filter(function (r) {
        return Boolean(r.demo);
      });
      const citations = demoRepos.slice(0, 4).map(function (r) {
        return cite("Live Demo · " + r.name, r.demo);
      });
      citations.push(cite("Repo Catalog", links.repo_index));
      return {
        html:
          "<p>Sandeep has <strong>" +
          escapeHtml(demoRepos.length) +
          " public projects with live hosted sites/demos</strong>:</p><ul>" +
          demoRepos.slice(0, 6).map(formatRepoBullet).join("") +
          "</ul>",
        citations: dedupeCitations(citations),
        inScope: true
      };
    }

    // 6. Live GitHub Telemetry / Stats / Languages
    if (/\b(stats|statistics|metrics|telemetry|contributions|commits|how\s+many\s+(repos|repositories|stars|prs|pull\s+requests|followers)|top\s+languages|most\s+used\s+language|language\s+breakdown)\b/i.test(qLower)) {
      const langs = (knowledge.top_langs || [])
        .map(function (l) {
          return "<strong>" + escapeHtml(l.name) + "</strong> (" + l.pct.toFixed(1) + "%, " + escapeHtml(l.count) + " repos)";
        })
        .join(", ");
      const updated = (knowledge.meta && knowledge.meta.updated_date) || "recently";
      return {
        html:
          "<p>Live GitHub telemetry (auto-synced " +
          escapeHtml(updated) +
          "):</p><ul>" +
          "<li><strong>Contributions (past 12 months):</strong> " + escapeHtml(metrics.contributions_yr) + " (" + escapeHtml(metrics.commits_yr) + " commits)</li>" +
          "<li><strong>Owned public repositories:</strong> " + escapeHtml(metrics.public_repos) + " (excluding forks)</li>" +
          "<li><strong>Pull requests:</strong> " + escapeHtml(metrics.pull_requests) + " | <strong>Stars earned:</strong> " + escapeHtml(metrics.total_stars) + " | <strong>Followers:</strong> " + escapeHtml(metrics.followers) + "</li>" +
          "<li><strong>Top languages across owned public repos:</strong> " + langs + "</li>" +
          "</ul>",
        citations: [
          cite("Live GitHub Telemetry", "#telemetry"),
          cite("GitHub Profile", links.github)
        ],
        inScope: true
      };
    }

    // 7. Pinned / Flagship projects
    if (/\b(pinned|flagship|featured|best\s+projects|top\s+projects|notable\s+projects|showcase)\b/i.test(qLower)) {
      const wantPinned = /\bpinned\b/i.test(qLower);
      const list = (knowledge.repos || []).filter(function (r) {
        return wantPinned ? r.pinned : r.flagship;
      });
      const shown = list.slice(0, 6);
      const citations = shown.slice(0, 3).map(function (r) {
        return cite("GitHub · " + r.name, r.url);
      });
      citations.push(cite("Portfolio · Projects", "#projects"));
      return {
        html:
          "<p>" +
          (wantPinned
            ? "Sandeep's <strong>6 pinned GitHub repositories</strong>:"
            : "Highlights from Sandeep's <strong>" + escapeHtml(list.length) + " flagship projects</strong>:") +
          "</p><ul>" +
          shown.map(formatRepoBullet).join("") +
          "</ul><p>Browse all " +
          escapeHtml((knowledge.repos || []).length) +
          " public repositories in the " +
          mdLink("categorized Repo Catalog", links.repo_index) +
          ".</p>",
        citations: dedupeCitations(citations),
        inScope: true
      };
    }

    // 8. Check if user explicitly asked about a technology NOT in any source
    const missingTechs = detectQueriedTechNotFound(knowledge, trimmed);
    if (missingTechs && missingTechs.length) {
      const formattedMissing = missingTechs.join(", ");
      return {
        html:
          "<p><strong>" +
          escapeHtml(formattedMissing) +
          "</strong> does not appear in Sandeep's public portfolio, auto-synced GitHub repositories, or curated LinkedIn profile.</p>" +
          "<p>His documented core stack centers on <strong>Go, Python, Java, TypeScript, C</strong>, <strong>Kubernetes, Snowpark Container Services, Docker, Bazel</strong>, and <strong>OpenTelemetry, Prometheus, Grafana, PostgreSQL, DuckDB, Redis, RabbitMQ</strong>.</p>",
        citations: [
          cite("Portfolio · Core Stack", "#stack"),
          cite("GitHub Profile", links.github),
          cite("LinkedIn (curated)", links.linkedin)
        ],
        inScope: true
      };
    }

    // 9. Career / Bio / Experience / Location / Links / Skills overview
    if (/\b(who\s+is|about\s+sandeep|bio|summary|background|career|experience|work\s+history|resume|cv|years\s+of\s+experience|location|where\s+is\s+.*based|seattle)\b/i.test(qLower)) {
      return {
        html:
          "<p><strong>Sandeep Vishnu</strong> is a Senior Software Engineer at <strong>Snowflake</strong> (Streamlit in Snowflake, Greater Seattle Area) with <strong>" +
          escapeHtml(metrics.years_exp || "10+ yrs") +
          "</strong> of industry experience building cloud-native platforms and distributed systems.</p>" +
          "<ul>" +
          expList
            .map(function (e) {
              return (
                "<li><strong>" +
                escapeHtml(e.company) +
                "</strong> (" +
                escapeHtml(e.period) +
                "): " +
                escapeHtml(e.role) +
                "</li>"
              );
            })
            .join("") +
          "</ul>" +
          "<p>He holds an <strong>M.S. in Computer Science</strong> from Stony Brook University, US Patent " +
          mdLink("US12056521B2", links.patent) +
          ", and an IEEE LaTiCE 2016 publication (" +
          mdLink("DSAdvisor", links.publication) +
          ").</p>",
        citations: [
          cite("Portfolio · Overview", "#overview"),
          cite("Portfolio · Experience", "#experience"),
          cite("LinkedIn (curated)", links.linkedin)
        ],
        inScope: true
      };
    }

    if (/\b(core\s+stack|tech\s+stack|skills|technologies|tools|languages\s+does\s+.*know)\b/i.test(qLower)) {
      return {
        html:
          "<p>Sandeep's documented engineering toolkit:</p><ul>" +
          "<li><strong>Languages:</strong> Go, Python, Java, TypeScript, C</li>" +
          "<li><strong>Cloud &amp; Runtimes:</strong> Kubernetes &amp; Operators, Snowpark Container Services, Docker, Linux, Bazel, Azure, AWS</li>" +
          "<li><strong>Observability &amp; Data:</strong> OpenTelemetry, Prometheus, Grafana, PostgreSQL, DuckDB, Redis, RabbitMQ</li>" +
          "<li><strong>Systems &amp; Security:</strong> Consensus &amp; Sagas, gRPC / ConnectRPC, OAuth 2.0 &amp; OIDC, Retry &amp; Load Simulation, Streamlit, React</li>" +
          "</ul>",
        citations: [
          cite("Portfolio · Core Stack", "#stack"),
          cite("LinkedIn (curated)", links.linkedin)
        ],
        inScope: true
      };
    }

    if (/\b(links|social|linkedin|medium|github|blog|articles|writing|catalog|repo-index)\b/i.test(qLower)) {
      return {
        html:
          "<p>Verified public links for Sandeep Vishnu:</p><ul>" +
          "<li>" + mdLink("GitHub (@sandeepkv93)", links.github) + "</li>" +
          "<li>" + mdLink("LinkedIn", links.linkedin) + "</li>" +
          "<li>" + mdLink("Medium", links.medium) + "</li>" +
          "<li>" + mdLink("US Patent US12056521B2", links.patent) + "</li>" +
          "<li>" + mdLink("IEEE LaTiCE Publication (DSAdvisor)", links.publication) + "</li>" +
          "<li>" + mdLink("Full Categorized Repo Catalog", links.repo_index) + "</li>" +
          "</ul>",
        citations: [
          cite("Portfolio · Links", "#overview"),
          cite("GitHub", links.github),
          cite("LinkedIn", links.linkedin)
        ],
        inScope: true
      };
    }

    // 10. Hybrid BM25-style retrieval across ALL public GitHub repos + profile focus areas
    const queryInfo = expandQueryTokens(trimmed);
    const repoMatches = scoreRepos(knowledge, queryInfo);

    if (repoMatches.length && repoMatches[0].score >= 2.0) {
      const topRepos = repoMatches.slice(0, 5).map(function (m) {
        return m.repo;
      });
      const citations = topRepos.slice(0, 3).map(function (r) {
        return cite("GitHub · " + r.name, r.url);
      });
      if (repoMatches.length > 5) {
        citations.push(cite("All " + (knowledge.repos || []).length + " Repos", links.repo_index));
      }

      // Check if any career experience also strongly matches the topic
      const matchingRoles = expList.filter(function (exp) {
        const expText = [exp.company, exp.role, (exp.highlights || []).join(" "), (exp.skills || []).join(" ")]
          .join(" ")
          .toLowerCase();
        return queryInfo.base.some(function (tok) {
          return tok.length >= 2 && expText.indexOf(tok) !== -1;
        });
      });

      let roleNote = "";
      if (matchingRoles.length) {
        const roleSummary = matchingRoles
          .map(function (r) {
            return "<strong>" + escapeHtml(r.company) + "</strong> (" + escapeHtml(r.role) + ")";
          })
          .join(" and ");
        roleNote = "<p>In his industry work, this also connects to his role at " + roleSummary + ".</p>";
        citations.push(cite("LinkedIn (curated)", links.linkedin));
      }

      return {
        html:
          "<p>Found <strong>" +
          escapeHtml(repoMatches.length) +
          "</strong> matching public " +
          (repoMatches.length === 1 ? "repository" : "repositories") +
          " on GitHub" +
          (repoMatches.length > 5 ? " (showing top 5)" : "") +
          ":</p><ul>" +
          topRepos.map(formatRepoBullet).join("") +
          "</ul>" +
          roleNote,
        citations: dedupeCitations(citations),
        inScope: true
      };
    }

    // 11. Focus-area / experience text fallback if query overlaps LinkedIn/HTML sections
    const focusMatches = (profile.focus_areas || []).filter(function (area) {
      const lower = area.toLowerCase();
      return queryInfo.base.some(function (tok) {
        return tok.length >= 3 && lower.indexOf(tok) !== -1;
      });
    });
    if (focusMatches.length) {
      return {
        html:
          "<p>From Sandeep's documented engineering focus areas:</p><ul>" +
          focusMatches
            .map(function (f) {
              return "<li>" + escapeHtml(f) + "</li>";
            })
            .join("") +
          "</ul>",
        citations: [
          cite("Portfolio HTML", "#overview"),
          cite("LinkedIn (curated)", links.linkedin)
        ],
        inScope: true
      };
    }

    // 12. Strict fallback refusal when nothing in the knowledge base matches
    return buildScopeRefusal(knowledge, "offtopic");
  }

  function initChatUI() {
    const messagesEl = document.getElementById("chat-messages");
    const form = document.getElementById("chat-form");
    const input = document.getElementById("chat-input");
    const clearBtn = document.getElementById("chat-clear");
    const metaEl = document.getElementById("chat-kb-meta");
    if (!messagesEl || !form || !input) return;

    let knowledge = null;
    let isBusy = false;

    function scrollMessages() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function appendWelcome() {
      messagesEl.innerHTML = "";
      const repoCount = (knowledge && knowledge.meta && knowledge.meta.public_repo_count) || 83;
      const synced = (knowledge && knowledge.meta && knowledge.meta.updated_date) || "daily";
      appendAssistantMessage({
        html:
          "<p>Ask me anything about Sandeep's background, engineering experience, patent, skills, or projects.</p>" +
          "<p>Every answer is strictly grounded in this <strong>portfolio page</strong>, <strong>" +
          escapeHtml(repoCount) +
          " public GitHub repositories</strong> (synced " +
          escapeHtml(synced) +
          "), and his <strong>curated LinkedIn profile</strong> with clickable citations.</p>",
        citations: [
          cite("Portfolio HTML", "#overview"),
          cite("GitHub (" + repoCount + " repos)", "https://github.com/sandeepkv93"),
          cite("LinkedIn (curated)", "https://www.linkedin.com/in/sandeepkv93")
        ]
      });
    }

    function appendUserMessage(text) {
      const row = document.createElement("div");
      row.className = "chat-msg chat-msg-user";
      row.innerHTML = '<div class="chat-bubble chat-bubble-user">' + escapeHtml(text) + "</div>";
      messagesEl.appendChild(row);
      scrollMessages();
    }

    function appendTyping() {
      const row = document.createElement("div");
      row.className = "chat-msg chat-msg-assistant";
      row.id = "chat-typing-row";
      row.innerHTML =
        '<span class="chat-avatar" aria-hidden="true">SV</span>' +
        '<div class="chat-bubble chat-bubble-assistant chat-typing" aria-label="Searching knowledge base">' +
        "<span></span><span></span><span></span>" +
        "</div>";
      messagesEl.appendChild(row);
      scrollMessages();
      return row;
    }

    function appendAssistantMessage(result) {
      const row = document.createElement("div");
      row.className = "chat-msg chat-msg-assistant";

      const citationsHtml =
        result.citations && result.citations.length
          ? '<div class="chat-citations" aria-label="Sources">' +
            '<span class="chat-cite-label">Sources:</span>' +
            result.citations
              .map(function (c) {
                const isExternal = /^https?:\/\//.test(c.url || "");
                const targetAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
                return (
                  '<a class="chat-cite-chip" href="' +
                  escapeHtml(c.url || "#overview") +
                  '"' +
                  targetAttr +
                  ">" +
                  escapeHtml(c.label) +
                  "</a>"
                );
              })
              .join("") +
            "</div>"
          : "";

      row.innerHTML =
        '<span class="chat-avatar" aria-hidden="true">SV</span>' +
        '<div class="chat-bubble chat-bubble-assistant">' +
        '<div class="chat-answer-body">' +
        result.html +
        "</div>" +
        citationsHtml +
        "</div>";

      messagesEl.appendChild(row);
      scrollMessages();
    }

    function handleQuestion(rawText) {
      const text = String(rawText || "").trim();
      if (!text || isBusy) return;
      isBusy = true;

      appendUserMessage(text);
      const typingRow = appendTyping();

      window.setTimeout(function () {
        if (typingRow && typingRow.parentNode) {
          typingRow.parentNode.removeChild(typingRow);
        }
        const answer = answerQuestion(text, knowledge || {});
        appendAssistantMessage(answer);
        isBusy = false;
      }, 220);
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const val = input.value.trim();
      if (!val) return;
      input.value = "";
      input.style.height = "auto";
      handleQuestion(val);
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    });

    input.addEventListener("input", function () {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 120) + "px";
    });

    document.querySelectorAll(".chat-starter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const prompt = btn.getAttribute("data-prompt");
        if (prompt) handleQuestion(prompt);
      });
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        appendWelcome();
        input.focus();
      });
    }

    fetch("./data/knowledge.json", { cache: "no-cache" })
      .then(function (resp) {
        return resp.ok ? resp.json() : null;
      })
      .then(function (data) {
        if (data) {
          knowledge = data;
          if (metaEl && data.meta) {
            metaEl.textContent =
              "Indexed " +
              data.meta.public_repo_count +
              " GitHub repos + Portfolio + LinkedIn (synced " +
              data.meta.updated_date +
              ")";
          }
        }
      })
      .catch(function () {
        knowledge = null;
      })
      .finally(function () {
        appendWelcome();
      });
  }

  const exported = {
    answerQuestion: answerQuestion,
    tokenize: tokenize
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  } else {
    globalScope.SandeepChatEngine = exported;
    document.addEventListener("DOMContentLoaded", initChatUI);
  }
})(typeof window !== "undefined" ? window : globalThis);
