/**
 * Lossless storage and the hash-verified staged import.
 *
 * The vault's hard rule: originals are stored and served byte-for-byte.
 * No recompression, no transcoding, on any path (upload, collect,
 * download, ZIP). Grid previews are a separate derived tier.
 *
 * Large-file problem: an original can be far too large to relay through
 * a chat channel character-by-character (a 576 KB photo is ~768K base64
 * chars — one wrong character silently corrupts the archive). The
 * staged import avoids the relay entirely: a one-off server action
 * reads the file from the host filesystem, verifies size + SHA-256
 * against a baked-in expectation BEFORE storing, writes through the
 * same blob path as a normal upload, and is removed in the next edit
 * round. It is idempotent — re-running skips an identical entry.
 */
import { createHash } from "node:crypto";

export interface VaultStore {
  findByHash(sha256: string): Promise<{ id: number } | null>;
  storeOriginal(bytes: Uint8Array, meta: {
    title: string;
    contentType: string;
    width: number;
    height: number;
    isR18: boolean;
  }): Promise<{ id: number }>;
}

export interface StagedImportSpec {
  /** Absolute host path of the staged file (server-side read only). */
  stagedPath: string;
  expectedBytes: number;
  expectedSha256: string;
  title: string;
  contentType: string;
  width: number;
  height: number;
  isR18: boolean;
}

export async function importStagedUpload(
  store: VaultStore,
  readFile: (path: string) => Promise<Uint8Array>,
  spec: StagedImportSpec,
): Promise<{ id: number; status: "stored" | "already_present" }> {
  // Idempotency first: an identical original already in the vault wins.
  const existing = await store.findByHash(spec.expectedSha256);
  if (existing) return { id: existing.id, status: "already_present" };

  const bytes = await readFile(spec.stagedPath);
  // Verify BEFORE storing — a mismatch stores nothing.
  if (bytes.length !== spec.expectedBytes) {
    throw new Error(`size mismatch: got ${bytes.length}, expected ${spec.expectedBytes}`);
  }
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== spec.expectedSha256) {
    throw new Error("sha256 mismatch — refusing to store an unverified original");
  }

  const { id } = await store.storeOriginal(bytes, {
    title: spec.title,
    contentType: spec.contentType,
    width: spec.width,
    height: spec.height,
    isR18: spec.isR18,
  });
  return { id, status: "stored" };
}

/**
 * Collect-to-vault: any gallery work can be stored with the same
 * treatment as an upload. Chart works are fetched server-side from the
 * image CDN (with the required Referer); re-adding the same work
 * dedupes by source key instead of storing a second copy.
 */
export async function addToWarehouse(
  store: VaultStore & {
    findBySourceKey(key: string): Promise<{ id: number } | null>;
  },
  fetchOriginal: (sourceUrl: string) => Promise<Uint8Array>,
  work: { sourceKey: string; sourceUrl: string; title: string; width: number; height: number; isR18: boolean },
): Promise<{ id: number; status: "stored" | "already_present" }> {
  const existing = await store.findBySourceKey(work.sourceKey);
  if (existing) return { id: existing.id, status: "already_present" };
  const bytes = await fetchOriginal(work.sourceUrl);
  const sha = createHash("sha256").update(bytes).digest("hex");
  const byHash = await store.findByHash(sha);
  if (byHash) return { id: byHash.id, status: "already_present" };
  const { id } = await store.storeOriginal(bytes, {
    title: work.title,
    contentType: "image/jpeg",
    width: work.width,
    height: work.height,
    isR18: work.isR18,
  });
  return { id, status: "stored" };
}
