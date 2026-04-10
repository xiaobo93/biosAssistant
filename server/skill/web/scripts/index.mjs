/** 导出与内置 fs 工具相同结构：{ tool, handle }[] */

function clampInt(n, min, max, fallback) {
  if (!Number.isFinite(n)) return fallback;
  const x = Math.trunc(n);
  return Math.min(max, Math.max(min, x));
}

function decodeHtmlEntities(s) {
  if (!s) return "";
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => {
      const code = Number(d);
      if (!Number.isFinite(code)) return _;
      try {
        return String.fromCodePoint(code);
      } catch {
        return _;
      }
    });
}

function stripHtmlToText(html) {
  if (!html) return "";
  let s = String(html);
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<!--([\s\S]*?)-->/g, " ");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|li|tr|h1|h2|h3|h4|h5|h6)\s*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeHtmlEntities(s);
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]{2,}/g, " ");
  return s.trim();
}

function isPrivateIpV4(host) {
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const a = m.slice(1, 5).map((x) => Number(x));
  if (a.some((x) => !Number.isFinite(x) || x < 0 || x > 255)) return false;
  const [o1, o2] = a;
  if (o1 === 127) return true;
  if (o1 === 10) return true;
  if (o1 === 0) return true;
  if (o1 === 169 && o2 === 254) return true;
  if (o1 === 192 && o2 === 168) return true;
  if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
  return false;
}

function isPrivateOrLocalHost(hostname) {
  const h = (hostname || "").trim().toLowerCase();
  if (!h) return true;
  if (h === "localhost") return true;
  if (h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0") return true;
  if (h === "::1") return true;
  if (h.startsWith("[")) {
    // IPv6 literal like [::1]
    const inside = h.replace(/^\[/, "").replace(/\]$/, "");
    if (inside === "::1") return true;
    if (inside.startsWith("fe80:")) return true; // link-local
    if (inside.startsWith("fc") || inside.startsWith("fd")) return true; // unique local fc00::/7
  }
  if (isPrivateIpV4(h)) return true;
  return false;
}

function assertHttpUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error("url 不是合法 URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("仅支持 http/https URL");
  }
  if (isPrivateOrLocalHost(u.hostname)) {
    throw new Error("出于安全考虑，拒绝访问 localhost/私网地址");
  }
  return u;
}

function withTimeout(timeoutMs) {
  const controller = new AbortController();
  const ms = clampInt(timeoutMs, 1000, 120000, 15000);
  const t = setTimeout(() => controller.abort(new Error("timeout")), ms);
  return { controller, ms, cleanup: () => clearTimeout(t) };
}

async function readResponseTextLimited(resp, maxBytes) {
  const limit = clampInt(maxBytes, 1024, 2_000_000, 600_000);
  const reader = resp.body?.getReader?.();
  if (!reader) {
    // fallback: no stream
    const text = await resp.text();
    const truncated = Buffer.byteLength(text, "utf8") > limit;
    return {
      bytesRead: Math.min(Buffer.byteLength(text, "utf8"), limit),
      truncated,
      text: truncated ? text.slice(0, Math.max(0, Math.floor(limit / 2))) : text,
    };
  }

  const chunks = [];
  let total = 0;
  let truncated = false;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    const buf = Buffer.from(value);
    if (total + buf.length > limit) {
      const remain = Math.max(0, limit - total);
      if (remain > 0) chunks.push(buf.slice(0, remain));
      total = limit;
      truncated = true;
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      break;
    }
    chunks.push(buf);
    total += buf.length;
  }
  const text = Buffer.concat(chunks, total).toString("utf8");
  return { bytesRead: total, truncated, text };
}

function pickFirstMatch(s, re) {
  const m = String(s || "").match(re);
  return m ? (m[1] ?? "") : "";
}

function normalizeDdqRedirect(url) {
  // DuckDuckGo HTML results sometimes use /l/?uddg=<encoded>
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("duckduckgo.com") && u.pathname === "/l/") {
      const uddg = u.searchParams.get("uddg");
      if (uddg) return decodeURIComponent(uddg);
    }
  } catch {
    // ignore
  }
  return url;
}

async function webSearchHandle(args) {
  const a = (args ?? {}) || {};
  const query = typeof a.query === "string" ? a.query.trim() : "";
  if (!query) throw new Error("webSearch 需要非空 query");
  const maxResults = clampInt(a.maxResults, 1, 20, 8);
  const safeSearch =
    a.safeSearch === "off" || a.safeSearch === "moderate" || a.safeSearch === "strict"
      ? a.safeSearch
      : "moderate";

  const safeMap = { off: "-1", moderate: "1", strict: "2" };
  const url = new URL("https://duckduckgo.com/html/");
  url.searchParams.set("q", query);
  url.searchParams.set("kp", safeMap[safeSearch]);

  const { controller, cleanup } = withTimeout(a.timeoutMs);
  try {
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "biosAssistant/0.1 (+https://example.invalid; webSearch) node-fetch-compatible",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.7",
      },
    });
    const { text: html, truncated } = await readResponseTextLimited(resp, a.maxBytes);
    if (!resp.ok) {
      return {
        query,
        source: "duckduckgo",
        status: resp.status,
        error: `DuckDuckGo 返回 HTTP ${resp.status}`,
        results: [],
        truncated: Boolean(truncated),
      };
    }

    // Result blocks are somewhat stable: <a class="result__a" href="...">Title</a>
    const results = [];
    const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) && results.length < maxResults) {
      const rawUrl = decodeHtmlEntities(m[1] || "");
      const titleHtml = m[2] || "";
      const title = stripHtmlToText(titleHtml);
      if (!rawUrl || !title) continue;
      const u = normalizeDdqRedirect(rawUrl);
      let absUrl = u;
      try {
        // ddg might return relative links; normalize
        absUrl = new URL(u, "https://duckduckgo.com").toString();
      } catch {
        // ignore
      }

      // Try to locate a snippet near the anchor
      const start = Math.max(0, m.index);
      const windowHtml = html.slice(start, Math.min(html.length, start + 2000));
      const snippetHtml =
        pickFirstMatch(windowHtml, /<a[\s\S]*?<\/a>[\s\S]*?<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
        pickFirstMatch(windowHtml, /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
        pickFirstMatch(windowHtml, /<span[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      const snippet = snippetHtml ? stripHtmlToText(snippetHtml) : "";

      results.push({ title, url: absUrl, snippet: snippet || undefined });
    }

    return {
      query,
      source: "duckduckgo",
      safeSearch,
      results,
      truncated: Boolean(truncated),
    };
  } finally {
    cleanup();
  }
}

async function webFetchHandle(args) {
  const a = (args ?? {}) || {};
  const url = typeof a.url === "string" ? a.url.trim() : "";
  if (!url) throw new Error("webFetch 需要非空 url");
  const u = assertHttpUrl(url);

  const { controller, cleanup, ms } = withTimeout(a.timeoutMs);
  try {
    const resp = await fetch(u, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "biosAssistant/0.1 (+https://example.invalid; webFetch) node-fetch-compatible",
        accept:
          "text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.1",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.7",
      },
    });

    const contentType = (resp.headers.get("content-type") || "").toLowerCase();
    const finalUrl = resp.url || u.toString();

    const { bytesRead, truncated, text: raw } = await readResponseTextLimited(resp, a.maxBytes);
    if (!resp.ok) {
      return {
        url: u.toString(),
        finalUrl,
        status: resp.status,
        ok: false,
        contentType,
        timeoutMs: ms,
        bytesRead,
        truncated,
        error: `HTTP ${resp.status}`,
        text: stripHtmlToText(raw).slice(0, 2000),
      };
    }

    const isHtml = contentType.includes("text/html") || raw.trim().startsWith("<!doctype html") || raw.includes("<html");
    const title = isHtml
      ? stripHtmlToText(pickFirstMatch(raw, /<title[^>]*>([\s\S]*?)<\/title>/i))
      : "";
    const text = isHtml ? stripHtmlToText(raw) : (a.textOnly === false ? raw : stripHtmlToText(raw));

    return {
      url: u.toString(),
      finalUrl,
      status: resp.status,
      ok: true,
      contentType,
      timeoutMs: ms,
      title: title || undefined,
      bytesRead,
      truncated,
      text,
    };
  } finally {
    cleanup();
  }
}

export const tools = [
  {
    tool: {
      type: "function",
      function: {
        name: "webSearch",
        description:
          "使用 DuckDuckGo 搜索网页，返回若干条结果（title/url/snippet）。HTTP-only，可能受反爬影响。",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["query"],
          properties: {
            query: { type: "string", description: "搜索关键词（必填）" },
            maxResults: { type: "integer", description: "返回结果数，默认 8（1-20）" },
            safeSearch: {
              type: "string",
              enum: ["off", "moderate", "strict"],
              description: "安全搜索级别，默认 moderate",
            },
            timeoutMs: { type: "integer", description: "请求超时毫秒数，默认 15000" },
            maxBytes: { type: "integer", description: "最大读取字节数，默认 600000（上限 2000000）" },
          },
        },
      },
    },
    handle: webSearchHandle,
  },
  {
    tool: {
      type: "function",
      function: {
        name: "webFetch",
        description:
          "抓取指定 URL 的页面内容并转为纯文本（支持 title/finalUrl/截断信息）。默认拒绝 localhost/私网地址。",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["url"],
          properties: {
            url: { type: "string", description: "要抓取的 http/https URL（必填）" },
            timeoutMs: { type: "integer", description: "请求超时毫秒数，默认 15000" },
            maxBytes: { type: "integer", description: "最大读取字节数，默认 600000（上限 2000000）" },
            textOnly: {
              type: "boolean",
              description:
                "是否强制输出纯文本；默认 true。若为 false 且非 HTML 响应，将尽量返回原始文本。",
            },
          },
        },
      },
    },
    handle: webFetchHandle,
  },
];

