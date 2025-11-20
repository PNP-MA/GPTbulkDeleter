// ==UserScript==
// @name         ChatGPT Bulk Delete (API + Ctrl Multi-Select)
// @namespace    https://chatgpt.com/
// @version      5.0.0
// @description  Bulk-delete ChatGPT conversations using the backend API with Ctrl-click multi-select + checkboxes.
// @match        https://chatgpt.com/*
// @connect      chatgpt.com
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// ==/UserScript==

(function () {
    'use strict';

    console.log('[BulkDeleteAPI] Script loaded');

    const HISTORY_SELECTOR = '#history';
    const ROW_SELECTOR = 'div#history a[href^="/c/"], div[role="presentation"] nav a[href^="/c/"]';

    let authToken = null;

    // ----------------- Utility helpers -----------------

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    function gmRequest(options) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                ...options,
                onload: res => resolve(res),
                onerror: err => reject(err)
            });
        });
    }

    async function getAuthToken() {
        if (authToken) return authToken;
        try {
            const res = await gmRequest({
                method: 'GET',
                url: 'https://chatgpt.com/api/auth/session'
            });
            const data = JSON.parse(res.responseText || '{}');
            if (data && data.accessToken) {
                authToken = data.accessToken;
                console.log('[BulkDeleteAPI] Retrieved auth token');
                return authToken;
            }
            throw new Error('accessToken missing in /api/auth/session');
        } catch (err) {
            console.error('[BulkDeleteAPI] Failed to get auth token', err);
            GM_notification({
                title: 'ChatGPT Bulk Delete',
                text: 'Could not retrieve auth token. Are you logged in?',
                timeout: 6000
            });
            return null;
        }
    }

    async function waitForHistoryContainer() {
        let node = null;
        while (!node) {
            node = document.querySelector(HISTORY_SELECTOR);
            if (!node) await sleep(100);
        }
        console.log('[BulkDeleteAPI] Found #history container');
        return node;
    }

    async function waitForRows(container) {
        let rows = [];
        while (rows.length === 0) {
            rows = container.querySelectorAll(ROW_SELECTOR);
            if (rows.length === 0) await sleep(100);
        }
        console.log('[BulkDeleteAPI] Found', rows.length, 'chat rows');
        return rows;
    }

    // ----------------- UI injection -----------------

    function injectUI(container) {
        if (document.getElementById('bulkDeletePanel')) return;

        const panel = document.createElement('div');
        panel.id = 'bulkDeletePanel';
        panel.style.cssText = `
            padding: 10px;
            background: rgba(255,255,255,0.05);
            border-bottom: 1px solid rgba(255,255,255,0.15);
            margin-bottom: 6px;
        `;

        const btn = document.createElement('button');
        btn.id = 'bulkDeleteButton';
        btn.textContent = 'Bulk Delete Selected';
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

        btn.addEventListener('click', bulkDelete);

        const help = document.createElement('div');
        help.textContent = 'Hold Ctrl (or ⌘ on Mac) and click a chat to toggle its checkbox.';
        help.style.cssText = 'font-size: 11px; color: #aaa; margin-top: 4px;';

        panel.append(btn, help);
        container.prepend(panel);

        console.log('[BulkDeleteAPI] UI panel injected');
    }

    function addCheckboxes(container) {
        const rows = container.querySelectorAll(ROW_SELECTOR);

        rows.forEach(row => {
            if (row.querySelector('.bulkCheck')) return;

            // Where to put the checkbox
            const titleDiv =
                row.querySelector('div.truncate') ||
                row.querySelector('div.flex') ||
                row.firstElementChild;

            if (!titleDiv) {
                console.warn('[BulkDeleteAPI] Could not find title container for row:', row);
                return;
            }

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'bulkCheck';
            cb.style.cssText = `
                margin-right: 6px;
                transform: scale(1.1);
            `;

            // Prevent normal click / focus from navigating when the checkbox itself is clicked
            cb.addEventListener('click', ev => {
                // allow normal checkbox behavior, but don't let it navigate
                ev.stopPropagation();
            });

            // Ctrl (or Meta) + click on the row toggles the checkbox instead of navigating
            row.addEventListener('click', ev => {
                if (ev.ctrlKey || ev.metaKey) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    cb.checked = !cb.checked;
                }
                // without Ctrl/Meta we fall through to normal ChatGPT behavior
            }, true);

            titleDiv.prepend(cb);
        });
    }

    // ----------------- Deletion logic -----------------

    async function deleteConversation(conversationId) {
        const token = await getAuthToken();
        if (!token) throw new Error('No auth token');

        const url = `https://chatgpt.com/backend-api/conversation/${conversationId}`;
        console.log('[BulkDeleteAPI] PATCH', url);

        const res = await gmRequest({
            method: 'PATCH',
            url,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            data: JSON.stringify({ is_visible: false })
        });

        if (res.status < 200 || res.status >= 300) {
            throw new Error(`Status ${res.status}`);
        }
        return res;
    }

    async function bulkDelete() {
        const selectedCbs = [...document.querySelectorAll('.bulkCheck:checked')];

        console.log('[BulkDeleteAPI] Selected checkboxes:', selectedCbs.length);

        if (!selectedCbs.length) {
            alert('No conversations selected.');
            return;
        }

        const ok = confirm(`Delete ${selectedCbs.length} chats?\n\n(They will be removed from your history.)`);
        if (!ok) return;

        const button = document.getElementById('bulkDeleteButton');
        if (button) {
            button.disabled = true;
            button.textContent = 'Deleting…';
        }

        let success = 0;
        let failed = 0;

        for (let i = 0; i < selectedCbs.length; i++) {
            const cb = selectedCbs[i];
            const row = cb.closest('a[href^="/c/"]');

            if (!row) {
                console.error('[BulkDeleteAPI] No row for checkbox', cb);
                failed++;
                continue;
            }

            const href = row.getAttribute('href') || '';
            const conversationId = href.split('/').pop();
            console.log(`[BulkDeleteAPI] Deleting ${i + 1}/${selectedCbs.length}:`, conversationId);

            try {
                await deleteConversation(conversationId);
                // Soft-remove from UI
                row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                row.style.opacity = '0';
                row.style.transform = 'translateX(-12px)';
                setTimeout(() => row.remove(), 350);
                success++;
            } catch (err) {
                console.error('[BulkDeleteAPI] Failed to delete', conversationId, err);
                row.style.outline = '2px solid #f87171'; // red highlight for failures
                failed++;
            }

            // Small delay to avoid hammering the API
            await sleep(300);
        }

        if (button) {
            button.disabled = false;
            button.textContent = 'Bulk Delete Selected';
        }

        GM_notification({
            title: 'ChatGPT Bulk Delete',
            text: `Done. Deleted: ${success}. Failed: ${failed}.`,
            timeout: 7000
        });

        console.log('[BulkDeleteAPI] Bulk deletion finished. Success:', success, 'Failed:', failed);
    }

    // ----------------- Bootstrap -----------------

    async function start() {
        console.log('[BulkDeleteAPI] Starting…');

        const container = await waitForHistoryContainer();
        await waitForRows(container);

        injectUI(container);
        addCheckboxes(container);

        const obs = new MutationObserver(() => addCheckboxes(container));
        obs.observe(container, { childList: true, subtree: true });

        console.log('[BulkDeleteAPI] Mutation observer active');
    }

    start();

})();
