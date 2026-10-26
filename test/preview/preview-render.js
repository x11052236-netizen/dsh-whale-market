const React = window.React;
const { createRoot } = window.ReactDOM;
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(window.__WM_MODULE__.WhaleMarketPage));

const view = new URLSearchParams(location.search).get("view") || location.hash.replace(/^#/, "");
if (view) {
  setTimeout(() => {
    if (view === "detail") document.querySelector(".wm-card")?.click();
    if (view === "settings") {
      const buttons = [...document.querySelectorAll(".wm-iconbtn")];
      buttons.find((button) => button.textContent.includes("设置"))?.click();
    }
    if (view === "detail2") {
      const cards = [...document.querySelectorAll(".wm-card")];
      cards[4]?.click();
    }
    if (view === "confirm") {
      const cards = [...document.querySelectorAll(".wm-card")];
      cards[4]?.click();
      setTimeout(() => {
        [...document.querySelectorAll(".wm-actions .wm-btn")].find((button) => /^安装$/.test(button.textContent.trim()))?.click();
      }, 500);
    }
    if (view === "job") {
      const cards = [...document.querySelectorAll(".wm-card")];
      cards[4]?.click();
      setTimeout(() => {
        [...document.querySelectorAll(".wm-actions .wm-btn")].find((button) => /^安装$/.test(button.textContent.trim()))?.click();
        setTimeout(() => {
          [...document.querySelectorAll(".wm-actions .wm-btn")].find((button) => /确认安装/.test(button.textContent))?.click();
        }, 500);
      }, 500);
    }
  }, 700);
}
