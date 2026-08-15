import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Naeel's source material for the assistant.
 *
 * The previous implementation re-read both files from disk on every single
 * chat request. They never change between deploys, so they are read once and
 * memoised for the life of the process. `loading` deduplicates the read when
 * several requests arrive during a cold start.
 */

type Profile = { summary: string; linkedin: string };

let cached: Profile | null = null;
let loading: Promise<Profile> | null = null;

const CONTENT_DIR = path.join(process.cwd(), "public", "me");

async function read(file: string): Promise<string> {
  // Fixed filenames only — nothing here is caller-controlled.
  return (await fs.readFile(path.join(CONTENT_DIR, file), "utf-8")).trim();
}

export async function getProfile(): Promise<Profile> {
  if (cached) return cached;
  if (loading) return loading;

  loading = (async () => {
    const [summary, linkedin] = await Promise.all([
      read("summary.txt"),
      read("Linkedin.txt"),
    ]);
    cached = { summary, linkedin };
    return cached;
  })();

  try {
    return await loading;
  } catch (error) {
    loading = null; // let the next request retry rather than caching a failure
    throw error;
  }
}
