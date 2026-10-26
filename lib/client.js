/**
 * dsh-whale-market —— 鲸市 · 客户端
 *
 * 挂在侧边栏「插件」页的 tab 上。宿主负责目录、安装状态和安装动作，
 * 这里只做展示、搜索、筛选和交互。
 *
 * 打包方式与 DSH 其它客户端插件一致：window.__ModuleLoader__.load({ id, factory })。
 */
window.__ModuleLoader__.load({
  id: "dsh-whale-market",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const { createElement: h, useCallback, useEffect, useMemo, useRef, useState } = React;

    const API = "/dsh-whale-market/api";
    const SELF = "dsh-whale-market";
    const STYLE_ID = "dsh-whale-market/style.css";

    const CSS = [
      ".wm{--wm-brand:#2563eb;--wm-brand2:#06b6d4;--wm-bg:var(--dsw-alias-bg-module-platform,rgba(127,127,127,.04));--wm-border:var(--dsw-alias-border-l2,rgba(127,127,127,.22));--wm-text:var(--dsw-alias-label-primary,#1f2328);--wm-sub:var(--dsw-alias-label-secondary,#57606a);--wm-ter:var(--dsw-alias-label-tertiary,#8b949e);display:flex;flex-direction:column;gap:14px;width:100%;max-width:1080px;min-width:0;margin:0 auto;padding:10px 2px 48px;color:var(--wm-text);font-size:13px;line-height:1.5}",
      ".wm *{box-sizing:border-box}",
      ".wm button{font:inherit;color:inherit}",
      ".wm a{color:var(--dsw-alias-link,#2563eb);text-decoration:none}.wm a:hover{text-decoration:underline}",
      ".wm-hero{position:relative;overflow:hidden;border:1px solid var(--wm-border);border-radius:16px;padding:18px 20px 16px;background:linear-gradient(135deg,rgba(37,99,235,.10),rgba(6,182,212,.05) 55%,transparent 100%),var(--wm-bg)}",
      ".wm-hero:after{content:'';position:absolute;right:-70px;top:-90px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,rgba(37,99,235,.18),transparent 66%);pointer-events:none}",
      ".wm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}",
      ".wm-brand{display:flex;align-items:center;gap:12px;min-width:0}",
      ".wm-logo{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;color:#fff;font-size:22px;font-weight:700;background:linear-gradient(135deg,#2563eb,#06b6d4);box-shadow:0 8px 22px rgba(37,99,235,.28);flex:none}",
      ".wm-name{margin:0;font-size:19px;line-height:26px;font-weight:650;letter-spacing:.2px}",
      ".wm-tag{color:var(--wm-ter);font-size:11px;line-height:16px;letter-spacing:1.4px;text-transform:uppercase}",
      ".wm-sub{margin:5px 0 0;color:var(--wm-sub);font-size:12px;line-height:18px;max-width:640px}",
      ".wm-head-actions{display:flex;gap:8px;align-items:center}",
      ".wm-iconbtn{height:32px;min-width:32px;padding:0 10px;border:1px solid var(--wm-border);border-radius:9px;background:transparent;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--wm-sub);transition:.15s}",
      ".wm-iconbtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.09));color:var(--wm-text)}",
      ".wm-iconbtn:disabled{opacity:.5;cursor:default}",
      ".wm-spin{display:inline-block;animation:wm-spin 1s linear infinite}",
      "@keyframes wm-spin{to{transform:rotate(360deg)}}",
      ".wm-stats{display:flex;gap:10px 18px;flex-wrap:wrap;margin-top:13px;color:var(--wm-sub);font-size:12px}",
      ".wm-stats b{color:var(--wm-text);font-weight:650}",
      ".wm-amber{color:var(--dsw-alias-state-warn-primary,#b45309)}",
      ".wm-red{color:var(--dsw-alias-state-error-primary,#c62828)}",
      ".wm-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}",
      ".wm-search{position:relative;flex:1;min-width:240px}",
      ".wm-search input{width:100%;height:38px;border:1px solid var(--wm-border);border-radius:10px;background:var(--wm-bg);padding:0 34px 0 34px;color:var(--wm-text);font-size:13px;outline:none;transition:.15s}",
      ".wm-search input:focus{border-color:var(--wm-brand);box-shadow:0 0 0 3px rgba(37,99,235,.13)}",
      ".wm-search .wm-si{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--wm-ter);font-size:14px;pointer-events:none}",
      ".wm-search .wm-clear{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:var(--wm-ter);cursor:pointer;font-size:15px;line-height:1;padding:4px}",
      ".wm-select{height:38px;border:1px solid var(--wm-border);border-radius:10px;background:var(--wm-bg);padding:0 30px 0 10px;color:var(--wm-text);font-size:12px;outline:none;cursor:pointer}",
      ".wm-switch-wrap{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 10px;border:1px solid var(--wm-border);border-radius:10px;background:var(--wm-bg);cursor:pointer;font-size:12px;color:var(--wm-sub);user-select:none;white-space:nowrap}",
      ".wm-chips{display:flex;gap:7px;flex-wrap:wrap;padding:1px 0 3px}",
      ".wm-chip{flex:none;height:29px;padding:0 11px;border:1px solid var(--wm-border);border-radius:999px;background:transparent;color:var(--wm-sub);cursor:pointer;font-size:12px;display:inline-flex;align-items:center;gap:6px;transition:.15s;white-space:nowrap}",
      ".wm-chip:hover{border-color:rgba(37,99,235,.45);color:var(--wm-text)}",
      ".wm-chip.on{background:var(--wm-brand);border-color:var(--wm-brand);color:#fff}",
      ".wm-chip em{font-style:normal;opacity:.62;font-size:10.5px}",
      ".wm-sourcebar{display:flex;gap:8px 14px;align-items:center;flex-wrap:wrap;color:var(--wm-ter);font-size:11.5px}",
      ".wm-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#22c55e;margin-right:5px;vertical-align:1px}",
      ".wm-dot.bad{background:#ef4444}.wm-dot.warn{background:#f59e0b}",
      ".wm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}",
      ".wm-card{position:relative;display:flex;flex-direction:column;gap:10px;padding:14px;border:1px solid var(--wm-border);border-radius:14px;background:var(--wm-bg);cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s;min-height:170px;overflow:hidden}",
      ".wm-card:hover{transform:translateY(-2px);border-color:rgba(37,99,235,.42);box-shadow:0 10px 28px rgba(15,23,42,.10)}",
      ".wm-card-top{display:flex;gap:11px;align-items:flex-start}",
      ".wm-art{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:20px;font-weight:700;flex:none;overflow:hidden}",
      ".wm-art img{width:100%;height:100%;object-fit:cover}",
      ".wm-card-main{min-width:0;flex:1}",
      ".wm-card-title{font-size:13.5px;font-weight:650;line-height:19px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}",
      ".wm-card-title .wm-title-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}",
      ".wm-author{color:var(--wm-ter);font-size:11px;line-height:16px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".wm-desc{color:var(--wm-sub);font-size:12px;line-height:18px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:54px;max-height:54px}",
      ".wm-badges{display:flex;gap:5px;flex-wrap:wrap}",
      ".wm-badge{display:inline-flex;align-items:center;height:19px;padding:0 7px;border-radius:999px;font-size:10.5px;line-height:19px;background:rgba(127,127,127,.12);color:var(--wm-sub);white-space:nowrap}",
      ".wm-badge.brand{background:rgba(37,99,235,.12);color:#2563eb}",
      ".wm-badge.green{background:rgba(34,197,94,.13);color:#15803d}",
      ".wm-badge.amber{background:rgba(245,158,11,.15);color:#b45309}",
      ".wm-badge.red{background:rgba(239,68,68,.13);color:#b91c1c}",
      ".wm-card-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto;padding-top:2px}",
      ".wm-version{color:var(--wm-ter);font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}",
      ".wm-btn{height:30px;padding:0 12px;border-radius:8px;border:1px solid transparent;background:var(--wm-brand);color:#fff;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;transition:.15s}",
      ".wm-btn:hover{filter:brightness(1.06)}",
      ".wm-btn:disabled{opacity:.5;cursor:default;filter:none}",
      ".wm-btn.ghost{background:transparent;border-color:var(--wm-border);color:var(--wm-text)}",
      ".wm-btn.ghost:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.09))}",
      ".wm-btn.danger{background:transparent;border-color:rgba(239,68,68,.45);color:#dc2626}",
      ".wm-btn.danger:hover{background:rgba(239,68,68,.08)}",
      ".wm-btn.sm{height:27px;padding:0 10px;font-size:11.5px}",
      ".wm-skeleton{min-height:170px;border-radius:14px;border:1px solid var(--wm-border);background:var(--wm-bg);padding:14px;display:flex;flex-direction:column;gap:10px}",
      ".wm-sk{background:linear-gradient(90deg,rgba(127,127,127,.10),rgba(127,127,127,.18),rgba(127,127,127,.10));background-size:200% 100%;animation:wm-shimmer 1.4s ease infinite;border-radius:6px}",
      "@keyframes wm-shimmer{to{background-position:-200% 0}}",
      ".wm-empty{padding:46px 20px;text-align:center;border:1px dashed var(--wm-border);border-radius:14px;color:var(--wm-sub)}",
      ".wm-empty h4{margin:0 0 6px;font-size:14px;color:var(--wm-text)}",
      ".wm-more{display:flex;justify-content:center;padding:6px 0 2px}",
      ".wm-overlay{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.46);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:22px;animation:wm-fade .12s ease}",
      "@keyframes wm-fade{from{opacity:0}to{opacity:1}}",
      ".wm-modal{width:min(740px,96vw);max-height:88vh;overflow:auto;border-radius:16px;background:var(--dsw-alias-bg-module-platform,#fff);border:1px solid var(--wm-border);box-shadow:0 24px 80px rgba(0,0,0,.28);padding:20px 22px 18px;position:relative}",
      ".wm-modal.wm-small{width:min(460px,94vw)}",
      ".wm-modal-close{position:absolute;right:12px;top:10px;width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:var(--wm-ter);font-size:20px;cursor:pointer;line-height:1}",
      ".wm-modal-close:hover{background:rgba(127,127,127,.12);color:var(--wm-text)}",
      ".wm-detail-head{display:flex;gap:14px;align-items:flex-start;padding-right:32px}",
      ".wm-detail-head .wm-art{width:56px;height:56px;border-radius:15px;font-size:25px}",
      ".wm-detail-title{margin:0;font-size:18px;line-height:25px;font-weight:650}",
      ".wm-detail-meta{color:var(--wm-ter);font-size:12px;line-height:18px;margin-top:3px}",
      ".wm-note{margin:14px 0 0;padding:10px 12px;border-radius:10px;background:rgba(37,99,235,.07);border:1px solid rgba(37,99,235,.14);color:var(--wm-sub);font-size:12px;line-height:18px}",
      ".wm-detail-desc{margin:14px 0 0;color:var(--wm-sub);font-size:12.5px;line-height:20px;white-space:pre-wrap}",
      ".wm-section{margin-top:16px}",
      ".wm-section h5{margin:0 0 7px;font-size:12px;color:var(--wm-ter);font-weight:600;letter-spacing:.3px}",
      ".wm-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}",
      ".wm-fact{padding:8px 10px;border:1px solid var(--wm-border);border-radius:9px;background:var(--wm-bg);min-width:0}",
      ".wm-fact dt{color:var(--wm-ter);font-size:10.5px;line-height:15px}.wm-fact dd{margin:2px 0 0;font-size:12px;line-height:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".wm-links{display:flex;gap:12px;flex-wrap:wrap;font-size:12px}",
      ".wm-code{display:flex;gap:8px;align-items:center;margin-top:6px;padding:9px 10px;border-radius:9px;background:rgba(127,127,127,.09);border:1px solid var(--wm-border);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;overflow:auto}",
      ".wm-code code{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--wm-sub)}",
      ".wm-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px;padding-top:14px;border-top:.5px solid var(--wm-border)}",
      ".wm-versions{margin-top:6px;border:1px solid var(--wm-border);border-radius:10px;overflow:hidden}",
      ".wm-vrow{display:flex;align-items:center;gap:10px;padding:8px 11px;border-bottom:.5px solid var(--wm-border);font-size:11.5px}",
      ".wm-vrow:last-child{border-bottom:0}",
      ".wm-vrow .wm-v{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--wm-text)}",
      ".wm-vrow .wm-vmeta{color:var(--wm-ter);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".wm-trust{margin-top:12px;color:var(--wm-ter);font-size:11px;line-height:17px}",
      ".wm-progress{display:flex;align-items:center;gap:10px;margin:8px 0 12px}",
      ".wm-spinner{width:22px;height:22px;border-radius:50%;border:2.5px solid rgba(37,99,235,.18);border-top-color:var(--wm-brand);animation:wm-spin 1s linear infinite;flex:none}",
      ".wm-logs{margin-top:10px;max-height:260px;overflow:auto;border-radius:10px;background:rgba(15,23,42,.06);border:1px solid var(--wm-border);padding:9px 11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:16px;white-space:pre-wrap;color:var(--wm-sub)}",
      ".wm-drawer-overlay{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.35);display:flex;justify-content:flex-end;animation:wm-fade .12s ease}",
      ".wm-drawer{width:min(460px,96vw);height:100%;overflow:auto;background:var(--dsw-alias-bg-module-platform,#fff);border-left:1px solid var(--wm-border);padding:20px;box-shadow:-20px 0 60px rgba(0,0,0,.18)}",
      ".wm-drawer h4{margin:0 0 4px;font-size:16px}",
      ".wm-source{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:.5px solid var(--wm-border)}",
      ".wm-source:last-child{border-bottom:0}",
      ".wm-source-main{flex:1;min-width:0}",
      ".wm-source-title{font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:6px;flex-wrap:wrap}",
      ".wm-source-url{color:var(--wm-ter);font-size:10.5px;line-height:15px;word-break:break-all;margin-top:2px}",
      ".wm-source-err{color:#b45309;font-size:10.5px;line-height:15px;margin-top:3px}",
      ".wm-switch{width:34px;height:19px;border-radius:999px;border:0;background:rgba(127,127,127,.28);padding:2px;cursor:pointer;flex:none;transition:.15s}",
      ".wm-switch span{display:block;width:15px;height:15px;border-radius:50%;background:#fff;transition:.15s;box-shadow:0 1px 3px rgba(0,0,0,.2)}",
      ".wm-switch.on{background:var(--wm-brand)}.wm-switch.on span{transform:translateX(15px)}",
      ".wm-form{display:flex;flex-direction:column;gap:8px;margin-top:14px}",
      ".wm-form input{height:34px;border:1px solid var(--wm-border);border-radius:9px;background:var(--wm-bg);padding:0 10px;color:var(--wm-text);font-size:12px;outline:none}",
      ".wm-form input:focus{border-color:var(--wm-brand)}",
      ".wm-form-row{display:flex;gap:8px}.wm-form-row input{flex:1}",
      ".wm-hint{color:var(--wm-ter);font-size:11px;line-height:16px}",
      ".wm-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:1200;background:rgba(23,32,46,.94);color:#fff;font-size:12px;line-height:18px;padding:9px 14px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:min(560px,90vw);animation:wm-rise .16s ease}",
      "@keyframes wm-rise{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}",
      ".wm-banner{display:flex;gap:9px;align-items:flex-start;padding:10px 12px;border-radius:10px;background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.24);color:var(--dsw-alias-state-warn-primary,#92400e);font-size:11.5px;line-height:17px}",
      ".wm-banner.red{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.22);color:#b91c1c}",
      ".wm-banner .wm-banner-main{flex:1;min-width:0}",
      ".wm-banner button{flex:none}",
      ".wm-footer{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;color:var(--wm-ter);font-size:10.5px;line-height:16px;padding:2px 2px 0}",
      "@media (max-width:680px){.wm-hero{padding:15px}.wm-name{font-size:17px}.wm-grid{grid-template-columns:1fr}.wm-modal{padding:16px}.wm-desc{min-height:auto}.wm-head-actions{width:100%;justify-content:flex-end}}",
    ].join("");

    const CATEGORY_FALLBACK = {
      personal: "我的",
      market: "市场与管理",
      memory: "记忆",
      session: "会话",
      ui: "界面",
      tools: "工具",
      fun: "娱乐",
      dev: "开发",
      model: "模型",
      notify: "通知",
      remote: "远程",
      theme: "主题",
      usage: "用量",
      browser: "浏览",
      vision: "视觉",
      voice: "语音",
      git: "Git",
      workflow: "工作流",
      skill: "技能",
      docs: "文档",
      security: "安全",
      wsl: "WSL",
      identity: "身份",
      agi: "AGI",
    };

    function useStyleOnce() {
      useEffect(() => {
        if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = CSS;
        document.head.appendChild(style);
      }, []);
    }

    function currentLang() {
      try {
        const lang = (document.documentElement.lang || navigator.language || "zh").toLowerCase();
        return lang.startsWith("en") ? "en" : "zh";
      } catch {
        return "zh";
      }
    }

    function pick(pair, lang) {
      if (!pair) return "";
      if (typeof pair === "string") return pair;
      return pair[lang] || pair.zh || pair.en || "";
    }

    function authorOf(plugin) {
      const url = plugin.repository?.url || "";
      const github = url.match(/github\.com\/([^/]+)/i);
      if (github) return github[1];
      if (plugin.name.startsWith("@")) return plugin.name.slice(1).split("/")[0];
      return "";
    }

    function hashHue(name) {
      let hash = 0;
      for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
      return hash % 360;
    }

    function artLetter(plugin) {
      const title = plugin.displayTitle || plugin.title?.zh || plugin.title?.en || "";
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

    function artwork(plugin, sizeClass) {
      const hue = hashHue(plugin.name);
      const emoji = plugin.emoji;
      const letter = artLetter(plugin);
      const style = emoji
        ? { background: `linear-gradient(135deg, hsl(${hue} 70% 55% / .19), hsl(${(hue + 46) % 360} 70% 55% / .09))` }
        : {
            background: `linear-gradient(135deg, hsl(${hue} 72% 52% / .22), hsl(${(hue + 46) % 360} 72% 52% / .10))`,
            color: `hsl(${hue} 62% 42%)`,
          };
      return h("div", { className: `wm-art ${sizeClass || ""}`, style }, emoji || letter);
    }

    function fmtDate(ms, lang) {
      if (!ms) return "—";
      try {
        return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(ms));
      } catch {
        return new Date(ms).toISOString().slice(0, 10);
      }
    }

    function fmtRelative(ms, lang) {
      if (!ms) return "—";
      const diff = Date.now() - ms;
      const minutes = Math.round(diff / 60000);
      if (minutes < 1) return lang === "en" ? "just now" : "刚刚";
      if (minutes < 60) return lang === "en" ? `${minutes}m ago` : `${minutes} 分钟前`;
      const hours = Math.round(minutes / 60);
      if (hours < 24) return lang === "en" ? `${hours}h ago` : `${hours} 小时前`;
      const days = Math.round(hours / 24);
      if (days < 30) return lang === "en" ? `${days}d ago` : `${days} 天前`;
      return fmtDate(ms, lang);
    }

    function installedLabel(installed, lang) {
      const en = lang === "en";
      if (!installed) return "";
      if (installed.status === "provided") return en ? "Provided by DSH" : "DSH 自带";
      if (installed.status === "installed") return installed.update ? (en ? `Update to v${installed.version}` : `更新到 v${installed.version}`) : en ? "Installed" : "已安装";
      if (installed.status === "disabled") return en ? "Installed · off" : "已安装 · 未启用";
      return "";
    }

    function actionFor(plugin, lang) {
      const en = lang === "en";
      if (!plugin.installed) return { kind: "install", label: en ? "Install" : "安装" };
      if (plugin.installed.status === "provided") return { kind: "none", label: en ? "Provided" : "DSH 自带" };
      if (plugin.installed.status === "installed") {
        if (plugin.installed.update) return { kind: "install", label: en ? "Update" : "更新", tone: "brand" };
        return { kind: "open", label: en ? "Installed" : "已安装", tone: "ghost" };
      }
      if (plugin.installed.status === "disabled") return { kind: "enable", label: en ? "Enable" : "启用", tone: "brand" };
      return { kind: "install", label: en ? "Install" : "安装" };
    }

    function categoryTitle(categories, id, lang) {
      const found = categories?.find((category) => category.id === id);
      if (found) return pick(found.title, lang);
      return CATEGORY_FALLBACK[id] || id;
    }

    function totalCount(categories) {
      return (categories || []).reduce((sum, category) => sum + (category.count || 0), 0);
    }

    async function api(path, options) {
      const opts = options || {};
      const response = await fetch(`${API}${path}`, {
        ...opts,
        headers: {
          accept: "application/json",
          ...(opts.body ? { "content-type": "application/json" } : {}),
          ...(opts.headers || {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        const error = new Error(data?.error?.message || data?.error || `HTTP ${response.status}`);
        error.code = data?.error?.code;
        error.status = response.status;
        throw error;
      }
      return data;
    }

    function Badge({ children, tone }) {
      return h("span", { className: `wm-badge ${tone || ""}` }, children);
    }

    function Switch({ on, onClick }) {
      return h("button", {
        type: "button",
        className: `wm-switch ${on ? "on" : ""}`,
        role: "switch",
        "aria-checked": !!on,
        onClick,
      }, h("span"));
    }

    function SkeletonCard() {
      return h("div", { className: "wm-skeleton" },
        h("div", { style: { display: "flex", gap: "11px" } },
          h("div", { className: "wm-sk", style: { width: "44px", height: "44px", borderRadius: "12px" } }),
          h("div", { style: { flex: 1, display: "flex", flexDirection: "column", gap: "7px", paddingTop: "2px" } },
            h("div", { className: "wm-sk", style: { width: "62%", height: "13px" } }),
            h("div", { className: "wm-sk", style: { width: "42%", height: "10px" } }))),
        h("div", { className: "wm-sk", style: { width: "100%", height: "10px" } }),
        h("div", { className: "wm-sk", style: { width: "92%", height: "10px" } }),
        h("div", { className: "wm-sk", style: { width: "70%", height: "10px" } }));
    }

    function Card({ plugin, lang, categories, onOpen, onInstall, onEnable, disabled }) {
      const title = plugin.displayTitle || pick(plugin.title, lang) || plugin.name;
      const desc = pick(plugin.description, lang);
      const author = authorOf(plugin);
      const action = actionFor(plugin, lang);
      const isBusy = disabled;
      return h("article", {
        className: "wm-card",
        onClick: () => onOpen(plugin),
        role: "button",
        tabIndex: 0,
        onKeyDown: (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(plugin); } },
      },
        h("div", { className: "wm-card-top" },
          artwork(plugin),
          h("div", { className: "wm-card-main" },
            h("div", { className: "wm-card-title" }, h("span", { className: "wm-title-text" }, title)),
            h("div", { className: "wm-author" },
              author ? `@${author}` : "",
              author && plugin.category ? " · " : "",
              categoryTitle(categories, plugin.category, lang)),
            h("div", { className: "wm-badges", style: { marginTop: "6px" } },
              plugin.featured ? h(Badge, { tone: "brand" }, lang === "en" ? "Pick" : "精选") : null,
              plugin.personal ? h(Badge, { tone: "green" }, lang === "en" ? "Mine" : "我的") : null,
              plugin.installed?.status === "installed" ? h(Badge, { tone: "green" }, lang === "en" ? "Installed" : "已安装") : null,
              plugin.installed?.status === "disabled" ? h(Badge, { tone: "amber" }, lang === "en" ? "Off" : "未启用") : null,
              plugin.installed?.status === "provided" ? h(Badge, null, lang === "en" ? "Built-in" : "自带") : null,
              plugin.installed?.update ? h(Badge, { tone: "amber" }, lang === "en" ? "Update" : "可更新") : null)),
        ),
        h("div", { className: "wm-desc" }, desc || (lang === "en" ? "No description in this index." : "这个目录没有提供描述。")),
        h("div", { className: "wm-card-foot" },
          h("span", { className: "wm-version" }, plugin.version ? `v${plugin.version}` : ""),
          h("button", {
            type: "button",
            className: `wm-btn ${action.tone === "ghost" ? "ghost" : ""}`,
            disabled: isBusy || action.kind === "none",
            onClick: (event) => {
              event.stopPropagation();
              if (action.kind === "install") onInstall(plugin);
              else if (action.kind === "enable") onEnable(plugin);
              else onOpen(plugin);
            },
          }, action.label)));
    }

    function DetailModal({ plugin, lang, categories, loading, canManage, profile, onClose, onInstall, onRemove, onEnable }) {
      useEffect(() => {
        const handler = (event) => { if (event.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
      }, [onClose]);
      if (!plugin) return null;
      const title = plugin.displayTitle || pick(plugin.title, lang) || plugin.name;
      const desc = pick(plugin.description, lang);
      const author = authorOf(plugin);
      const repo = plugin.repository?.url;
      const local = plugin.personal && plugin.localPath;
      const action = actionFor(plugin, lang);
      const command = `dsh plugin --profile ${profile || "desktop"} add ${plugin.spec || plugin.name}`;
      return h("div", { className: "wm-overlay", onMouseDown: (event) => { if (event.target === event.currentTarget) onClose(); } },
        h("div", { className: "wm-modal", role: "dialog", "aria-modal": "true", "aria-label": title },
          h("button", { type: "button", className: "wm-modal-close", onClick: onClose, "aria-label": lang === "en" ? "Close" : "关闭" }, "×"),
          h("div", { className: "wm-detail-head" },
            artwork(plugin),
            h("div", { style: { minWidth: 0, flex: 1 } },
              h("h3", { className: "wm-detail-title" }, title),
              h("div", { className: "wm-detail-meta" },
                plugin.name,
                author ? ` · @${author}` : "",
                h("span", { style: { marginLeft: "8px" } },
                  plugin.curated ? h(Badge, { tone: "brand" }, lang === "en" ? "Curated" : "精选") : null,
                  plugin.personal ? h(Badge, { tone: "green" }, lang === "en" ? "Mine" : "我的") : null)))),
          loading ? h("div", { className: "wm-hint", style: { marginTop: "16px" } }, lang === "en" ? "Reading…" : "读取中…") : null,
          plugin.note ? h("div", { className: "wm-note" }, plugin.note) : null,
          h("p", { className: "wm-detail-desc" }, desc || (lang === "en" ? "No description in this index." : "这个目录没有提供描述。")),
          h("div", { className: "wm-section" },
            h("h5", null, lang === "en" ? "Facts" : "信息"),
            h("dl", { className: "wm-facts" },
              h("div", { className: "wm-fact" }, h("dt", null, lang === "en" ? "Version" : "版本"), h("dd", null, plugin.version ? `v${plugin.version}` : "—")),
              h("div", { className: "wm-fact" }, h("dt", null, lang === "en" ? "Category" : "分类"), h("dd", null, categoryTitle(categories, plugin.category, lang))),
              h("div", { className: "wm-fact" }, h("dt", null, lang === "en" ? "Published" : "发布时间"), h("dd", null, fmtDate(plugin.publishedAt, lang))),
              h("div", { className: "wm-fact" }, h("dt", null, lang === "en" ? "Source" : "来源"), h("dd", null, plugin.source?.title || (plugin.curated ? (lang === "en" ? "Curated" : "鲸市精选") : "—"))),
              plugin.engines?.dsh ? h("div", { className: "wm-fact" }, h("dt", null, "DSH"), h("dd", { title: plugin.engines.dsh }, plugin.engines.dsh)) : null,
              plugin.installed?.status && plugin.installed.status !== "not-installed" ? h("div", { className: "wm-fact" }, h("dt", null, lang === "en" ? "Installed" : "已安装"), h("dd", null, `${plugin.installed.version ? `v${plugin.installed.version}` : ""} ${installedLabel(plugin.installed, lang)}`)) : null)),
          repo || plugin.homepage || local ? h("div", { className: "wm-section" },
            h("h5", null, lang === "en" ? "Links" : "链接"),
            h("div", { className: "wm-links" },
              repo ? h("a", { href: repo, target: "_blank", rel: "noreferrer noopener" }, lang === "en" ? "Source code ↗" : "源码 ↗") : null,
              plugin.homepage ? h("a", { href: plugin.homepage, target: "_blank", rel: "noreferrer noopener" }, lang === "en" ? "Homepage ↗" : "主页 ↗") : null,
              local ? h("span", { className: "wm-hint" }, `${lang === "en" ? "Local path" : "本地目录"}：${plugin.localPath}`) : null)) : null,
          h("div", { className: "wm-section" },
            h("h5", null, lang === "en" ? "Install manually" : "命令行安装"),
            h("div", { className: "wm-code" },
              h("code", null, command),
              h("button", {
                type: "button",
                className: "wm-btn ghost sm",
                onClick: () => {
                  try { navigator.clipboard.writeText(command); } catch {}
                },
              }, lang === "en" ? "Copy" : "复制"))),
          plugin.versions && plugin.versions.length > 1 ? h("div", { className: "wm-section" },
            h("h5", null, lang === "en" ? "Versions" : "可选版本"),
            h("div", { className: "wm-versions" }, plugin.versions.slice(0, 12).map((version) => h("div", { className: "wm-vrow", key: version.version },
              h("span", { className: "wm-v" }, `v${version.version}`),
              h("span", { className: "wm-vmeta" }, `${fmtDate(version.publishedAt, lang)} · ${version.source?.type || "npm"}`),
              plugin.installed?.version === version.version
                ? h(Badge, { tone: "green" }, lang === "en" ? "Current" : "当前")
                : h("button", { type: "button", className: "wm-btn ghost sm", disabled: !canManage, onClick: () => onInstall(plugin, version.version) }, lang === "en" ? "Install" : "安装"))))) : null,
          h("div", { className: "wm-actions" },
            canManage ? (action.kind === "install"
              ? h("button", { type: "button", className: "wm-btn", onClick: () => onInstall(plugin) }, action.label)
              : null) : h("span", { className: "wm-hint" }, lang === "en" ? "No plugin manager in this deployment." : "当前部署没有插件管理器。")),
          plugin.installed?.status === "disabled" ? h("button", { type: "button", className: "wm-btn", onClick: () => onEnable(plugin, true) }, lang === "en" ? "Enable" : "启用") : null,
          plugin.installed?.status === "installed" || plugin.installed?.status === "disabled"
            ? h("button", { type: "button", className: "wm-btn danger", disabled: plugin.name === SELF, onClick: () => onRemove(plugin) }, lang === "en" ? "Uninstall" : "卸载")
            : null,
          h("div", { className: "wm-trust" },
            lang === "en"
              ? "Third-party plugins run with your permissions. Install only what you trust; the index is community data, not an audit."
              : "第三方插件会以你的权限运行。只安装你信得过的插件；目录内容来自第三方，不代表安全审计。")));
    }

    function ConfirmModal({ state, lang, busy, error, onClose, onConfirm }) {
      if (!state) return null;
      const plugin = state.plugin;
      const remove = state.mode === "remove";
      const update = state.mode === "update";
      const title = plugin.displayTitle || pick(plugin.title, lang) || plugin.name;
      return h("div", { className: "wm-overlay", onMouseDown: (event) => { if (event.target === event.currentTarget && !busy) onClose(); } },
        h("div", { className: "wm-modal wm-small", role: "dialog", "aria-modal": "true" },
          h("button", { type: "button", className: "wm-modal-close", disabled: busy, onClick: onClose }, "×"),
          h("div", { style: { display: "flex", gap: "12px", alignItems: "center", paddingRight: "28px" } },
            artwork(plugin),
            h("div", null,
              h("h3", { style: { margin: 0, fontSize: "15px" } }, remove ? (lang === "en" ? "Uninstall" : "卸载") : update ? (lang === "en" ? "Update" : "更新") : (lang === "en" ? "Install" : "安装")),
              h("div", { className: "wm-hint" }, title))),
          h("div", { style: { marginTop: "14px", fontSize: "12px", lineHeight: "19px", color: "var(--wm-sub)" } },
            remove
              ? (lang === "en" ? "This removes the package from the profile. The UI it provides disappears; a restart may be required." : "会从当前 profile 移除这个包，它提供的界面/工具会消失；可能需要重启 DSH。")
              : update
                ? (lang === "en" ? "Update removes the installed version first, then installs the selected one. A failed install can leave the plugin absent until you retry." : "更新会先移除已安装版本，再安装所选版本；如果安装失败，插件会处于未安装状态，需要重试。")
                : (lang === "en" ? "The exact package and version below will be downloaded and enabled." : "将下载并启用下面这个精确版本。")),
          !remove ? h("div", { className: "wm-code", style: { marginTop: "10px" } }, h("code", null, plugin.spec || `${plugin.name}@${state.version || plugin.version}`)) : null,
          !remove ? h("div", { className: "wm-banner", style: { marginTop: "10px" } },
            h("div", { className: "wm-banner-main" }, lang === "en" ? "Third-party code runs with your permissions. Confirm you trust this source." : "第三方代码会以你的权限运行，请确认你信任这个来源。")) : null,
          error ? h("div", { className: "wm-banner red", style: { marginTop: "10px" } }, h("div", { className: "wm-banner-main" }, error)) : null,
          h("div", { className: "wm-actions", style: { borderTop: 0, paddingTop: 0, marginTop: "16px" } },
            h("button", { type: "button", className: `wm-btn ${remove ? "danger" : ""}`, disabled: busy, onClick: onConfirm },
              busy ? (lang === "en" ? "Working…" : "处理中…") : remove ? (lang === "en" ? "Uninstall" : "确认卸载") : update ? (lang === "en" ? "Update" : "确认更新") : (lang === "en" ? "Install" : "确认安装")),
            h("button", { type: "button", className: "wm-btn ghost", disabled: busy, onClick: onClose }, lang === "en" ? "Cancel" : "取消"))));
    }

    function JobModal({ job, lang, onClose, onCancel }) {
      const terminal = ["done", "failed", "cancelled"].includes(job.phase);
      const [nowTick, setNowTick] = useState(Date.now());
      useEffect(() => {
        if (terminal) return undefined;
        const timer = setInterval(() => setNowTick(Date.now()), 500);
        return () => clearInterval(timer);
      }, [terminal]);
      const result = job.result?.install || job.result?.removed;
      const restart = result?.restartReason || (result?.application === "restart-required" ? "no-hmr" : undefined);
      const elapsed = Math.max(0, Math.round(((terminal ? job.updatedAt : nowTick) - job.startedAt) / 1000));
      const phaseText = job.phase === "done"
        ? (lang === "en" ? "Done" : "完成")
        : job.phase === "failed"
          ? (lang === "en" ? "Failed" : "失败")
          : job.phase === "cancelled"
            ? (lang === "en" ? "Cancelled" : "已取消")
            : job.phase === "applying"
              ? (lang === "en" ? "Enabling…" : "正在启用…")
              : (lang === "en" ? "Installing…" : "正在安装…");
      return h("div", { className: "wm-overlay" },
        h("div", { className: "wm-modal wm-small", role: "dialog", "aria-modal": "true" },
          h("button", { type: "button", className: "wm-modal-close", onClick: onClose }, "×"),
          h("h3", { style: { margin: "0 0 4px", fontSize: "15px" } }, job.kind === "uninstall" ? (lang === "en" ? "Uninstall" : "卸载") : (lang === "en" ? "Install" : "安装")),
          h("div", { className: "wm-hint" }, `${job.name}${job.version ? ` · v${job.version}` : ""}`),
          h("div", { className: "wm-progress" },
            terminal
              ? h("span", { style: { fontSize: "18px" } }, job.phase === "done" ? "✓" : job.phase === "cancelled" ? "·" : "×")
              : h("span", { className: "wm-spinner" }),
            h("div", null,
              h("div", { style: { fontWeight: 600 } }, phaseText),
              h("div", { className: "wm-hint" }, `${elapsed}s`))),
          restart ? h("div", { className: "wm-banner" }, h("div", { className: "wm-banner-main" },
            lang === "en" ? "Saved. Restart DSH to load the new plugin." : "已写入，但需要重启 DSH 才会加载新插件。")) : null,
          job.error ? h("div", { className: "wm-banner red", style: { marginTop: "8px" } }, h("div", { className: "wm-banner-main" }, job.error)) : null,
          result?.error?.code ? h("div", { className: "wm-hint", style: { marginTop: "6px" } }, `code: ${result.error.code}`) : null,
          job.logs?.length ? h("div", { className: "wm-logs" }, job.logs.slice(-90).map((line, index) => `${line.stream === "stderr" ? "! " : ""}${line.text}`).join("\n")) : null,
          h("div", { className: "wm-actions", style: { borderTop: 0, paddingTop: 0, marginTop: "14px" } },
            !terminal && job.kind === "install" ? h("button", { type: "button", className: "wm-btn ghost", onClick: onCancel }, lang === "en" ? "Cancel install" : "取消安装") : null,
            h("button", { type: "button", className: "wm-btn", onClick: onClose }, terminal ? (lang === "en" ? "Close" : "关闭") : (lang === "en" ? "Run in background" : "放到后台")))));
    }

    function SettingsDrawer({ lang, sources, cacheTtlMs, onClose, onAdd, onToggle, onRemove, onRefresh, onRestore, busy }) {
      const [url, setUrl] = useState("");
      const [title, setTitle] = useState("");
      const [formError, setFormError] = useState("");
      const [adding, setAdding] = useState(false);
      const add = async () => {
        setFormError("");
        if (!/^https?:\/\//i.test(url.trim())) {
          setFormError(lang === "en" ? "Enter an http(s) URL." : "请输入 http(s) 地址。");
          return;
        }
        setAdding(true);
        try {
          await onAdd(url.trim(), title.trim());
          setUrl("");
          setTitle("");
        } catch (error) {
          setFormError(error.message);
        } finally {
          setAdding(false);
        }
      };
      return h("div", { className: "wm-drawer-overlay", onMouseDown: (event) => { if (event.target === event.currentTarget) onClose(); } },
        h("aside", { className: "wm-drawer", role: "dialog", "aria-modal": "true" },
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
            h("div", null,
              h("h4", null, lang === "en" ? "Index sources" : "目录源"),
              h("div", { className: "wm-hint" }, lang === "en" ? "A market is one format-1 JSON index. Add any index URL you trust." : "一个市场就是一个 format 1 JSON 目录。添加你信任的目录地址。")),
            h("button", { type: "button", className: "wm-iconbtn", onClick: onClose }, "×")),
          h("div", { style: { marginTop: "14px" } },
            sources && sources.length
              ? sources.map((source) => h("div", { className: "wm-source", key: source.id },
                h("div", { className: "wm-source-main" },
                  h("div", { className: "wm-source-title" },
                    h("span", { className: `wm-dot ${source.ok === false ? "bad" : source.stale ? "warn" : ""}` }),
                    h("span", null, source.title || source.id),
                    source.enabled === false ? h(Badge, null, lang === "en" ? "off" : "关闭") : null,
                    source.count ? h(Badge, null, `${source.count}`) : null),
                  h("div", { className: "wm-source-url" }, source.url),
                  source.error ? h("div", { className: "wm-source-err" }, source.error) : null),
                h("div", { style: { display: "flex", gap: "6px", alignItems: "center" } },
                  h(Switch, { on: source.enabled !== false, onClick: () => onToggle(source) }),
                  h("button", { type: "button", className: "wm-btn ghost sm", disabled: busy, onClick: () => onRemove(source) }, lang === "en" ? "Remove" : "移除"))))
              : h("div", { className: "wm-empty" }, lang === "en" ? "No sources. The curated list still works offline." : "还没有目录源。精选列表仍然可以离线使用。")),
          h("div", { className: "wm-form" },
            h("h5", { style: { margin: "4px 0 0", fontSize: "12px" } }, lang === "en" ? "Add a source" : "添加目录源"),
            h("input", { value: url, onChange: (event) => setUrl(event.target.value), placeholder: "https://example.com/market.json", spellCheck: false }),
            h("input", { value: title, onChange: (event) => setTitle(event.target.value), placeholder: lang === "en" ? "Display name (optional)" : "显示名称（可选）" }),
            formError ? h("div", { className: "wm-source-err" }, formError) : null,
            h("div", { className: "wm-form-row" },
              h("button", { type: "button", className: "wm-btn", disabled: adding || busy, onClick: add }, adding ? (lang === "en" ? "Adding…" : "添加中…") : (lang === "en" ? "Add" : "添加")),
              h("button", { type: "button", className: "wm-btn ghost", disabled: busy, onClick: onRestore }, lang === "en" ? "Restore public source" : "恢复公共源"))),
          h("div", { style: { marginTop: "18px", paddingTop: "14px", borderTop: ".5px solid var(--wm-border)" } },
            h("div", { className: "wm-hint" },
              lang === "en"
                ? `Cache lifetime: ${Math.round((cacheTtlMs || 0) / 3600000)}h. The curated list is bundled and always available.`
                : `缓存 ${Math.round((cacheTtlMs || 0) / 3600000)} 小时；精选目录随插件打包，离线也能用。`),
            h("div", { className: "wm-form-row", style: { marginTop: "10px" } },
              h("button", { type: "button", className: "wm-btn", disabled: busy, onClick: onRefresh }, busy ? (lang === "en" ? "Refreshing…" : "刷新中…") : (lang === "en" ? "Refresh now" : "立即刷新")),
              h("button", { type: "button", className: "wm-btn ghost", onClick: onClose }, lang === "en" ? "Done" : "完成"))),
          h("div", { className: "wm-trust" },
            lang === "en"
              ? "Indexes are third-party content. This page only reads them; installation still runs the package's own code."
              : "目录内容是第三方数据。这个页面只负责读取；安装后运行的仍然是插件自己的代码。")));
    }

    function Toast({ text }) {
      return h("div", { className: "wm-toast" }, text);
    }

    function WhaleMarketPage() {
      useStyleOnce();
      const lang = useMemo(currentLang, []);
      const L = (zh, en) => (lang === "en" ? en : zh);

      const [boot, setBoot] = useState(null);
      const [items, setItems] = useState([]);
      const [total, setTotal] = useState(0);
      const [counts, setCounts] = useState(null);
      const [categories, setCategories] = useState([]);
      const [sources, setSources] = useState([]);
      const [fetchedAt, setFetchedAt] = useState(null);
      const [query, setQuery] = useState("");
      const [search, setSearch] = useState("");
      const [category, setCategory] = useState("all");
      const [sort, setSort] = useState("recommended");
      const [onlyInstalled, setOnlyInstalled] = useState(false);
      const [loading, setLoading] = useState(true);
      const [loadingMore, setLoadingMore] = useState(false);
      const [refreshing, setRefreshing] = useState(false);
      const [error, setError] = useState("");
      const [detail, setDetail] = useState(null);
      const [confirm, setConfirm] = useState(null);
      const [confirmBusy, setConfirmBusy] = useState(false);
      const [confirmError, setConfirmError] = useState("");
      const [job, setJob] = useState(null);
      const [settings, setSettings] = useState(false);
      const [toast, setToast] = useState(null);
      const [refreshKey, setRefreshKey] = useState(0);
      const seq = useRef(0);
      const toastTimer = useRef(null);

      const showToast = useCallback((text) => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ text, id: Date.now() });
        toastTimer.current = setTimeout(() => setToast(null), 3600);
      }, []);
      useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

      const canManage = boot?.app?.manage !== false;
      const profile = boot?.app?.profile || "desktop";

      useEffect(() => {
        let alive = true;
        api("/bootstrap")
          .then((data) => {
            if (!alive) return;
            setBoot(data);
            setCounts(data.counts);
            setCategories(data.categories || []);
            setSources(data.sources || []);
            setFetchedAt(data.fetchedAt);
          })
          .catch((err) => { if (alive) setError(err.message); });
        return () => { alive = false; };
      }, []);

      useEffect(() => {
        const timer = setTimeout(() => setSearch(query.trim()), 220);
        return () => clearTimeout(timer);
      }, [query]);

      const loadPage = useCallback(async (offset, replace) => {
        const id = ++seq.current;
        if (replace) { setLoading(true); setError(""); } else { setLoadingMore(true); }
        try {
          const params = new URLSearchParams({ q: search, category, sort, offset: String(offset), limit: "60" });
          if (onlyInstalled) params.set("installed", "1");
          const data = await api(`/catalog?${params.toString()}`);
          if (id !== seq.current) return;
          setItems((prev) => (replace ? data.plugins : [...prev, ...data.plugins]));
          setTotal(data.total);
          setCounts(data.counts);
          setCategories(data.categories || []);
          setSources(data.sources || []);
          setFetchedAt(data.fetchedAt);
        } catch (err) {
          if (id === seq.current) setError(err.message);
        } finally {
          if (id === seq.current) { setLoading(false); setLoadingMore(false); }
        }
      }, [search, category, sort, onlyInstalled]);

      useEffect(() => { loadPage(0, true); }, [loadPage, refreshKey]);

      const refreshAll = useCallback(async () => {
        try {
          const data = await api("/bootstrap");
          setBoot(data);
          setCounts(data.counts);
          setCategories(data.categories || []);
          setSources(data.sources || []);
          setFetchedAt(data.fetchedAt);
          setRefreshKey((key) => key + 1);
        } catch (err) {
          setError(err.message);
        }
      }, []);

      const refreshCatalog = useCallback(async () => {
        setRefreshing(true);
        setError("");
        try {
          await api("/refresh", { method: "POST", body: JSON.stringify({}) });
          await refreshAll();
          showToast(L("目录已刷新", "Index refreshed"));
        } catch (err) {
          setError(err.message);
        } finally {
          setRefreshing(false);
        }
      }, [L, refreshAll, showToast]);

      const openDetail = useCallback(async (plugin) => {
        setDetail({ ...plugin, loading: true });
        try {
          const data = await api(`/entry?name=${encodeURIComponent(plugin.name)}`);
          setDetail({ ...data.plugin, loading: false });
        } catch (err) {
          setDetail(null);
          showToast(err.message);
        }
      }, [showToast]);

      const askInstall = useCallback((plugin, version) => {
        if (!canManage) { showToast(L("当前部署没有插件管理器", "No plugin manager in this deployment")); return; }
        const mode = plugin.installed?.update ? "update" : "install";
        setConfirm({ mode, plugin, version: version || plugin.version });
        setConfirmError("");
      }, [canManage, L, showToast]);

      const askRemove = useCallback((plugin) => {
        setConfirm({ mode: "remove", plugin });
        setConfirmError("");
      }, []);

      const runConfirm = useCallback(async () => {
        if (!confirm) return;
        setConfirmBusy(true);
        setConfirmError("");
        try {
          const plugin = confirm.plugin;
          const data = confirm.mode === "remove"
            ? await api("/uninstall", { method: "POST", body: JSON.stringify({ name: plugin.name }) })
            : await api("/install", { method: "POST", body: JSON.stringify({ name: plugin.name, version: confirm.version || plugin.version }) });
          setConfirm(null);
          setDetail(null);
          if (data.job) setJob(data.job);
          else { showToast(L("操作已完成", "Done")); await refreshAll(); }
        } catch (err) {
          setConfirmError(err.message);
        } finally {
          setConfirmBusy(false);
        }
      }, [confirm, L, refreshAll, showToast]);

      const enablePlugin = useCallback(async (plugin, enabled) => {
        try {
          await api("/enable", { method: "POST", body: JSON.stringify({ name: plugin.name, enabled }) });
          showToast(enabled ? L("已启用", "Enabled") : L("已停用", "Disabled"));
          await refreshAll();
        } catch (err) {
          showToast(err.message);
        }
      }, [L, refreshAll, showToast]);

      // 轮询安装任务
      useEffect(() => {
        if (!job || ["done", "failed", "cancelled"].includes(job.phase)) return undefined;
        let stopped = false;
        const tick = async () => {
          try {
            const data = await api(`/job?id=${encodeURIComponent(job.id)}`);
            if (stopped) return;
            setJob(data.job);
            if (["done", "failed", "cancelled"].includes(data.job.phase)) {
              clearInterval(timer);
              await refreshAll();
            }
          } catch {}
        };
        const timer = setInterval(tick, 900);
        tick();
        return () => { stopped = true; clearInterval(timer); };
      }, [job?.id, refreshAll]);

      const cancelJob = useCallback(async () => {
        if (!job) return;
        try {
          const data = await api("/job/cancel", { method: "POST", body: JSON.stringify({ id: job.id }) });
          showToast(data.result?.status === "too-late" ? L("已经进入启用阶段，取消失败", "Too late to cancel") : L("已请求取消", "Cancellation requested"));
        } catch (err) {
          showToast(err.message);
        }
      }, [job, L, showToast]);

      const addSource = useCallback(async (url, title) => {
        await api("/sources", { method: "POST", body: JSON.stringify({ url, title }) });
        await refreshAll();
        showToast(L("目录源已添加", "Source added"));
      }, [L, refreshAll, showToast]);

      const toggleSource = useCallback(async (source) => {
        try {
          await api("/sources/toggle", { method: "POST", body: JSON.stringify({ id: source.id, enabled: source.enabled === false }) });
          await refreshAll();
        } catch (err) { showToast(err.message); }
      }, [refreshAll, showToast]);

      const removeSource = useCallback(async (source) => {
        try {
          await api("/sources/remove", { method: "POST", body: JSON.stringify({ id: source.id }) });
          await refreshAll();
          showToast(L("目录源已移除", "Source removed"));
        } catch (err) { showToast(err.message); }
      }, [L, refreshAll, showToast]);

      const restorePublic = useCallback(async () => {
        try {
          await api("/sources", {
            method: "POST",
            body: JSON.stringify({ url: "https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json", title: "公共插件目录" }),
          });
          await refreshAll();
          showToast(L("公共源已恢复", "Public source restored"));
        } catch (err) {
          if (err.status === 409) showToast(L("公共源已经在列表里了", "The public source is already listed"));
          else showToast(err.message);
        }
      }, [L, refreshAll, showToast]);

      const closeJob = useCallback(() => {
        const terminal = job && ["done", "failed", "cancelled"].includes(job.phase);
        setJob(null);
        if (terminal) refreshAll();
      }, [job, refreshAll]);

      const allCount = counts?.total ?? totalCount(categories);
      const installedCount = counts?.installed ?? 0;
      const updates = counts?.updates ?? 0;
      const curatedCount = counts?.curated ?? 0;
      const sourceErrors = (sources || []).filter((source) => source.ok === false && source.error);
      const activeCategories = (categories || []).filter((cat) => cat.count > 0 || cat.id === "personal");
      const busy = !!job && !["done", "failed", "cancelled"].includes(job.phase);

      const resetFilters = () => {
        setQuery("");
        setSearch("");
        setCategory("all");
        setSort("recommended");
        setOnlyInstalled(false);
      };

      return h("div", { className: "wm" },
        h("section", { className: "wm-hero" },
          h("div", { className: "wm-head" },
            h("div", { className: "wm-brand" },
              h("div", { className: "wm-logo" }, "鲸"),
              h("div", null,
                h("h2", { className: "wm-name" }, L("鲸市", "Whale Market")),
                h("div", { className: "wm-tag" }, "WHALE MARKET · PLUGINS FOR DSH"),
                h("p", { className: "wm-sub" },
                  L(
                    "给 DSH 自己用的插件市场。精选、公共目录和本地插件放在一个地方；搜索、看详情、一键安装。",
                    "A personal plugin market for DSH. Curated picks, public indexes, and local plugins in one place.",
                  )))),
            h("div", { className: "wm-head-actions" },
              h("button", { type: "button", className: "wm-iconbtn", onClick: refreshCatalog, disabled: refreshing || loading, title: L("刷新目录", "Refresh index") },
                h("span", { className: refreshing ? "wm-spin" : "" }, "↻"),
                refreshing ? L("刷新中", "Refreshing") : L("刷新", "Refresh")),
              h("button", { type: "button", className: "wm-iconbtn", onClick: () => setSettings(true), title: L("目录设置", "Index settings") }, "⚙", L("设置", "Settings")))),
          h("div", { className: "wm-stats" },
            h("span", null, L("精选 ", "Curated "), h("b", null, String(curatedCount))),
            h("span", null, L("收录 ", "Indexed "), h("b", null, String(allCount))),
            h("span", null, L("已安装 ", "Installed "), h("b", null, String(installedCount))),
            updates ? h("span", { className: "wm-amber" }, L("可更新 ", "Updates "), h("b", null, String(updates))) : null,
            fetchedAt ? h("span", null, L("目录更新于 ", "Indexed "), fmtRelative(fetchedAt, lang)) : null,
            boot?.app?.version ? h("span", null, `· v${boot.app.version}`) : null)),
        error ? h("div", { className: "wm-banner red" },
          h("div", { className: "wm-banner-main" }, error),
          h("button", { type: "button", className: "wm-btn ghost sm", onClick: () => loadPage(0, true) }, L("重试", "Retry"))) : null,
        sourceErrors.length ? h("div", { className: "wm-banner" },
          h("div", { className: "wm-banner-main" },
            L("有目录读取失败：", "A source failed: "),
            `${sourceErrors[0].title || sourceErrors[0].id} — ${sourceErrors[0].error}`,
            sourceErrors[0].stale ? L("（正在使用上次缓存）", " (using cached copy)") : ""),
          h("button", { type: "button", className: "wm-btn ghost sm", onClick: () => setSettings(true) }, L("查看", "Details"))) : null,
        !canManage ? h("div", { className: "wm-banner" },
          h("div", { className: "wm-banner-main" }, boot?.app?.managerError || L("当前部署没有插件管理器，只能浏览。", "No plugin manager: browsing only."))) : null,
        h("div", { className: "wm-toolbar" },
          h("div", { className: "wm-search" },
            h("span", { className: "wm-si" }, "⌕"),
            h("input", {
              value: query,
              onChange: (event) => setQuery(event.target.value),
              onKeyDown: (event) => { if (event.key === "Enter") setSearch(query.trim()); },
              placeholder: L("搜插件名、作者、关键词…", "Search plugins, authors, keywords…"),
              spellCheck: false,
            }),
            query ? h("button", { type: "button", className: "wm-clear", onClick: () => setQuery(""), "aria-label": L("清空", "Clear") }, "×") : null),
          h("select", { className: "wm-select", value: sort, onChange: (event) => setSort(event.target.value), "aria-label": L("排序", "Sort") },
            h("option", { value: "recommended" }, L("推荐", "Recommended")),
            h("option", { value: "latest" }, L("最新发布", "Newest")),
            h("option", { value: "name" }, L("按名称", "Name")),
            h("option", { value: "installed" }, L("已安装优先", "Installed first"))),
          h("label", { className: "wm-switch-wrap" },
            h("input", { type: "checkbox", checked: onlyInstalled, onChange: (event) => setOnlyInstalled(event.target.checked), style: { display: "none" } }),
            h("span", { style: { width: "13px", height: "13px", borderRadius: "4px", border: "1px solid var(--wm-border)", display: "inline-grid", placeItems: "center", fontSize: "10px" } }, onlyInstalled ? "✓" : ""),
            L("只看已安装", "Installed only"))),
        h("div", { className: "wm-chips" },
          h("button", { type: "button", className: `wm-chip ${category === "all" ? "on" : ""}`, onClick: () => setCategory("all") },
            L("全部", "All"), h("em", null, String(allCount))),
          h("button", { type: "button", className: `wm-chip ${category === "featured" ? "on" : ""}`, onClick: () => setCategory("featured") },
            L("精选", "Picks"), h("em", null, String(curatedCount))),
          activeCategories.some((cat) => cat.id === "personal") ? h("button", {
            type: "button",
            className: `wm-chip ${category === "personal" ? "on" : ""}`,
            onClick: () => setCategory("personal"),
          }, L("我的", "Mine"), h("em", null, String(activeCategories.find((cat) => cat.id === "personal").count))) : null,
          activeCategories.filter((cat) => cat.id !== "personal").map((cat) => h("button", {
            type: "button",
            key: cat.id,
            className: `wm-chip ${category === cat.id ? "on" : ""}`,
            onClick: () => setCategory(cat.id),
          }, categoryTitle(categories, cat.id, lang), h("em", null, String(cat.count))))),
        h("div", { className: "wm-sourcebar" },
          h("span", null, L("目录：", "Sources: "), (sources || []).filter((source) => source.enabled !== false).map((source) => source.title || source.id).join(" · ") || L("仅精选", "curated only")),
          h("span", null, L("共 ", "Total "), String(total))),
        h("div", { className: "wm-grid" },
          loading
            ? Array.from({ length: 6 }).map((_, index) => h(SkeletonCard, { key: `sk-${index}` }))
            : items.length
              ? items.map((plugin) => h(Card, {
                  key: plugin.name,
                  plugin,
                  lang,
                  categories,
                  disabled: busy || !canManage,
                  onOpen: openDetail,
                  onInstall: askInstall,
                  onEnable: (item) => enablePlugin(item, true),
                }))
              : h("div", { className: "wm-empty", style: { gridColumn: "1 / -1" } },
                  h("h4", null, L("没有找到匹配的插件", "No matching plugins")),
                  h("div", null, L("换个关键词，或把筛选清掉。", "Try another keyword or clear the filters.")),
                  h("div", { style: { marginTop: "12px" } },
                    h("button", { type: "button", className: "wm-btn ghost", onClick: resetFilters }, L("清空筛选", "Clear filters"))))),
        !loading && items.length && total > items.length
          ? h("div", { className: "wm-more" },
              h("button", { type: "button", className: "wm-btn ghost", disabled: loadingMore, onClick: () => loadPage(items.length, false) },
                loadingMore ? L("加载中…", "Loading…") : L(`加载更多（还有 ${total - items.length} 个）`, `Show more (${total - items.length})`)))
          : null,
        h("div", { className: "wm-footer" },
          h("span", null, L("目录是第三方数据；安装前请确认来源。", "Index data is third-party. Check the source before installing.")),
          h("span", null, `鲸市 v${boot?.app?.version || "0.1.0"} · ${profile}`)),
        detail ? h(DetailModal, {
          plugin: detail,
          lang,
          categories,
          loading: !!detail.loading,
          canManage,
          profile,
          onClose: () => setDetail(null),
          onInstall: askInstall,
          onRemove: askRemove,
          onEnable: enablePlugin,
        }) : null,
        confirm ? h(ConfirmModal, {
          state: confirm,
          lang,
          busy: confirmBusy,
          error: confirmError,
          onClose: () => { if (!confirmBusy) { setConfirm(null); setConfirmError(""); } },
          onConfirm: runConfirm,
        }) : null,
        job ? h(JobModal, { job, lang, onClose: closeJob, onCancel: cancelJob }) : null,
        settings ? h(SettingsDrawer, {
          lang,
          sources,
          cacheTtlMs: boot?.config?.cacheTtlMs,
          busy: refreshing,
          onClose: () => setSettings(false),
          onAdd: addSource,
          onToggle: toggleSource,
          onRemove: removeSource,
          onRefresh: refreshCatalog,
          onRestore: restorePublic,
        }) : null,
        toast ? h(Toast, { text: toast.text }) : null);
    }

    function apply(ctx) {
      ctx.effect(() => ctx.slots.inject("plugins.tab", () => ctx.slots.register({
        name: "plugins.tab",
        id: "whale-market",
        label: () => "鲸市",
        order: 4,
      }, WhaleMarketPage)), "whale-market: plugins tab");
    }

    const inject = ["slots"];
    exports.apply = apply;
    exports.inject = inject;
    exports.WhaleMarketPage = WhaleMarketPage;
    return module.exports;
  },
});
