# Hafta summary Markdown rendering (GFM)

## Goal

Render the Hafta **Özet** body as real Markdown (GitHub Flavored Markdown) instead of raw text inside `<pre>`.

## Behavior

- Replace `<pre>{summary.content}</pre>` in `HaftaView` with a Markdown renderer.
- Support GFM: headings, lists, bold/italic, links, fenced code, tables, strikethrough, task lists (as provided by `remark-gfm`).
- Store/persist summary text unchanged; only the display layer changes.
- Links: only safe schemes in practice via the library defaults; open external links in a new tab with `rel="noreferrer noopener"` when customizing the `a` component.
- Typography: styled under a dedicated class (e.g. `hafta-view__ozet-md`) so headings/lists/tables read cleanly inside the existing Özet card.

## Dependencies (approved)

- `react-markdown`
- `remark-gfm`

## Out of scope

- Editing the summary as Markdown/WYSIWYG
- Rendering Markdown on other screens (notes stay as today)
- Changing the LLM prompt or summary persistence schema

## Version

Normal feature commit; no version bump unless releasing.
