# ChatGPT Bulk Delete - Tampermonkey Script (Firefox)

A Tampermonkey userscript for bulk deleting ChatGPT conversations in Firefox.

## Description

This script adds bulk delete functionality to ChatGPT's conversation history. It works with the ChatGPT 2025 UI using the `#history` container.

## Features

- **Backend API deletion**: Uses ChatGPT's backend API for reliable, fast deletion (no UI clicking required)
- **Ctrl-click multi-select**: Hold Ctrl (or ⌘ on Mac) and click conversations to toggle checkboxes without navigating
- **Checkbox selection**: Traditional checkbox selection also available
- **Bulk delete**: Delete multiple conversations with a single click
- **Visual feedback**: Real-time progress indicators and error highlighting
- **Notifications**: Desktop notifications for deletion status
- **Works with ChatGPT 2025 UI**: Compatible with the latest ChatGPT interface

## Installation

1. Install [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) extension for Firefox
2. Open Tampermonkey dashboard
3. Create a new script
4. Copy and paste the contents of `GPTbulkDelete.ts` into the editor
5. Save the script

## Usage

1. Navigate to [ChatGPT](https://chatgpt.com/) and ensure you're logged in
2. Open your conversation history sidebar
3. Checkboxes will appear next to each conversation
4. Select conversations using one of these methods:
   - **Ctrl-click (or ⌘ on Mac)**: Hold Ctrl/⌘ and click a conversation to toggle its checkbox
   - **Checkbox click**: Click the checkbox directly
5. Click the "Bulk Delete Selected" button at the top
6. Confirm the deletion
7. Watch the progress as conversations are deleted via the backend API
8. You'll receive a notification showing how many were successfully deleted

## Version History

**5.0.0** - Major update:
- Uses backend API for deletion (more reliable and faster)
- Added Ctrl-click (⌘ on Mac) multi-select functionality
- Improved error handling and notifications
- Better UI feedback during deletion process

**4.0.0** - Updated for ChatGPT 2025 UI using #history container

## License

This script is provided as-is for personal use.

