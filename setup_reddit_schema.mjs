/**
 * Creates the reddit_posts table in Supabase.
 * Run once: node automation/setup_reddit_schema.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Use Supabase's REST API to run raw SQL via the rpc endpoint
async function sql(query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ sql: query }),
  });
  // If exec_sql RPC doesn't exist, fall back to direct insert approach
  if (res.status === 404) return null;
  return res;
}

async function main() {
  console.log("Setting up reddit_posts table in Supabase...\n");

  // Try inserting a dummy row to see if the table exists
  const { error: checkError } = await supabase
    .from("reddit_posts")
    .select("id")
    .limit(1);

  if (!checkError) {
    console.log("✓ Table 'reddit_posts' already exists.");
    return;
  }

  // Any error here means the table is missing (different Supabase clients return different codes)
  console.log(`Note: ${checkError.message}\n`);
  console.log("Table 'reddit_posts' does not exist.\n");
  console.log("Please run the following SQL in your Supabase SQL editor:");
  console.log("  → Go to supabase.com → your project → SQL Editor → New query\n");
  console.log("─".repeat(60));
  console.log(`
CREATE TABLE IF NOT EXISTS reddit_posts (
  id              bigserial PRIMARY KEY,
  subreddit       text        NOT NULL,
  title           text        NOT NULL,
  body            text,
  status          text        NOT NULL DEFAULT 'posted',
  reddit_post_id  text,
  post_url        text,
  error_message   text,
  posted_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reddit_posts_subreddit_idx ON reddit_posts (subreddit);
CREATE INDEX IF NOT EXISTS reddit_posts_status_idx    ON reddit_posts (status);
CREATE INDEX IF NOT EXISTS reddit_posts_posted_at_idx ON reddit_posts (posted_at DESC);
  `.trim());
  console.log("─".repeat(60));
  console.log("\nAfter running that SQL, re-run this script to confirm it worked.");
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
