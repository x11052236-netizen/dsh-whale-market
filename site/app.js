(function () {
  "use strict";

  const FALLBACK_CATEGORIES = {
    personal: "我的", market: "市场与管理", memory: "记忆", session: "会话", ui: "界面", tools: "工具",
    fun: "娱乐", dev: "开发与运行时", model: "模型与接入", notify: "通知与集成", remote: "远程与移动",
    theme: "主题与外观", usage: "用量与计费", browser: "浏览器与网页", vision: "视觉与多模态",
    voice: "语音与音频", git: "Git 与评审", workflow: "工作流与自动化", skill: "技能包", docs: "文档与渲染",
    security: "安全与权限", wsl: "WSL 与 Windows", identity: "身份与通信", agi: "AGI 架构",
  };

  const state = {
    data: null,
    plugins: [],
    query: "",
    category: "all",
    sort: "recommended",
    limit: 60,
    lang: (document.documentElement.lang || "zh").startsWith("en") ? "en" : "zh",
  };

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  function pair(value) {
    if (!value) return { zh: "", en: "" };
    if (typeof value === "string") return { zh: value, en: value };
    return { zh: value.zh || value.en || "", en: value.en || value.zh || "" };
  }

  function text(value) {
    const p = pair(value);
    return state.lang === "en" ? (p.en || p.zh) : (p.zh || p.en);
  }

  function displayTitle(plugin) {
    const raw = text(plugin.title);
    if (!raw) return plugin.name;
    if (/^[^\s/]+\/[^\s/]+(?:#.*)?$/.test(raw) || /^@[^\s/]+\/[^\s/]+$/.test(raw)) {
      return plugin.name.startsWith("@") ? plugin.name.split("/")[1] : plugin.name;
    }
    return raw;
  }

  function authorOf(plugin) {
    const url = plugin.repository?.url || "";
    const match = url.match(/github\.com\/([^/]+)/i);
    if (match) return match[1];
    if (plugin.name.startsWith("@")) return plugin.name.slice(1).split("/")[0];
    return "";
  }

  function hashHue(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return hash % 360;
  }

  function artLetter(plugin) {
    const title = displayTitle(plugin);
    const chinese = title.match(/[\u3400-\u9fff]/);
    if (chinese) return chinese[0];
    let base = String(plugin.name || "").split("/").pop() || plugin.name;
    base = base
      .replace(/^dsh-?/i, "")
      .replace(/^plugin-?/i, "")
      .replace(/^client-ui-?/i, "")
      .replace(/^ui-/i, "");
    const word = base.split(/[-_.]/).filter(Boolean)[0] || base;
    return (word[0] || "◇").toUpperCase();
  }

  function art(plugin, size) {
    const hue = hashHue(plugin.name);
    const style = plugin.emoji
      ? `background:linear-gradient(135deg,hsl(${hue} 70% 55% / .19),hsl(${(hue + 46) % 360} 70% 55% / .09))`
      : `background:linear-gradient(135deg,hsl(${hue} 72% 52% / .22),hsl(${(hue + 46) % 360} 72% 52% / .10));color:hsl(${hue} 62% 42%)`;
    return `<span class="art ${size || ""}" style="${style}">${esc(plugin.emoji || artLetter(plugin))}</span>`;
  }

  function categoryTitle(id) {
    const raw = state.data?.metadata?.categories?.[id]?.title;
    return text(raw) || FALLBACK_CATEGORIES[id] || id;
  }

  function specOf(plugin, version) {
    const v = version || plugin.versions?.[0];
    if (!v) return plugin.name;
    const source = v.source || { type: "npm" };
    if (source.type === "npm") return `${plugin.name}@${v.version}`;
    if (source.type === "link") return `link:${String(source.path || "").replace(/\\/g, "/")}`;
    if (source.type === "tarball") return source.url || "";
    if (source.type === "git") {
      let url = String(source.url || "");
      if (url.startsWith("git+")) url = url.slice(4);
      const base = `git+${url}`;
      const commit = /^[0-9a-f]{7,64}$/i.test(source.commit || "") ? `#${source.commit}` : "";
      const sub = source.path ? `&path:/${String(source.path).replace(/^\/+/, "")}` : "";
      return `${base}${commit}${sub}`;
    }
    return plugin.name;
  }

  function commandFor(plugin, version) {
    return `dsh plugin --profile desktop add ${specOf(plugin, version)}`;
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function fmtDate(ms) {
    if (!ms) return "—";
    try {
      return new Intl.DateTimeFormat(state.lang === "en" ? "en-US" : "zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(ms));
    } catch {
      return new Date(ms).toISOString().slice(0, 10);
    }
  }

  function fmtRelative(ms) {
    if (!ms) return "—";
    const diff = Date.now() - ms;
    const minutes = Math.round(diff / 60000);
    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days} 天前`;
    return fmtDate(ms);
  }

  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  async function copy(value) {
    try {
      await navigator.clipboard.writeText(value);
      toast("已复制");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand("copy"); toast("已复制"); } catch { toast("复制失败，请手动选择"); }
      textarea.remove();
    }
  }

  function haystack(plugin) {
    return [
      plugin.name,
      plugin.title?.zh, plugin.title?.en,
      plugin.description?.zh, plugin.description?.en,
      plugin.metadata?.category,
      ...(plugin.metadata?.keywords || []),
    ].filter(Boolean).join(" ").normalize("NFKC").toLowerCase();
  }

  function score(plugin, query) {
    const words = query.normalize("NFKC").toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return 0;
    const name = plugin.name.toLowerCase();
    const title = `${plugin.title?.zh || ""} ${plugin.title?.en || ""}`.toLowerCase();
    const desc = `${plugin.description?.zh || ""} ${plugin.description?.en || ""}`.toLowerCase();
    const hay = haystack(plugin);
    let total = 0;
    for (const word of words) {
      if (!hay.includes(word)) return -Infinity;
      if (name === word) total += 120;
      else if (name.startsWith(word)) total += 80;
      else if (name.includes(word)) total += 55;
      if (title.includes(word)) total += 30;
      if (desc.includes(word)) total += 8;
    }
    if (plugin.curated) total += 45;
    if (plugin.featured) total += 25;
    return total;
  }

  function filtered() {
    let list = state.plugins;
    if (state.category === "featured") list = list.filter((plugin) => plugin.curated);
    else if (state.category !== "all") list = list.filter((plugin) => plugin.metadata?.category === state.category);
    if (state.query) {
      cacheSearch = cacheSearch || new Map();
      list = list
        .map((plugin) => {
          if (!cacheSearch.has(plugin.name)) cacheSearch.set(plugin.name, score(plugin, state.query));
          return { plugin, score: cacheSearch.get(plugin.name) };
        })
        .filter((item) => Number.isFinite(item.score))
        .sort((a, b) => b.score - a.score || (a.plugin.featured ?? 999) - (b.plugin.featured ?? 999))
        .map((item) => item.plugin);
    }
    if (state.sort === "latest") {
      list = [...list].sort((a, b) => (b.versions?.[0]?.publishedAt ?? 0) - (a.versions?.[0]?.publishedAt ?? 0));
    } else if (state.sort === "name") {
      list = [...list].sort((a, b) => displayTitle(a).localeCompare(displayTitle(b), "zh"));
    } else if (!state.query) {
      list = [...list].sort((a, b) => {
        if (!!a.curated !== !!b.curated) return a.curated ? -1 : 1;
        return (a.featured ?? 999) - (b.featured ?? 999);
      });
    }
    return list;
  }

  let cacheSearch = new Map();

  function renderChips() {
    const counts = new Map();
    for (const plugin of state.plugins) {
      const id = plugin.metadata?.category || "tools";
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    const curated = state.plugins.filter((plugin) => plugin.curated).length;
    const personal = state.plugins.filter((plugin) => plugin.personal).length;
    const categoryEntries = [...counts.entries()]
      .filter(([id]) => id !== "personal")
      .sort((a, b) => b[1] - a[1] || categoryTitle(a[0]).localeCompare(categoryTitle(b[0]), "zh"));

    const chips = [
      { id: "all", label: "全部", count: state.plugins.length },
      { id: "featured", label: "精选", count: curated },
      ...(personal ? [{ id: "personal", label: "我的", count: personal }] : []),
      ...categoryEntries.map(([id, count]) => ({ id, label: categoryTitle(id), count })),
    ];
    $("chips").innerHTML = chips.map((chip) => `
      <button class="chip ${state.category === chip.id ? "on" : ""}" type="button" data-category="${esc(chip.id)}">
        ${esc(chip.label)} <em>${chip.count}</em>
      </button>`).join("");
  }

  function card(plugin) {
    const title = displayTitle(plugin);
    const author = authorOf(plugin);
    const category = categoryTitle(plugin.metadata?.category || "tools");
    const desc = text(plugin.description) || "这个目录没有提供描述。";
    const version = plugin.versions?.[0]?.version || "";
    const badges = [
      plugin.featured ? '<span class="badge brand">精选</span>' : "",
      plugin.personal ? '<span class="badge green">我的</span>' : "",
      plugin.versions?.[0]?.source?.type === "link" ? '<span class="badge amber">本地</span>' : "",
    ].join("");
    return `
      <article class="card" tabindex="0" role="button" data-name="${esc(plugin.name)}" aria-label="${esc(title)}">
        <div class="card-top">
          ${art(plugin)}
          <div class="card-main">
            <div class="card-title">${esc(title)}</div>
            <div class="card-meta">${author ? `@${esc(author)} · ` : ""}${esc(category)}</div>
            <div class="badges">${badges}</div>
          </div>
        </div>
        <div class="card-desc">${esc(desc)}</div>
        <div class="card-foot">
          <span class="version">${version ? `v${esc(version)}` : ""}</span>
          <button class="card-action" type="button" data-name="${esc(plugin.name)}">详情</button>
        </div>
      </article>`;
  }

  function skeleton() {
    return Array.from({ length: 6 }).map(() => `
      <div class="card" aria-hidden="true">
        <div class="card-top">
          <span class="art" style="background:color-mix(in srgb, var(--text) 8%, transparent)"></span>
          <div style="flex:1;display:flex;flex-direction:column;gap:8px;padding-top:3px">
            <span style="height:13px;width:62%;border-radius:6px;background:color-mix(in srgb, var(--text) 9%, transparent)"></span>
            <span style="height:10px;width:42%;border-radius:6px;background:color-mix(in srgb, var(--text) 6%, transparent)"></span>
          </div>
        </div>
        <span style="height:10px;width:100%;border-radius:6px;background:color-mix(in srgb, var(--text) 6%, transparent)"></span>
        <span style="height:10px;width:90%;border-radius:6px;background:color-mix(in srgb, var(--text) 6%, transparent)"></span>
      </div>`).join("");
  }

  function render() {
    const list = filtered();
    $("result-count").textContent = state.query || state.category !== "all"
      ? `${list.length} 个匹配`
      : `共 ${list.length} 个插件`;
    $("grid").innerHTML = list.slice(0, state.limit).map(card).join("");
    $("empty").hidden = list.length > 0;
    $("more").hidden = list.length <= state.limit;
    if (list.length > state.limit) $("more").textContent = `加载更多（还有 ${list.length - state.limit} 个）`;
    renderChips();
  }

  function stats() {
    const data = state.data;
    $("stat-curated").textContent = String(data.market?.curatedCount ?? state.plugins.filter((plugin) => plugin.curated).length);
    $("stat-total").textContent = String(state.plugins.length);
    $("stat-updated").textContent = fmtRelative(new Date(data.market?.generatedAt || Date.now()).getTime());
    $("source-line").textContent = `在线目录 · 更新于 ${fmtRelative(new Date(data.market?.generatedAt || Date.now()).getTime())}`;
    $("footer-meta").textContent = `鲸市 · ${state.plugins.length} 个插件 · ${fmtDate(new Date(data.market?.generatedAt || Date.now()).getTime())}`;
    const repo = data.market?.pluginRepo;
    if (repo) $("repo-link").href = repo;
    const install = data.market?.pluginInstall;
    if (install) $("plugin-command").textContent = `dsh plugin --profile desktop add ${install}`;
  }

  function openModal(plugin) {
    const title = displayTitle(plugin);
    const author = authorOf(plugin);
    const category = categoryTitle(plugin.metadata?.category || "tools");
    const repo = safeUrl(plugin.repository?.url);
    const homepage = safeUrl(plugin.homepage);
    const versions = (plugin.versions || []).slice(0, 12);
    const current = versions[0];
    const spec = specOf(plugin, current);
    $("modal-body").innerHTML = `
      <div class="modal-head">
        ${art(plugin)}
        <div>
          <h2 class="modal-title" id="modal-title">${esc(title)}</h2>
          <div class="modal-sub">${esc(plugin.name)}${author ? ` · @${esc(author)}` : ""}</div>
        </div>
      </div>
      ${plugin.note ? `<div class="modal-note">${esc(plugin.note)}</div>` : ""}
      <p class="modal-desc">${esc(text(plugin.description) || "这个目录没有提供描述。")}</p>
      <div class="modal-section">
        <h4>信息</h4>
        <dl class="facts">
          <div class="fact"><dt>版本</dt><dd>v${esc(current?.version || "—")}</dd></div>
          <div class="fact"><dt>分类</dt><dd>${esc(category)}</dd></div>
          <div class="fact"><dt>发布</dt><dd>${fmtDate(current?.publishedAt)}</dd></div>
          <div class="fact"><dt>来源</dt><dd>${esc(current?.source?.type || "npm")}</dd></div>
        </dl>
      </div>
      ${(repo || homepage) ? `<div class="modal-section"><h4>链接</h4><div class="links">
        ${repo ? `<a href="${esc(repo)}" target="_blank" rel="noreferrer noopener">源码 ↗</a>` : ""}
        ${homepage ? `<a href="${esc(homepage)}" target="_blank" rel="noreferrer noopener">主页 ↗</a>` : ""}
      </div></div>` : ""}
      <div class="modal-section">
        <h4>安装命令</h4>
        <div class="command"><code>${esc(commandFor(plugin, current))}</code><button class="small-btn" type="button" data-copy="${esc(commandFor(plugin, current))}">复制</button></div>
      </div>
      ${versions.length > 1 ? `<div class="modal-section"><h4>可选版本</h4><div class="versions">
        ${versions.map((version) => `<div class="vrow">
          <span class="v">v${esc(version.version)}</span>
          <span class="vm">${fmtDate(version.publishedAt)} · ${esc(version.source?.type || "npm")}</span>
          <button class="small-btn" type="button" data-copy="${esc(commandFor(plugin, version))}">复制</button>
        </div>`).join("")}
      </div></div>` : ""}
      <div class="trust">第三方插件会以你的权限运行。只安装你信得过的插件；目录内容来自社区，不代表安全审计。</div>`;
    $("modal").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    $("modal").hidden = true;
    document.body.style.overflow = "";
  }

  async function load() {
    $("grid").innerHTML = skeleton();
    $("result-count").textContent = "正在读取在线目录…";
    try {
      const response = await fetch("./index.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data?.format !== 1 || !Array.isArray(data.plugins)) throw new Error("目录格式不正确");
      state.data = data;
      state.plugins = data.plugins;
      stats();
      render();
    } catch (error) {
      $("grid").innerHTML = "";
      $("result-count").textContent = "在线目录读取失败";
      $("empty").hidden = false;
      $("empty").querySelector("h3").textContent = "在线目录读取失败";
      $("empty").querySelector("p").textContent = `${error.message}。如果你是本地打开 index.html，请用 node scripts/serve-site.mjs 起一个本地服务器。`;
      $("empty").querySelector("button").hidden = true;
    }
  }

  // events
  $("search").addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    state.limit = 60;
    cacheSearch = new Map();
    render();
  });
  $("clear-search").addEventListener("click", () => {
    $("search").value = "";
    state.query = "";
    state.limit = 60;
    cacheSearch = new Map();
    render();
    $("search").focus();
  });
  $("sort").addEventListener("change", (event) => {
    state.sort = event.target.value;
    state.limit = 60;
    render();
  });
  $("chips").addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    state.limit = 60;
    render();
  });
  $("grid").addEventListener("click", (event) => {
    const target = event.target.closest("[data-name]");
    if (!target) return;
    const plugin = state.plugins.find((item) => item.name === target.dataset.name);
    if (plugin) openModal(plugin);
  });
  $("grid").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target.closest("[data-name]");
    if (!target) return;
    event.preventDefault();
    const plugin = state.plugins.find((item) => item.name === target.dataset.name);
    if (plugin) openModal(plugin);
  });
  $("more").addEventListener("click", () => {
    state.limit += 60;
    render();
  });
  $("reset").addEventListener("click", () => {
    $("search").value = "";
    state.query = "";
    state.category = "all";
    state.sort = "recommended";
    state.limit = 60;
    $("sort").value = "recommended";
    cacheSearch = new Map();
    render();
  });
  $("modal").addEventListener("click", (event) => {
    if (event.target === $("modal")) closeModal();
    const copyButton = event.target.closest("[data-copy]");
    if (copyButton) copy(copyButton.dataset.copy);
  });
  $("modal-close").addEventListener("click", closeModal);
  $("copy-plugin").addEventListener("click", () => copy($("plugin-command").textContent));
  $("repo-link").addEventListener("click", (event) => {
    if (!$("repo-link").href || $("repo-link").getAttribute("href") === "#") event.preventDefault();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  // theme
  const savedTheme = localStorage.getItem("whale-theme");
  if (savedTheme === "dark" || (!savedTheme && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.dataset.theme = "dark";
  }
  $("theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("whale-theme", next);
  });

  load();
})();
