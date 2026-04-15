/**
 * BountyBoard Reddit Draft Generator
 *
 * Same subreddit rotation + AI generation as the full automation script,
 * but SAVES DRAFTS instead of posting — so you can review and post manually.
 *
 * Drafts appear in the Admin Panel → REDDIT tab.
 * Run manually: node automation/generate_reddit_drafts.mjs
 * Runs automatically: daily via redditScheduler (2:00 PM UTC)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROQ_API_KEY         = process.env.GROQ_API_KEY;
const APP_URL              = process.env.APP_URL || "https://bountyboard.replit.app";

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_KEY, GROQ_API_KEY })) {
  if (!v) { console.error(`Missing env var: ${k}`); process.exit(1); }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Subreddit rotation ─────────────────────────────────────────────────────────
const SUBREDDITS = [
  { name: "SideProject",   cooldownDays: 14, style: "show_reddit"  },
  { name: "freelance",     cooldownDays: 10, style: "discussion"   },
  { name: "entrepreneur",  cooldownDays: 14, style: "discussion"   },
  { name: "workonline",    cooldownDays: 10, style: "helpful"      },
  { name: "digitalnomad",  cooldownDays: 14, style: "discussion"   },
  { name: "startups",      cooldownDays: 21, style: "show_reddit"  },
  { name: "forhire",       cooldownDays:  7, style: "hiring"       },
  { name: "slavelabour",   cooldownDays:  7, style: "hiring"       },
  { name: "Jobs4Bitcoins",  cooldownDays: 14, style: "hiring"      },
  { name: "remotework",    cooldownDays: 14, style: "discussion"   },
  { name: "indiehackers",  cooldownDays: 14, style: "show_reddit"  },
];

// ── Groq AI ────────────────────────────────────────────────────────────────────
async function groqComplete(prompt) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
      max_tokens: 700,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  return (await res.json()).choices[0].message.content.trim();
}

function buildPrompt(sub) {
  const base = `BountyBoard (${APP_URL}) is a freelance bounty platform. Clients post fixed-reward tasks, AI screens applicants (no experience gatekeeping), and payment is held in Stripe escrow until work is accepted. Anyone can claim a bounty — beginners welcome.`;

  const guides = {
    show_reddit: `Write a genuine "Show Reddit" post for r/${sub.name} announcing BountyBoard.
- Title: start with "Show Reddit:" or "Show r/${sub.name}:"
- Honest founder tone — what it does, why you built it, what makes it different
- Mention AI screening + Stripe escrow as key differentiators
- Invite feedback and questions, end with the URL
- 150-250 words in body
- Sound like a founder, NOT an ad
- Output: first line = title, blank line, then body`,

    discussion: `Write a genuine discussion post for r/${sub.name} about a freelancing pain point (payment protection, getting first clients, gatekeeping in hiring, etc.) that naturally mentions BountyBoard.
- Title: engaging question or observation (NOT about BountyBoard directly)
- Open with pain point + personal experience, mention BountyBoard in the middle/end
- Include the URL once, naturally. 180-280 words in body
- Sound like a real person, not a marketer
- Output: first line = title, blank line, then body`,

    helpful: `Write a genuinely helpful post for r/${sub.name} listing places to find quick freelance work online, with BountyBoard as one of them (not the first, not over-hyped).
- Title: genuinely helpful (e.g. "Here are 5 places to find quick online gigs right now")
- Give real actionable advice. BountyBoard gets one item with the URL
- 200-300 words total. Sound like someone actually trying to help
- Output: first line = title, blank line, then body`,

    hiring: `Write a realistic [HIRING] post for r/${sub.name} as if a client is posting a task they'd put on BountyBoard.
- Title format: [HIRING] [Task type] | $X budget | Short description
- Describe the task as a real client would — specific, reasonable scope + budget
- Mention they're using BountyBoard with the URL. 100-180 words
- Sound like a real client post, not marketing copy
- Output: first line = title, blank line, then body`,
  };

  return `${base}\n\n${guides[sub.style]}`;
}

// ── Supabase helpers ───────────────────────────────────────────────────────────
async function ensureTable() {
  const { error } = await supabase.from("reddit_posts").select("id").limit(1);
  if (error) {
    console.error("Table 'reddit_posts' missing. Run: node automation/setup_reddit_schema.mjs");
    console.error("Then run the printed SQL in your Supabase SQL editor.");
    process.exit(1);
  }
}

async function getLastActivity(subredditName) {
  const { data } = await supabase
    .from("reddit_posts")
    .select("posted_at, created_at, status")
    .eq("subreddit", subredditName)
    .in("status", ["posted", "draft"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (!data?.[0]) return null;
  // Use posted_at if actually posted, otherwise created_at of draft
  return new Date(data[0].posted_at || data[0].created_at);
}

async function saveDraft(subredditName, title, body) {
  const { error } = await supabase.from("reddit_posts").insert({
    subreddit: subredditName,
    title,
    body,
    status: "draft",
    posted_at: null,
  });
  if (error) throw new Error(`Supabase insert: ${error.message}`);
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== BountyBoard Reddit Draft Generator ===\n");

  await ensureTable();

  const now = Date.now();
  let target = null;
  let mostOverdue = -Infinity;

  for (const sub of SUBREDDITS) {
    const lastActivity = await getLastActivity(sub.name);
    const cooldownMs = sub.cooldownDays * 24 * 60 * 60 * 1000;

    if (!lastActivity) {
      if (Infinity > mostOverdue) { mostOverdue = Infinity; target = sub; }
    } else {
      const msSince = now - lastActivity.getTime();
      if (msSince >= cooldownMs && msSince > mostOverdue) {
        mostOverdue = msSince;
        target = sub;
      }
    }
  }

  if (!target) {
    console.log("All subreddits are within their cooldown window. No draft needed today.");
    return;
  }

  console.log(`Target: r/${target.name}  (style: ${target.style}, cooldown: ${target.cooldownDays}d)\n`);
  console.log("Generating post with AI...");

  const raw = await groqComplete(buildPrompt(target));

  const lines = raw.split("\n");
  let title = lines[0].replace(/^#+\s*/, "").trim();
  let body  = lines.slice(2).join("\n").trim();
  body = body.replace(/^#+\s+/gm, "");

  if (title.length > 300) title = title.slice(0, 297) + "...";

  console.log(`\n  Title : ${title}`);
  console.log(`  Body  : ${body.length} chars\n`);

  await saveDraft(target.name, title, body);

  console.log(`✓ Draft saved for r/${target.name}`);
  console.log("  → Review and post it from the Admin Panel → REDDIT tab");
  console.log("\n=== Done ===");
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
