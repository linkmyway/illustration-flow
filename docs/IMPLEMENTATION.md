# Implementation method

## Layout: two explicit columns

CSS multi-column masonry re-flows under the owner's WebView — cards
visibly jumped and a column's first card flashed and vanished. The
grid is therefore two explicit column containers with deterministic
card distribution. Nothing re-flows during scroll.

Section highlighting is computed synchronously from scroll geometry
(viewport vs. section offsets, with a bottom-of-page rule for short
trailing sections). An earlier version updated highlights inside
scroll frame callbacks, which the WebView throttled — the highlight
froze on the first section. Frame callbacks are not a state channel.

No View Transitions anywhere (they froze this WebView outright).

## Storage tiers

- **Originals**: stored as opaque bytes, served unchanged. Upload,
  collect-to-vault and download all move the same bytes; a SHA-256
  check guards the one server-side import path.
- **Previews**: a separate derived tier for grids; the viewer shows the
  preview instantly, then swaps in the original seamlessly.
- **Large-file import pattern**: when a file is too large to relay
  through a chat channel without risking silent corruption, a one-off
  server action reads it directly from the host filesystem, verifies
  size + SHA-256 against a baked-in expectation, stores it through the
  normal blob path, and is removed in the next edit round. Idempotent:
  re-running skips an existing identical entry.

## Ranking pipeline

- Source: Pixiv overall rankings via a mirror API. Refresh steps back
  day by day to the newest non-empty snapshot; ad entries dropped;
  filtered to single-image illustrations only; board order preserved.
- Images are proxied server-side with the source's required `Referer`
  and cached byte-exact (preview size and original size are distinct
  cache entries).
- Hearts feed a taste model: liked artists boost the "for you" sort.

## Adult zone (mechanism only)

- No visibility toggle: the zone and its favorites group are always
  rendered (the toggle was removed on 2026-11-10 — it disturbed the
  top-bar layout). The remaining switches are tag preferences that
  drive the auto-feed, not visibility.
- Auto-feed: a merged pool from three booru-style sources driven by the
  owner's tag toggles, deduped by content hash/id, hard-filtered on
  every source to static explicit/questionable posts minus an
  exclusion set. Source images require per-source `Referer` handling;
  only the sources' own CDN hosts are accepted.
- Human-verified daily picks are stored separately (original bytes)
  and labelled as verified, distinct from machine-searched results.
- Favorites store full snapshots, so they render and download even
  when the live feed batch has moved on.

## Downloads on iOS WebView

Programmatic clicks on hidden anchors do nothing in iOS WebView when
the click happens after an async fetch — the user gesture is gone.
Downloads therefore open a full-screen save page showing the original
image for long-press save; ZIP packing follows the same rule. The
button must always produce a visible result.

## Top-bar rules

- Controls are fixed-size; state changes never resize a control.
- No counters or badges in the bar (a favorites badge that appeared
  when a mode toggled once pushed the bar off-screen) — counts live in
  panel titles instead.
- Hierarchy: quiet brand left; the two "mine" entries grouped (a
  secondary favorites button beside the primary gold vault button);
  the adult-zone toggle is a pill switch at the far end, visually a
  mode switch, not an entry.

## Features and implementation, in detail

Feature by feature: what it does, how it is built, and where its
edges are. Where this section and earlier summaries differ, this
section governs.

### Sections and the ranking pipeline

- What: the gallery's skeleton — chart sections that keep receiving
  new work.
- How: the source is Pixiv's rankings via a mirror API, in four
  streams — weekly, daily, male-oriented daily, and monthly.
  A refresh steps back day by day (up to 7 days) to the first
  non-empty snapshot, drops ad entries, keeps single-image
  illustrations only (`type=illust`, `pageCount=1`), and preserves
  board order. Images are taken at the highest available resolution
  (proxying below). Refresh runs daily.
- Edges: adult-rated works never enter the chart sections (they
  belong to the adult zone's own rules). A chart section is a dated
  snapshot, not a live feed. If the mirror source dies entirely, the
  round is skipped and the gap reported — no other platform is
  substituted in silence.

### Board fusion

- What: four chart streams present as two sections, so the page
  doesn't fragment into four boards.
- How: fusion happens at assembly — the male-oriented daily board
  merges into the daily section, the monthly board into the weekly
  section. The main chart leads in its original rank order; works
  unique to the fused stream follow in their rank order with a
  source badge ("male-oriented" / "monthly"); each work appears
  once (dedupe by work). A measured round: weekly section =
  weekly ∪ monthly = 68 works; daily section = daily ∪ male = 56.
- Edges: fusion is an assembly-layer fold; the four raw snapshots
  stay archived separately and the badges keep provenance traceable.

### Curator picks (cross-chart)

- What: the curated section picks across all four charts instead of
  mirroring one board.
- How: the pick batch is replaced wholesale through a dedicated
  action (`replaceCurated`) — no build round needed — and every
  pick's card is labelled with its source chart and rank there.
  Selection follows the curator's taste model (verified artists,
  heart history, art-style bar), never rank alone: a chart's #1 does
  not auto-enter.
- Edges: curation is a judgement slot and is labelled apart from the
  charts' "original order" nature.

### Two-column masonry

- What: a two-column waterfall that never re-flows mid-scroll.
- How: two explicit column containers with deterministic
  distribution (each card goes to the currently shorter column by
  estimated rendered height; input order is preserved within a
  column — see `reference/layout.ts`). CSS multi-column is
  deliberately not used: it re-flows in the owner's WebView and once
  made a column's first card flash and vanish. Section highlighting
  is computed synchronously from scroll geometry (viewport vs.
  section offsets, with a bottom rule for short trailing sections),
  never from frame callbacks (throttled by the WebView, the
  highlight once froze on the first section).
- Edges: layout is accepted on the owner's real device (420×912
  CSS viewport); the fixed 390×844 build probe counts as equivalent
  only because no breakpoint sits between 390 and 420.

### Image proxying and byte tiers

- What: previews instantly in the grid, originals on open — and the
  original's bytes never change.
- How: images are proxied server-side with the source's required
  `Referer` and cached byte-exact; the preview size and the original
  size are separate cache entries. Storage is tiered: originals are
  opaque bytes, stored and served unchanged (upload, collect and
  download all move the same bytes); previews are a derived tier.
  The tiers never contaminate each other.
- Edges: zero recompression, zero transcoding is a hard rule; any
  lossy touch on an original is an incident.

### Viewer and series grouping

- What: single-image viewing, preview first with the original
  swapped in seamlessly; image sets collapse into one group card in
  the flow.
- How: the viewer is fit-to-screen single-image (illustrations are
  not manga: no zoom, no on-screen pager buttons; horizontal swipe
  paging stays). **Series grouping**: frames from the same source
  and author, adjacent in time with high tag overlap, fold at
  assembly into one "all N" group card — across the recommendation
  feed, favorites and the verified picks alike; opening it runs a
  group reader with in-group prev/next. Controls are clear glass
  buttons maximising image area (tap-to-hide controls were tried
  and superseded by the owner's preference for always-clear
  controls).
- Edges: grouping is a display fold only — underlying entries are
  never merged or deleted, and each frame stays individually
  downloadable and collectable.

### The warehouse (vault)

- What: the owner's own library — uploads plus works collected from
  the gallery, treated identically.
- How: three intake routes — direct upload; collect-to-warehouse
  (stores the gallery work's original bytes, deduped by content, a
  repeat collect creates no second copy); and the one-shot
  server-side import (the action reads the file from the host
  filesystem, verifies SHA-256 and byte count against baked-in
  expectations, stores through the normal blob path, and is removed
  in the next edit round — the pattern for files too large to relay
  through a chat channel, see Storage tiers). Inside: per-image
  download, ZIP packing, delete. "Add to warehouse" is a first-class
  action on gallery images, separate from the heart.
- Edges: warehouse entries and gallery entries are separate books —
  a collected copy is a byte copy; deleting the gallery entry
  leaves the vault copy intact.

### Favorites

- What: hearted works as a standalone favorites page that renders
  even after the live batch moves on.
- How: a favorite stores a **full snapshot** (title, artist,
  locator, hit tags, source-post link, original reference) — not a
  pointer into the batch that happened to be live when it was
  hearted. The adult-zone favorites form a group on the same page
  (always shown since the visibility toggle was removed).
- Edges: a snapshot freezes "the copy as it was"; later changes at
  the source don't rewrite the vault's version.

### Adult zone (mechanism)

- What: an adult zone where three content kinds share one surface
  with their provenance labelled apart.
- How: (a) an **auto-feed** — a merged pool from three booru-style
  sources (measured ~240 posts), driven by the owner's tag toggles,
  deduped by content hash/id, hard-filtered identically on every
  source: static explicit/questionable posts only, minus a fixed
  exclusion tag set; image proxying applies per-source `Referer`
  rules and accepts only each source's own CDN hosts. (b)
  **Verified daily picks** — individually human-verified posts
  stored as original bytes, labelled distinctly from the auto-feed.
  (c) the owner's own adult uploads, via the warehouse route. A
  fourth intake imports whole albums from a gallery site by album
  id: per-page content keys and real dimensions are registered into
  an "all N" group (that host requires a browser user-agent and a
  current verify token, handled server-side). Series grouping
  applies in this zone too.
- Edges: machine-searched vs. human-verified is labelled honestly —
  that labelling is the zone's red line. Hard filters execute
  server-side; the front-end never re-admits.

### Top bar and navigation

- What: brand plus the two "mine" entries in the bar; section
  highlighting that follows the scroll.
- How: controls are fixed-size and never resize on state change; no
  counters live in the bar (a badge once pushed it off-screen).
  Current form: the favorites and warehouse entries are boxed emoji
  buttons, aligned by construction. Highlighting uses the geometry
  method (above), not frame callbacks.
- Edges: bar layout verdicts come from the owner's real device —
  a stuck highlight and a dead refresh button were both fixed
  against real-device reports, not probe output.

### Downloads

- What: single originals and ZIP packs that actually land on the
  phone.
- How: in iOS WebView, a programmatic click after an async fetch
  has lost the user gesture and downloads silently fail — so a
  download tap opens a full-screen save page (the original,
  full-screen, for long-press save); ZIP follows the same route.
  The rule: a button press must always produce a visible result.
- Edges: no fake "downloading" intermediate states; the save page
  is the download page.

### Taste weighting

- What: hearts and artist preferences make recommendations converge
  on the owner's taste.
- How: liked work ids and liked artists persist and feed the
  curator sort and pick weighting (verified artists first, hearted
  artists boosted). Chart order itself is never rewritten by taste —
  weighting touches only the curation slot and the recommendation
  feed, not the boards.
- Edges: the taste model uses only signals the owner personally
  gave (hearts, verdicts, the verified-artist table) — no inferred
  profiling.
