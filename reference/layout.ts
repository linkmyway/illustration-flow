/**
 * Deterministic two-column masonry.
 *
 * Why not CSS columns: multi-column layout re-flows under the owner's
 * WebView — cards visibly jumped mid-scroll and a column's first card
 * flashed and vanished. Two explicit column containers with a
 * deterministic distribution never re-flow during scroll.
 *
 * Distribution is greedy by rendered height (width / aspect), which
 * keeps the columns balanced without any measurement pass: heights are
 * known from the image metadata before anything renders.
 */

export interface GalleryItem {
  id: number;
  width: number;
  height: number;
}

/** Split items into `columns` ordered columns, balancing total
 *  rendered height. Input order is preserved within each column.
 *
 * @example
 * distribute([{ id: 1, width: 100, height: 200 },
 *             { id: 2, width: 100, height: 100 },
 *             { id: 3, width: 100, height: 100 }], 2)
 * // → [[item1], [item2, item3]] — heights 2.0 vs 1.0+1.0, balanced.
 */
export function distribute<T extends GalleryItem>(items: T[], columns = 2): T[][] {
  const cols: T[][] = Array.from({ length: columns }, () => []);
  const heights = new Array(columns).fill(0);
  for (const item of items) {
    const rendered = item.width > 0 ? item.height / item.width : 1;
    let target = 0;
    for (let i = 1; i < columns; i++) {
      if (heights[i] < heights[target]) target = i;
    }
    cols[target].push(item);
    heights[target] += rendered;
  }
  return cols;
}

/**
 * Section highlighting from scroll geometry — synchronously, never in
 * scroll frame callbacks (the WebView throttles them; an earlier
 * frame-callback version froze the highlight on the first section).
 *
 * Rule: the current section is the last one whose top has passed the
 * activation line (viewport top + offset) — plus a bottom rule so a
 * short trailing section still activates when the page is scrolled to
 * its end.
 */
export function currentSection(
  sections: { id: string; offsetTop: number }[],
  scrollY: number,
  viewportHeight: number,
  documentHeight: number,
  activationOffset = 120,
): string | null {
  if (sections.length === 0) return null;
  if (scrollY + viewportHeight >= documentHeight - 2) {
    return sections[sections.length - 1].id; // bottom rule
  }
  let current: string | null = sections[0].id;
  for (const s of sections) {
    if (s.offsetTop <= scrollY + activationOffset) current = s.id;
    else break;
  }
  return current;
}
