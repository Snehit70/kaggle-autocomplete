# Kaggle Autocomplete

A small Manifest V3 extension that requests Kaggle's existing JupyterLab completion menu after you pause while typing in a code cell. It sends a synthetic Tab event; suggestions still come from JupyterLab's completion providers.

No build step, runtime dependencies, API key, or external completion service is required.

## Install

1. Clone or download this repository and extract it if necessary.
2. Open `chrome://extensions` in Helium or Chrome, or the equivalent extensions page in your Chromium browser.
3. Enable **Developer mode**, then choose **Load unpacked**.
4. Select the directory containing `manifest.json`.
5. Reload your Kaggle notebook.

For an existing installation, reload the extension from the extensions page and reload the notebook after pulling updates. If the directory moved, remove the old unpacked registration and load the new directory.

## Use

Start a notebook session for kernel suggestions. In a Python code cell, type a name such as `pri` or an attribute such as `np.` or `pd.read`. The default pause is 200 ms and the minimum for bare names is two characters. Attribute access after a dot can trigger immediately, regardless of the minimum.

The extension popup lets you enable or disable requests, choose a delay from 0 to 2000 ms, and choose a minimum from one to five characters. Settings use your browser's extension sync storage.

JupyterLab may insert a unique match immediately when Tab is invoked. This extension inherits that behavior. Increasing the minimum reduces bare-name triggers but does not disable dot triggers.

## Behavior and compatibility

- Runs only inside `https://*.jupyter-proxy.kaggle.net/*` frames.
- Restricts automatic requests to editable code cells, with JupyterLab's completion-enabled flag present.
- Skips Python comments and string literals with a lightweight lexical filter. Entire f-strings are skipped, including expressions inside them.
- Cancels pending requests when you navigate, change selection, click, lose focus, start composition, or change settings.
- Rechecks the editor and cursor after the delay and leaves existing completion menus alone.
- Sends no network requests and does not execute notebook cells. It requests only the `storage` extension API permission; its content-script matches also grant access to the specified Kaggle frames.

On 2026-10-09, the Kaggle editor's iframe domain and JupyterLab 4 DOM selectors were inspected in a live notebook. The original listener also matched Markdown cells, which is now fixed.

**End-to-end completion in an installed Helium extension has not yet been verified.** Automated tests use controlled DOM, timers, and Chrome storage mocks. The popup was also checked in an isolated browser preview with mocked storage.

Kaggle can change its DOM, completion flags, or keyboard handling. If the completion-enabled flag is absent, this extension deliberately skips Tab because it can otherwise insert whitespace. The lexical filter reads rendered cell lines, so CodeMirror virtualization in large cells can hide earlier string context. This is a Python-focused extension, not a full language parser.

[JupyterLab also provides native automatic completion](https://jupyterlab.readthedocs.io/en/stable/user/completer.html#automatic-completion). Availability of that setting in Kaggle's editor is not confirmed here.

## Verify an installation

Use a scratch notebook so the check does not modify important work:

1. Confirm manual Tab completion works in a code cell with the session running.
2. Type `pri`, pause, and check for a menu or an inserted unique match.
3. After importing NumPy, type `np.` and check for attribute suggestions.
4. Repeat inside a comment, a string, and a Markdown cell. The extension should not send Tab.
5. Use a longer delay, type a name, then move the cursor before it expires. No delayed request should appear.
6. Disable the extension in its popup, return to the code cell, and confirm automatic requests stop. Reopen the popup to check persistence.

If manual Tab fails, troubleshoot the notebook session or JupyterLab first. If manual Tab works but automatic completion fails, reload the extension and notebook, check the popup settings, and inspect compatibility with the current Kaggle editor before changing the guards.

## Development

Node.js 20 or newer is required for automated checks. There are no dependencies to install:

```sh
npm run check
npm test
```

The tests cover request cancellation, Markdown exclusion, completion readiness, cursor/focus changes, IME composition, Python lexical contexts, settings validation and storage errors, and extension entry points. GitHub Actions runs the checks on pushes to `main` and on pull requests.

`shared.js` contains the settings and lexical policy. `content.js` handles notebook events. `popup.js` handles settings persistence. Load the repository root as the unpacked extension.

See [CHANGELOG.md](CHANGELOG.md) for changes from the original ZIP.
