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

- A single toggle, default off; when off the zone and its favorites
  group are not rendered at all.
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
