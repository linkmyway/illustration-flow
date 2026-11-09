/**
 * The adult zone's auto-recommendation feed (mechanism only).
 *
 * Three booru-style sources are merged into one pool driven by the
 * owner's tag toggles, hard-filtered identically on every source, and
 * deduped by content hash / source id. Machine-searched results are
 * labelled as such and kept distinct from human-verified daily picks
 * (which are stored separately, original bytes and all).
 *
 * Hard filter (all sources, no exceptions): static images only,
 * explicit/questionable rating only, and nothing carrying an excluded
 * tag. Source images are proxied server-side; each source's CDN has
 * its own Referer rule and only its own hosts are accepted.
 */

export interface FeedPost {
  source: "nozomi" | "xbooru" | "yande.re";
  /** Source-native post id (nozomi) or md5 (booru-style sources). */
  dataid: string;
  md5?: string;
  tags: string[];
  rating: "explicit" | "questionable" | "safe";
  isStaticImage: boolean;
  fileUrl: string;
  sampleUrl: string;
  postUrl: string;
  width: number;
  height: number;
}

export const EXCLUDED_TAGS = new Set([
  "shota",
  "loli",
  "school_uniform",
  "futanari",
]);

export const PROXY_RULES: Record<FeedPost["source"], { referer: string; allowedHosts: string[] }> = {
  nozomi: {
    // nozomi originals live on w. host, thumbnails on qtn host; both
    // refuse requests without this Referer.
    referer: "https://nozomi.la/",
    allowedHosts: ["w.gold-usergeneratedcontent.net", "qtn.gold-usergeneratedcontent.net"],
  },
  xbooru: { referer: "https://xbooru.com/", allowedHosts: ["img.xbooru.com"] },
  "yande.re": { referer: "https://yande.re/", allowedHosts: ["files.yande.re", "assets.yande.re"] },
};

export function passesHardFilter(p: FeedPost): boolean {
  if (!p.isStaticImage) return false;
  if (p.rating === "safe") return false;
  return !p.tags.some((t) => EXCLUDED_TAGS.has(t));
}

/** Merge the three source pools for the owner's enabled tags. */
export function mergeFeed(
  pools: FeedPost[][],
  enabledTags: Set<string>,
): FeedPost[] {
  const seen = new Set<string>();
  const out: FeedPost[] = [];
  for (const pool of pools) {
    for (const p of pool) {
      if (!passesHardFilter(p)) continue;
      if (!p.tags.some((t) => enabledTags.has(t))) continue;
      const key = p.md5 ?? `${p.source}:${p.dataid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

/**
 * Ranking pipeline for the public charts (Pixiv via a mirror API):
 * step back day by day to the newest non-empty snapshot, drop ad
 * entries, keep single-image illustrations only, preserve board order.
 * Images are proxied with the source's required Referer and cached
 * byte-exact — preview size and original size are separate entries.
 */
export interface ChartEntry {
  pixivId: number;
  type: string;
  pageCount: number;
  isAd: boolean;
  rank: number;
}

export function selectChart(entries: ChartEntry[]): ChartEntry[] {
  return entries
    .filter((e) => !e.isAd && e.type === "illust" && e.pageCount === 1)
    .sort((a, b) => a.rank - b.rank);
}
