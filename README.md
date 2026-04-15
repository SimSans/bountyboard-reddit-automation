# BountyBoard Reddit Automation

  AI-powered Reddit post generator for [BountyBoard](https://bountyboard.replit.app) — a freelance bounty platform.

  ## What it does

  Rotates through relevant subreddits, uses Groq (Llama 3.3 70B) to generate subreddit-appropriate content, and saves drafts to Supabase for manual review + posting.

  **Subreddits covered:** r/SideProject, r/freelance, r/entrepreneur, r/workonline, r/digitalnomad, r/startups, r/forhire, r/slavelabour, r/remotework, r/indiehackers

  **Post styles:**
  - `show_reddit` — honest "Show Reddit:" founder announcements
  - `discussion` — genuine pain-point discussions that naturally mention the platform
  - `helpful` — resource lists where BountyBoard appears as one option
  - `hiring` — realistic [HIRING] posts as if a client is posting a task

  ## How it works

  1. Queries Supabase to find which subreddit is most overdue (respects per-subreddit cooldown periods)
  2. Generates a post using Groq AI with subreddit-appropriate tone and style
  3. Saves a draft to Supabase `reddit_posts` table
  4. Admin reviews the draft in the BountyBoard Admin Panel → REDDIT tab
  5. Copy title + body, paste to Reddit manually, then click "MARK POSTED"

  ## Files

  - `generate_reddit_drafts.mjs` — main script, run daily by the scheduler or manually
  - `setup_reddit_schema.mjs` — prints the SQL to create the Supabase table

  ## Setup

  ```bash
  # 1. Create the Supabase table — run this and copy the SQL output into your Supabase SQL editor
  node setup_reddit_schema.mjs

  # 2. Set environment variables
  SUPABASE_URL=...
  SUPABASE_SERVICE_ROLE_KEY=...
  GROQ_API_KEY=...

  # 3. Run the draft generator
  node generate_reddit_drafts.mjs
  ```

  ## Dependencies

  ```bash
  npm install @supabase/supabase-js
  ```

  ---

  Built for [BountyBoard](https://bountyboard.replit.app)
  