# ChatGPT Bulk Delete - Tampermonkey Script (Firefox)

A Tampermonkey userscript for bulk deleting ChatGPT conversations in Firefox.

## Description

This script adds bulk delete functionality to ChatGPT's conversation history. It works with the ChatGPT 2025 UI using the `#history` container.

## Features

- Add checkboxes to each conversation in your ChatGPT history
- Select multiple conversations for deletion
- Bulk delete selected conversations with a single click
- Works with the latest ChatGPT UI (2025)

## Installation

1. Install [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) extension for Firefox
2. Open Tampermonkey dashboard
3. Create a new script
4. Copy and paste the contents of `GPTbulkDelete.ts` into the editor
5. Save the script

## Usage

1. Navigate to [ChatGPT](https://chatgpt.com/)
2. Open your conversation history sidebar
3. Checkboxes will appear next to each conversation
4. Select the conversations you want to delete
5. Click the "Bulk Delete Selected" button at the top
6. Confirm the deletion

## Version

4.0.0 - Updated for ChatGPT 2025 UI using #history container

## License

This script is provided as-is for personal use.

