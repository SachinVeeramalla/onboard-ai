# Onboard.ai

AI-powered message triage for SaaS onboarding teams. Automates the classification, prioritization, routing, and reply drafting of inbound messages from newly signed customers.

## What It Does

Onboarding teams at SaaS companies receive hundreds of inbound messages weekly from administrators, directors, and staff who need help getting live on the platform. Each message requires a specialist to manually read it, decide what it is, how urgent it is, who should handle it, and whether to draft a reply. At 200 messages a week and 3 to 5 minutes per message, that is up to 17 hours of repetitive work per week.

Onboard.ai automates the entire triage workflow. A specialist pastes a message, hits Submit, and within 10 seconds receives a structured output: category, priority, assigned owner, and a draft reply they can edit and send directly from the tool. The system also accepts bulk CSV uploads for batch processing.

## Architecture

```
React Frontend (Next.js)
      ↓
API Routes (Next.js server)
      ↓
Multi-Agent Pipeline (Orchestrator)
      ↓                    ↓
OpenAI API              Supabase
(5 specialized agents)  (cloud Postgres)
```

### The Five Agents

Each agent does one job and passes its output to the next:

1. **Classifier** — determines message category using few-shot examples from the reference dataset
2. **Priority** — assigns P1 to P4 urgency based on category and message content
3. **Router** — decides which team owns the message
4. **Reply** — drafts an appropriate response (gpt-4o for quality)
5. **Escalation** — determines flags and whether human review is required

Privacy incidents short-circuit the pipeline immediately and route directly to legal compliance with no automated reply.

## Running Locally

### Prerequisites

- Node.js 20+
- An OpenAI API key — [platform.openai.com](https://platform.openai.com)
- A Supabase project — [supabase.com](https://supabase.com)

### Step 1 — Clone the repo

```bash
git clone https://github.com/SachinVeeramalla/onboard-ai.git
cd onboard-ai
```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Set up environment variables

Create a `.env.local` file in the root:

```
OPENAI_API_KEY=your_openai_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SECRET_KEY=your_secret_key
```

### Step 4 — Set up the database

Go to your Supabase project, open the SQL Editor, and run the schema file at `supabase/schema.sql`. Then enable Row Level Security on all tables.

### Step 5 — Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Step 6 — Load your reference dataset

Upload your CSV via the Batch / CSV tab. After processing, mark those rows as reference data in Supabase:

```sql
update triage_results set is_reference = true
where message_id in ('MSG-001', 'MSG-002' /* add all your message IDs */);
```

## How to Use

### Single Message Triage

1. Go to the **Single message** tab
2. Fill in sender name, email, subject, and message body
3. Click **Submit**
4. Watch the five agents run in real time
5. Review the triage result
6. Edit the draft reply if needed
7. Click **Open in email** to send from your email client or **Copy text** to paste elsewhere
8. Mark the result as Correct or Incorrect to contribute to the feedback loop

### Batch / CSV Processing

1. Go to the **Batch / CSV** tab
2. Upload a CSV with columns: `message_id, received_at, sender_name, sender_email, subject, body`
3. Watch the progress bar as each message is processed
4. Click any summary card to filter by priority or category
5. Click any row to expand the full triage card

### Dashboard

1. Go to the **Dashboard** tab
2. All historically processed messages load from Supabase
3. Filter using the summary cards or priority buttons
4. Click any row to expand and view or edit the draft reply

## Message Categories

| Category           | Description                                              |
| ------------------ | -------------------------------------------------------- |
| urgent_escalation  | Customer goes live within 72 hours with a blocking issue |
| billing_issue      | Charges, invoices, plan mismatches                       |
| technical_bug      | Something broken that previously worked                  |
| setup_question     | How to use platform features                             |
| account_management | Admin transfers, ownership changes                       |
| wrong_queue_sales  | New prospect, not an existing customer                   |
| wrong_queue_hr     | Job application                                          |
| follow_up          | Following up on an unanswered message                    |
| privacy_incident   | User can see another customer's data — always P1         |
| multi_topic        | Multiple distinct issues in one message                  |
| vague_insufficient | Insufficient detail to act on                            |

## Priority Levels

| Priority | Meaning                                                           |
| -------- | ----------------------------------------------------------------- |
| P1       | Goes live within 48hrs, privacy incident, or total system failure |
| P2       | Time-sensitive but not immediately blocking                       |
| P3       | Standard queue, no deadline                                       |
| P4       | Wrong queue — redirect only                                       |

## Tech Stack

| Layer      | Technology                         |
| ---------- | ---------------------------------- |
| Frontend   | Next.js 15, React 19, Tailwind CSS |
| API        | Next.js API Routes                 |
| AI         | OpenAI API — gpt-4o-mini + gpt-4o  |
| Database   | Supabase (cloud Postgres)          |
| Deployment | Vercel                             |

## Cost

At current model mix, cost per message is approximately **$0.001**. For 200 messages per week that is roughly **$0.20 per week**.

## Known Limitations

- Multi-topic messages produce one triage output rather than splitting into separate tickets
- Vague messages with no actionable detail are flagged but the clarifying question may not be the right one
- Draft replies are appropriate in tone but generic without access to your product's help documentation
- Batch processing is sequential — high volume scenarios would benefit from a job queue

## Production Roadmap

1. **PII masking** — redact personally identifiable information using Microsoft Presidio before LLM calls
2. **Authentication** — per-user login and data isolation for multiple team members
3. **CRM and ticketing integration** — automatically create tickets in Zendesk, Linear, or Jira from triage output
4. **RAG layer** — index your help documentation so draft replies reference actual product steps
5. **Async job queue** — Supabase pgmq for high-volume batch processing
6. **Fine-tuning** — train a classification model on accumulated feedback data
7. **Multi-tenant support** — configurable taxonomy so different companies can use their own categories
8. **Email webhook** — ingest messages automatically from your support inbox without manual pasting
