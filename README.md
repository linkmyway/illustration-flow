# Illustration Flow — a personal illustration gallery with a lossless vault

A sectioned masonry gallery fed by Pixiv ranking boards, with a private
vault ("warehouse") for the owner's own illustrations. The defining
constraint: **originals are stored and served byte-for-byte** — no
recompression, no transcoding, ever. Grid previews are a separate tier
and never touch the original bytes.

This repository open-sources the **implementation method**. The owner's
images and personal data live in a private archive; nothing here
contains gallery content.

## What it does

- Sections: curator picks → weekly chart → daily chart → an opt-in
  adult zone (fully hidden when off, including in favorites) →
  favorites as their own page.
- Warehouse: upload or collect any gallery work into the vault with
  the same treatment as uploads — view, per-image download, ZIP pack,
  dedupe on re-add.
- Viewer: single image, fit-to-screen, preview first and the original
  swapped in seamlessly. (Illustrations are not manga: no zoom, no
  on-screen pager buttons.)

## Implementation notes

See [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md) for:

- why the masonry is two explicit column containers, not CSS columns;
- the lossless storage tiers and the hash-verified server-side import
  pattern for large files;
- the ranking pipeline (snapshot fallback, single-image filtering);
- the adult zone's multi-source merged pool with hard filters and
  honest labelling of machine-searched vs human-verified picks;
- the iOS WebView download failure (synthetic clicks lose the user
  gesture) and the full-screen save-page workaround;
- the top-bar rules: fixed-size controls, no counters in the bar, and
  scroll-position-based section highlighting instead of frame
  callbacks.
