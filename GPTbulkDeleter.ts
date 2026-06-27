// ==UserScript==
// @name         ChatGPT Bulk Delete (API + Ctrl Multi-Select)
// @namespace    https://github.com/MA-PNP/GPTbulkDeleter/
// @author       MA-PNP
// @version      6.1.1
// @description  Bulk-delete ChatGPT conversations via API. Multi-select, select all, counter, auto-scroll/select/delete. v6.1: fixed freeze & unresponsive popup.
// @match        https://chatgpt.com/*
// @connect      chatgpt.com
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  console.log("[BulkDelete] Script loaded v6.1");

  // ──── Constants ────
  const HISTORY_SELECTOR = "#history";
  const ROW_SELECTOR = 'a[href^="/c/"]';
  const PANEL_ID = "bulkDeletePanel";
  const SCROLL_STEP = 350;
  const SCROLL_INTERVAL = 1800;
  const MAX_SCROLLS = 500;

  // ──── State ────
  let authToken = null;
  let autoScrollTimer = null;
  let autoDeleteBusy = false;
  let isAutoLooping = false;
  let scrollCount = 0;
  let scrollContainer = null;
  let obsDebounce = null;

  // ──── Utilities ────
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function gmRequest(options) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        ...options,
        onload: (r) => resolve(r),
        onerror: (e) => reject(e),
      });
    });
  }

  async function getAuthToken() {
    if (authToken) return authToken;
    try {
      const res = await gmRequest({
        method: "GET",
        url: "https[118;1:3u://chatgpt.com/api/auth/session",
      });
      const data = JSON.parse(res.responseText || "{}");
      if (data && data.accessToken) {
        authToken = data.accessToken;
        return authToken;
      }
      throw new Error("accessToken missing");
    } catch (err) {
      console.error("[BulkDelete] Auth failed", err);
      GM_notification({
        title: "ChatGPT Bulk Delete",
        text: "Auth failed. Are you logged in?",
        timeout: 6000,
      });
      return null;
    }
  }

  async function waitForEl(sel) {
    let el;
    while (!(el = document.querySelector(sel))) await sleep(100);
    return el;
  }

  // ──── Scroll Container ────
  function findScrollContainer() {
    const history = document.querySelector(HISTORY_SELECTOR);
    if (!history) return null;
    let el = history.parentElement;
    while (el && el !== document.body) {
      const s = window.getComputedStyle(el);
      const overflowY = s.overflowY;
      // Find element that actually scrolls
      if (overflowY === "auto" || overflowY === "scroll") {
        return el;
      }
      // Also check max-height + overflow
      if (
        s.maxHeight &&
        s.maxHeight !== "none" &&
        (overflowY === "auto" || s.overflow === "auto")
      ) {
        return el;
      }
      el = el.parentElement;
    }
    // Last resort: the history element itself or its parent
    return history.parentElement;
  }

  function getScrollContainer() {
    if (scrollContainer && document.body.contains(scrollContainer))
      return scrollContainer;
    scrollContainer = findScrollContainer();
    return scrollContainer;
  }

  // ──── Panel UI ────
  function injectUI(container) {
    if (document.getElementById(PANEL_ID)) return;

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText =
      "padding:10px 10px 8px;background:#1a1a2e;border-bottom:1px solid rgba(255,255,255,0.12);margin-bottom:6px;border-radius:0 0 8px 8px;";

    // Row 1 — Counter + Select All + Delete
    const r1 = document.createElement("div");
    r1.style.cssText =
      "display:flex;align-items:center;gap:6px;margin-bottom:5px;";

    const cnt = document.createElement("span");
    cnt.id = "bulkCounter";
    cnt.textContent = "0/0";
    cnt.style.cssText =
      "font-size:13px;font-weight:700;color:#e2e8f0;min-width:38px;text-align:center;";

    const selBtn = document.createElement("button");
    selBtn.id = "selectAllBtn";
    selBtn.textContent = "☐ Select All";
    selBtn.style.cssText =
      "flex:1;padding:7px 10px;background:#334155;border:none;border-radius:6px;color:#e2e8f0;cursor:pointer;font-size:12px;font-weight:600;";
    selBtn.addEventListener("click", () => {
      const all = document.querySelectorAll(".bulkCheck");
      const chk = document.querySelectorAll(".bulkCheck:checked");
      const on = chk.length < all.length;
      all.forEach((cb) => {
        cb.checked = on;
      });
      selBtn.textContent = on ? "☑ Deselect" : "☐ Select All";
      refreshUI();
    });

    const delBtn = document.createElement("button");
    delBtn.id = "bulkDeleteButton";
    delBtn.textContent = "Delete";
    delBtn.style.cssText =
      "flex:1;padding:7px 10px;background:#dc2626;border:none;border-radius:6px;color:white;cursor:pointer;font-size:12px;font-weight:700;";
    delBtn.addEventListener("click", () => bulkDelete());

    r1.append(cnt, selBtn, delBtn);

    // Row 2 — Auto-toggles + status
    const r2 = document.createElement("div");
    r2.style.cssText =
      "display:flex;align-items:center;gap:5px;font-size:11px;color:#94a3b8;flex-wrap:wrap;";

    function tog(id, label, def) {
      const l = document.createElement("label");
      l.style.cssText =
        "display:flex;align-items:center;gap:3px;cursor:pointer;padding:2px 5px;border-radius:4px;";
      const c = document.createElement("input");
      c.type = "checkbox";
      c.id = id;
      c.checked = def;
      c.style.cssText = "margin:0;accent-color:#3b82f6;";
      l.append(c, label);
      return l;
    }

    const st = document.createElement("span");
    st.id = "bulkStatus";
    st.textContent = "● Idle";
    st.style.cssText = "margin-left:auto;font-size:10px;color:#64748b;";

    r2.append(
      tog("autoScrollCheck", "▶ Auto-scroll", false),
      tog("autoSelectCheck", "☑ Auto-select", true),
      tog("autoDeleteCheck", "✕ Auto-delete", false),
      st,
    );

    r2.querySelector("#autoScrollCheck").addEventListener(
      "change",
      function () {
        if (this.checked) startAutoLoop();
        else stopAutoLoop();
      },
    );

    panel.append(r1, r2);
    container.prepend(panel);
    refreshUI();
    setStatus("Idle");
  }

  function setStatus(t) {
    const e = document.getElementById("bulkStatus");
    if (e) e.textContent = "● " + t;
  }

  function refreshUI() {
    const all = document.querySelectorAll(".bulkCheck").length;
    const sel = document.querySelectorAll(".bulkCheck:checked").length;
    const cnt = document.getElementById("bulkCounter");
    if (cnt) cnt.textContent = sel + "/" + all;
    const btn = document.getElementById("bulkDeleteButton");
    if (btn) btn.textContent = sel ? "Delete (" + sel + ")" : "Delete";
  }

  // ──── Checkboxes ────
  function addCheckboxes(container) {
    const rows = container.querySelectorAll(ROW_SELECTOR);
    let changed = false;
    rows.forEach((row) => {
      if (row.querySelector(".bulkCheck")) return;
      const titleDiv =
        row.querySelector("div.truncate") ||
        row.querySelector("div.flex") ||
        row.firstElementChild;
      if (!titleDiv) return;
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "bulkCheck";
      cb.style.cssText =
        "margin-right:6px;transform:scale(1.1);cursor:pointer;flex-shrink:0;";
      cb.addEventListener("click", (e) => e.stopPropagation());
      row.addEventListener(
        "click",
        (e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            cb.checked = !cb.checked;
            refreshUI();
          }
        },
        true,
      );
      titleDiv.prepend(cb);
      changed = true;
    });
    if (changed) refreshUI();
  }

  // ──── Auto Loop ────
  function startAutoLoop() {
    if (isAutoLooping) return;
    isAutoLooping = true;
    scrollCount = 0;
    scrollContainer = null; // Re-find on first tick
    setStatus("▶ Auto-running...");
    console.log("[BulkDelete] Auto-loop started");
    // Small delay before start to let UI settle
    autoScrollTimer = setTimeout(autoScrollTick, 800);
  }

  function stopAutoLoop() {
    isAutoLooping = false;
    if (autoScrollTimer) {
      clearTimeout(autoScrollTimer);
      autoScrollTimer = null;
    }
    const toggle = document.getElementById("autoScrollCheck");
    if (toggle && !autoDeleteBusy) toggle.checked = false;
    setStatus("Idle");
    console.log("[BulkDelete] Auto-loop stopped");
  }

  async function autoScrollTick() {
    if (!isAutoLooping) return;

    // Safety: max scrolls reached
    if (scrollCount >= MAX_SCROLLS) {
      console.log("[BulkDelete] Max scrolls reached, stopping");
      setStatus("■ Max scrolls (" + MAX_SCROLLS + ") reached");
      stopAutoLoop();
      return;
    }
    scrollCount++;

    const el = getScrollContainer();
    if (!el || !document.body.contains(el)) {
      // Container went away, try to re-find
      scrollContainer = null;
      if (!getScrollContainer()) {
        setStatus("⚠ No scroll container");
        autoScrollTimer = setTimeout(autoScrollTick, 2000);
        return;
      }
    }

    const maxScroll = el.scrollHeight - el.clientHeight;
    const currentScroll = el.scrollTop;
    const atBottom = maxScroll - currentScroll < 80;

    if (atBottom) {
      console.log(
        "[BulkDelete] Bottom reached (scroll " +
          currentScroll +
          "/" +
          maxScroll +
          ")",
      );

      // Auto-select remaining
      if (document.getElementById("autoSelectCheck")?.checked) {
        document.querySelectorAll(".bulkCheck:not(:checked)").forEach((cb) => {
          cb.checked = true;
        });
        refreshUI();
      }

      // Auto-delete if enabled
      if (
        document.getElementById("autoDeleteCheck")?.checked &&
        !autoDeleteBusy
      ) {
        autoDeleteBusy = true;
        setStatus("✕ Deleting...");
        await bulkDelete();
        autoDeleteBusy = false;

        if (isAutoLooping) {
          // After delete, scroll to top and restart
          setStatus("↻ Resetting...");
          el.scrollTop = 0;
          scrollCount = 0;
          await sleep(1500);
          autoScrollTimer = setTimeout(autoScrollTick, 800);
        }
        return;
      }

      // No auto-delete — stop
      setStatus("■ Done (bottom)");
      isAutoLooping = false;
      const toggle = document.getElementById("autoScrollCheck");
      if (toggle) toggle.checked = false;
      return;
    }

    // Scroll down instantly — NO smooth scrolling (causes React re-render storms)
    el.scrollTop = Math.min(currentScroll + SCROLL_STEP, maxScroll);
    console.log("[BulkDelete] Scrolled " + el.scrollTop + "/" + maxScroll);

    // Wait for ChatGPT to lazy-load rows
    await sleep(SCROLL_INTERVAL);

    // Auto-select newly loaded items (batch update — no per-checkbox events)
    if (document.getElementById("autoSelectCheck")?.checked) {
      document.querySelectorAll(".bulkCheck:not(:checked)").forEach((cb) => {
        cb.checked = true;
      });
      refreshUI();
    }

    // Check if we got stuck (scroll didn't advance)
    if (
      isAutoLooping &&
      el.scrollTop <= currentScroll + 5 &&
      el.scrollTop < maxScroll - 80
    ) {
      // Might be at a loading boundary — wait longer
      console.log("[BulkDelete] Scroll stuck, waiting more...");
      await sleep(3000);
    }

    if (isAutoLooping) {
      autoScrollTimer = setTimeout(autoScrollTick, 400);
    }
  }

  // ──── Deletion ────
  async function deleteConversation(id) {
    const token = await getAuthToken();
    if (!token) throw new Error("No auth token");
    const res = await gmRequest({
      method: "PATCH",
      url: "https://chatgpt.com/backend-api/conversation/" + id,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      data: JSON.stringify({ is_visible: false }),
    });
    if (res.status < 200 || res.status >= 300)
      throw new Error("Status " + res.status);
  }

  async function bulkDelete() {
    const selected = [...document.querySelectorAll(".bulkCheck:checked")];
    if (!selected.length) {
      setStatus("Nothing selected");
      return;
    }

    const count = selected.length;
    const isAuto = document.getElementById("autoDeleteCheck")?.checked;
    if (!isAuto && !confirm("Delete " + count + " chats?")) return;

    const btn = document.getElementById("bulkDeleteButton");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Deleting " + count + "...";
    }
    setStatus("Deleting " + count + "...");

    let success = 0,
      failed = 0;
    for (let i = 0; i < selected.length; i++) {
      const cb = selected[i];
      const row = cb.closest('a[href^="/c/"]');
      if (!row || !document.body.contains(row)) {
        failed++;
        continue;
      }
      const convId = (row.getAttribute("href") || "").split("/").pop();
      try {
        await deleteConversation(convId);
        row.style.transition = "opacity 0.3s, transform 0.3s";
        row.style.opacity = "0";
        row.style.transform = "translateX(-12px)";
        setTimeout(() => {
          if (document.body.contains(row)) row.remove();
        }, 350);
        success++;
      } catch (err) {
        console.error("[BulkDelete] Failed", convId, err);
        if (document.body.contains(row))
          row.style.outline = "2px solid #f87171";
        failed++;
      }
      await sleep(250 + Math.random() * 150);
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = "Delete";
    }
    refreshUI();

    const msg = "Deleted: " + success + ". Failed: " + failed + ".";
    setStatus(msg);
    GM_notification({ title: "ChatGPT Bulk Delete", text: msg, timeout: 7000 });
    console.log("[BulkDelete] Done. S:", success, "F:", failed);
  }

  // ──── Bootstrap ────
  async function start() {
    console.log("[BulkDelete] Starting...");
    const container = await waitForEl(HISTORY_SELECTOR);
    await (async () => {
      while (!container.querySelector(ROW_SELECTOR)) await sleep(100);
    })();
    injectUI(container);
    addCheckboxes(container);

    // Debounced mutation observer — only fires after 500ms of no changes
    const obs = new MutationObserver(() => {
      if (obsDebounce) clearTimeout(obsDebounce);
      obsDebounce = setTimeout(() => {
        addCheckboxes(container);
      }, 500);
    });
    obs.observe(container, { childList: true, subtree: true });
  }

  start();
})();
