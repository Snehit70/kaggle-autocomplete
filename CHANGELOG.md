# Changelog

## 0.2.0

- Trigger only inside editable code cells with JupyterLab completion enabled.
- Cancel delayed requests on navigation, selection changes, clicks, lost focus, and settings changes.
- Recheck focus, selection, connection, and existing completion menus before dispatching Tab.
- Wait for IME composition to finish.
- Skip Python comments and string literals, including rendered multiline strings and escaped quotes.
- Support Unicode identifiers and attribute access after indexing or function calls.
- Validate shared settings and report popup storage errors.
- Increase popup body text to 16px and helper text to 14px.
- Add automated regression checks and GitHub Actions CI.

## 0.1.0

Original package imported without changes from the supplied ZIP.
