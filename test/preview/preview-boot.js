window.__ModuleLoader__ = {
  load({ factory }) {
    window.__WM_MODULE__ = factory((name) => {
      if (name === "react") return window.React;
      throw new Error(`unexpected require: ${name}`);
    });
  },
};

window.fetch = async (url) => {
  const data = window.__WM_MOCK__;
  const path = String(url);
  const json = (value) => ({ ok: true, status: 200, json: async () => value });
  if (path.includes("/bootstrap")) return json(data.boot);
  if (path.includes("/catalog")) return json(data.page);
  if (path.includes("/entry")) {
    const name = decodeURIComponent(path.split("name=")[1] || "");
    return json({ ok: true, plugin: data.entry[name] || data.page.plugins[0] });
  }
  if (path.includes("/job")) return json({ ok: true, job: { id: "job-1", kind: "install", name: "dshmarket", version: "1.70.2", phase: "done", startedAt: Date.now() - 12000, updatedAt: Date.now(), logs: [], result: { install: { application: "restart-required", restartReason: "no-hmr" } } } });
  return json({ ok: true, job: { id: "job-1", kind: "install", name: "dshmarket", version: "1.70.2", phase: "installing", startedAt: Date.now(), updatedAt: Date.now(), logs: [] } });
};
