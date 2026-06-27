# GPTbulkDeleter

Delete ChatGPT conversations in bulk. Tampermonkey script for Firefox.

## What it does

Adds checkboxes to your ChatGPT history sidebar. Pick conversations, hit delete. Uses the backend API so it's fast and doesn't depend on the UI changing.

## Features

- Checkboxes next to each conversation — click, Ctrl+click, or use Select All
- Counter shows selected / total
- Deletes via ChatGPT's API (PATCH is_visible=false), not UI automation
- Desktop notification when done
- Auto mode: toggle auto-scroll to walk through your entire history, auto-select checks everything, auto-delete deletes without prompting

## Install

1. Install [Tampermonkey for Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
2. Open the dashboard, create a new script
3. Paste the contents of `GPTbulkDelete.ts`
4. Save

## Usage

Go to chatgpt.com, open your history sidebar. The control panel shows up at the top with counter, Select All, and Delete buttons. Toggle Auto-scroll below to start the automatic walkthrough.

## Changelog

**6.1.0** — Fixed freeze and unresponsive popup in auto mode. Smoother scrolling, debounced observer, max scroll limit.

**6.0.0** — Select All, live counter, auto-scroll/select/delete mode. Enhanced panel.

**5.0.0** — Backend API deletion. Ctrl-click multi-select. Notifications.

**4.0.0** — Updated for ChatGPT 2025 UI (`#history` container).

## License

MIT
