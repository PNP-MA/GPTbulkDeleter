// ==UserScript==
// @name         ChatGPT Bulk Delete (Final #history Version)
// @namespace    https://chatgpt.com/
// @version      4.0.0
// @description  Works with ChatGPT 2025 UI using #history container
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    console.log("[BulkDelete] Script active");

    const HISTORY_SELECTOR = "#history";
    const ROW_SELECTOR = 'a.group.__menu-item.hoverable[href^="/c/"]';
    const MENU_BUTTON = 'button[aria-label="Open conversation options"]';

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    async function waitForHistoryContainer() {
        let node = null;
        while (!node) {
            node = document.querySelector(HISTORY_SELECTOR);
            if (!node) await sleep(100);
        }
        console.log("[BulkDelete] Found #history");
        return node;
    }

    async function waitForRows(container) {
        let rows = [];
        while (rows.length === 0) {
            rows = container.querySelectorAll(ROW_SELECTOR);
            if (rows.length === 0) await sleep(100);
        }
        console.log("[BulkDelete] Found chat rows:", rows.length);
        return rows;
    }

    function injectUI(container) {
        if (document.getElementById("bulkDeletePanel")) return;

        const panel = document.createElement("div");
        panel.id = "bulkDeletePanel";
        panel.style.cssText = `
            padding: 10px;
            background: rgba(255,255,255,0.05);
            border-bottom: 1px solid rgba(255,255,255,0.15);
            margin-bottom: 6px;
        `;

        const btn = document.createElement("button");
        btn.textContent = "Bulk Delete Selected";
        btn.style.cssText = `
            width: 100%;
            padding: 8px;
            background: #e05555;
            border: none;
            border-radius: 6px;
            color: white;
            cursor: pointer;
            font-weight: bold;
        `;

        btn.addEventListener("click", bulkDelete);

        const help = document.createElement("div");
        help.textContent = "Check the boxes beside chats below.";
        help.style.cssText = "font-size: 11px; color: #aaa; margin-top: 4px;";

        panel.append(btn, help);
        container.prepend(panel);
    }

    function addCheckboxes(container) {
        const rows = container.querySelectorAll(ROW_SELECTOR);

        rows.forEach(row => {
            if (row.querySelector(".bulkCheck")) return;

            const titleDiv =
                row.querySelector("div.truncate") ||
                row.querySelector("div.flex") ||
                row.firstElementChild;

            if (!titleDiv) return;

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.className = "bulkCheck";
            cb.style.cssText = `
                margin-right: 6px;
                transform: scale(1.1);
            `;

            titleDiv.prepend(cb);
        });
    }

    async function bulkDelete() {
        const selected = [...document.querySelectorAll(".bulkCheck:checked")];
        if (!selected.length) {
            alert("No conversations selected.");
            return;
        }

        const ok = confirm(`Delete ${selected.length} chats?`);
        if (!ok) return;

        for (let cb of selected) {
            const row = cb.closest(ROW_SELECTOR);
            if (!row) continue;

            const menuButton = row.querySelector(MENU_BUTTON);
            if (!menuButton) continue;

            menuButton.click();
            await sleep(200);

            const delBtn = [...document.querySelectorAll("button")]
                .find(b => b.textContent.trim() === "Delete");

            if (!delBtn) continue;

            delBtn.click();
            await sleep(200);

            const finalBtn = [...document.querySelectorAll("button")]
                .filter(b => b.textContent.trim() === "Delete")
                .pop();

            if (finalBtn) finalBtn.click();

            await sleep(500);
        }

        alert("Bulk delete complete.");
    }

    async function start() {
        const container = await waitForHistoryContainer();
        await waitForRows(container);

        injectUI(container);
        addCheckboxes(container);

        const obs = new MutationObserver(() => addCheckboxes(container));
        obs.observe(container, { childList: true, subtree: true });
    }

    start();

})();
