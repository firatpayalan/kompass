# Hafta Markdown Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Hafta Özet content as GFM Markdown instead of raw `<pre>` text.

**Architecture:** Small presentational `MarkdownBody` wrapping `react-markdown` + `remark-gfm`, used only in `HaftaView`. Persist/API unchanged. Style under `.hafta-view__ozet-md`.

**Tech Stack:** React, Vitest + Testing Library, `react-markdown`, `remark-gfm` (user-approved).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-18-hafta-markdown-summary-design.md`
- Dependencies already approved: `react-markdown`, `remark-gfm` only (no others without asking).
- Do not change summary persistence or LLM prompts.
- External links: `target="_blank"` + `rel="noreferrer noopener"`.
- Commit only when the user explicitly asks (skip commit steps unless requested).

## File map

| File | Responsibility |
|------|----------------|
| `package.json` / lock | Add `react-markdown`, `remark-gfm` |
| `src/components/MarkdownBody.tsx` | Shared GFM renderer |
| `src/views/HaftaView.tsx` | Use `MarkdownBody` instead of `<pre>` |
| `src/styles.css` | `.hafta-view__ozet-md` typography; remove/replace `.hafta-view__ozet pre` |
| `tests/hafta-markdown-ui.test.tsx` | Assert headings/lists/bold render as HTML roles/elements |

---

### Task 1: MarkdownBody + HaftaView + styles + tests

**Files:**
- Create: `src/components/MarkdownBody.tsx`
- Modify: `src/views/HaftaView.tsx`
- Modify: `src/styles.css`
- Create: `tests/hafta-markdown-ui.test.tsx`
- Modify: `package.json`, `package-lock.json` via `npm install`

**Interfaces:**
- Produces: `MarkdownBody({ children: string; className?: string })`
- Consumes: `react-markdown`, `remark-gfm`

- [ ] **Step 1: Install approved deps**

```bash
npm install react-markdown remark-gfm
```

- [ ] **Step 2: Write failing UI test**

Create `tests/hafta-markdown-ui.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppDb } from "../src/db/appDb";
import type { LlmBridge } from "../src/lib/llmBridge";
import HaftaView from "../src/views/HaftaView";

afterEach(cleanup);

// Reuse / mirror noteInCurrentWeek helpers from hafta-ayarlar-ui.test.tsx as needed,
// or stub getWeeklySummary to return markdown content directly so Özet renders without clicking Özetle.

it("renders Özet markdown as headings and lists", async () => {
  const content = `## Kişiler\n\n- **Ayşe:** not\n\n## İşler\n\n1. Bir`;
  const db = {
    listNotesInRange: vi.fn(async () => []),
    listPeople: vi.fn(async () => []),
    listInitiatives: vi.fn(async () => []),
    getWeeklySummary: vi.fn(async () => ({
      weekStart: "2026-09-15",
      content,
      provider: "openai",
      model: "gpt-4.1",
      createdAt: "2026-09-18T10:00:00.000Z",
      updatedAt: "2026-09-18T10:00:00.000Z",
    })),
    upsertWeeklySummary: vi.fn(),
    getNoteImage: vi.fn(async () => null),
  } as unknown as AppDb;
  const llm = {
    hasClaudeApiKey: vi.fn(async () => false),
    hasOpenaiApiKey: vi.fn(async () => false),
    summarizeWeek: vi.fn(),
    getLlmSettings: vi.fn(),
    setLlmSettings: vi.fn(),
    saveClaudeApiKey: vi.fn(),
    clearClaudeApiKey: vi.fn(),
    saveOpenaiApiKey: vi.fn(),
    clearOpenaiApiKey: vi.fn(),
  } as unknown as LlmBridge;

  render(<HaftaView db={db} llm={llm} />);

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "Kişiler", level: 2 })).toBeTruthy();
  });
  expect(screen.getByText("Ayşe:")).toBeTruthy(); // bold text visible without **
  expect(screen.queryByText(/\*\*Ayşe:\*\*/)).toBeNull();
  expect(screen.getByRole("list")).toBeTruthy();
});
```

Align `getWeeklySummary` return shape with the real type in the codebase (`WeeklySummary` / whatever `HaftaView` expects). If empty notes hide the Özet section, adjust fixtures so the summary section mounts (check `HaftaView` load logic).

- [ ] **Step 3: Run test — expect FAIL**

Run: `npm test -- tests/hafta-markdown-ui.test.tsx`

Expected: FAIL — still a `<pre>` / raw `**` visible, or no heading role.

- [ ] **Step 4: Implement `MarkdownBody`**

```tsx
// src/components/MarkdownBody.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownBodyProps = {
  children: string;
  className?: string;
};

export default function MarkdownBody({
  children,
  className,
}: MarkdownBodyProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren }) => (
            <a href={href} rel="noreferrer noopener" target="_blank">
              {linkChildren}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 5: Wire HaftaView + CSS**

In `HaftaView.tsx` replace:

```tsx
<pre>{summary.content}</pre>
```

with:

```tsx
<MarkdownBody className="hafta-view__ozet-md">{summary.content}</MarkdownBody>
```

In `styles.css`, replace `.hafta-view__ozet pre` with something like:

```css
.hafta-view__ozet-md {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 0.75rem 1rem;
  border-radius: 0.35rem;
  line-height: 1.5;
  overflow-x: auto;
}

.hafta-view__ozet-md > :first-child {
  margin-top: 0;
}

.hafta-view__ozet-md > :last-child {
  margin-bottom: 0;
}

.hafta-view__ozet-md h1,
.hafta-view__ozet-md h2,
.hafta-view__ozet-md h3 {
  margin: 1rem 0 0.5rem;
  line-height: 1.25;
  color: #0f172a;
}

.hafta-view__ozet-md ul,
.hafta-view__ozet-md ol {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
}

.hafta-view__ozet-md table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.75rem 0;
  font-size: 0.95rem;
}

.hafta-view__ozet-md th,
.hafta-view__ozet-md td {
  border: 1px solid #e2e8f0;
  padding: 0.35rem 0.5rem;
  text-align: left;
}

.hafta-view__ozet-md pre,
.hafta-view__ozet-md code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9em;
}

.hafta-view__ozet-md pre {
  background: #f1f5f9;
  padding: 0.65rem;
  border-radius: 0.35rem;
  overflow-x: auto;
}
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
npm test -- tests/hafta-markdown-ui.test.tsx tests/hafta-ayarlar-ui.test.tsx
```

Update `hafta-ayarlar-ui` assertion `findByText("özet metni")` if it still passes (plain text still matches). Keep it.

- [ ] **Step 7: Commit** (only if user asked)

```bash
git add package.json package-lock.json src/components/MarkdownBody.tsx src/views/HaftaView.tsx src/styles.css tests/hafta-markdown-ui.test.tsx docs/superpowers/specs/2026-09-18-hafta-markdown-summary-design.md
git commit -m "$(cat <<'EOF'
feat: render Hafta Özet as GFM Markdown

EOF
)"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Replace `<pre>` with Markdown | Task 1 |
| GFM via remark-gfm | Task 1 |
| Persist unchanged | Task 1 (display only) |
| Safe external links | Task 1 `a` component |
| Typography class | Task 1 CSS |
| Approved deps only | Task 1 |
