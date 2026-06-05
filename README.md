# Brightwheel Onboarding Triage System

An AI-powered triage system that eliminates manual message processing for Brightwheel's onboarding team. Built as a response to the AI Automation Builder take-home exercise.

## What It Does

The onboarding team receives ~200 inbound messages per week from newly signed schools. Each message requires manual classification, prioritization, routing, and reply drafting — taking 3–5 minutes per message. This system automates that entire workflow using a multi-agent AI pipeline.

For each inbound message the system produces:

- **Category** — what type of issue it is
- **Priority** — P1 (urgent) through P4 (wrong queue)
- **Assigned owner** — who handles it
- **Draft reply** — editable, ready to send
- **Flags** — escalation signals like privacy incidents or school opening soon
- **Confidence score** — how certain the AI is, with human review flag when low

---

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

Each agent has one job and passes its output to the next:

1. **Classifier** — determines message category using keyword overlap with the 25-message reference dataset for few-shot context
2. **Priority** — assigns P1–P4 urgency based on category and message content
3. **Router** — decides which team owns the message
4. **Reply** — drafts an appropriate response (gpt-4o for quality)
5. **Escalation** — determines flags and whether human review is required

Privacy incidents short-circuit the pipeline immediately — they never reach the standard reply agent and are routed directly to legal compliance.

---

## Running Locally

### Prerequisites

- Node.js 18+
- An OpenAI API key — [platform.openai.com](https://platform.openai.com)
- A Supabase project — [supabase.com](https://supabase.com)

### Step 1 — Clone the repo

```bash
git clone https://github.com/SachinVeeramalla/brightwheel-triage.git
cd brightwheel-triage
```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Set up environment variables

Create a `.env.local` file in the root of the project:

```bash
touch .env.local
```

Add the following:

```
OPENAI_API_KEY=your_openai_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SECRET_KEY=your_secret_key
```

You can find your Supabase keys at: **Project Settings → API** in your Supabase dashboard.

### Step 4 — Set up the database

Go to your Supabase project → **SQL Editor** and run the schema file found in `supabase/schema.sql`.

Enable Row Level Security on all tables after running the schema.

### Step 5 — Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Step 6 — Load the reference dataset

Upload the provided `bw_onboarding_tickets.csv` via the **Batch / CSV** tab. After processing completes, mark those rows as reference data in Supabase SQL editor:

```sql
update triage_results set is_reference = true
where message_id in (
  'MSG-001','MSG-002','MSG-003','MSG-004','MSG-005',
  'MSG-006','MSG-007','MSG-008','MSG-009','MSG-010',
  'MSG-011','MSG-012','MSG-013','MSG-014','MSG-015',
  'MSG-016','MSG-017','MSG-018','MSG-019','MSG-020',
  'MSG-021','MSG-022','MSG-023','MSG-024','MSG-025'
);
```

The system will now use these 25 messages as few-shot reference examples for every new classification.

---

## How to Use

### Single Message Triage

1. Go to the **Single Message** tab
2. Fill in sender name, email, subject, and message body
3. Click **Submit**
4. Watch the five agents run in real time
5. Review the triage result — category, priority, assigned owner, flags
6. Edit the draft reply if needed
7. Click **Open in email** to send directly from your email client, or **Copy text** to paste elsewhere
8. Mark the result as Correct or Incorrect to contribute to the feedback loop

### Batch / CSV Processing

1. Go to the **Batch / CSV** tab
2. Upload a CSV file with columns: `message_id, received_at, sender_name, sender_email, subject, body`
3. Watch the progress bar as each message is processed
4. Click the summary cards to filter by P1, Privacy incidents, Wrong queue, or Human review
5. Click any row to expand the full triage card including the editable draft reply

### Dashboard

1. Go to the **Dashboard** tab
2. All historically processed messages load from Supabase
3. Filter using the summary cards or the P1/P2/P3/P4 buttons
4. Click any row to expand and view or edit the draft reply

---

## Features

- **Multi-agent pipeline** with live streaming progress — watch each agent complete in real time
- **Reference dataset** — the 25 CSV messages inform every new classification via few-shot context
- **Privacy incident short-circuit** — routes immediately to legal compliance, never sends an automated reply
- **Editable draft replies** with one-click mailto integration
- **Token tracking** — every agent call logs tokens and estimated cost to Supabase
- **Human feedback loop** — correct/incorrect ratings stored for prompt iteration
- **Clickable filter cards** — instantly filter by P1, privacy, wrong queue, or human review
- **Expandable rows** in batch and dashboard — click any message to see the full triage card

---

## Message Categories

| Category           | Description                                        |
| ------------------ | -------------------------------------------------- |
| urgent_escalation  | School opens within 72 hours with a blocking issue |
| billing_issue      | Charges, invoices, plan mismatches                 |
| technical_bug      | Something broken that previously worked            |
| setup_question     | How to use platform features                       |
| account_management | Admin transfers, ownership changes                 |
| wrong_queue_sales  | New prospect, not an existing customer             |
| wrong_queue_hr     | Job application                                    |
| follow_up          | Following up on an unanswered message              |
| privacy_incident   | User can see another family's data — always P1     |
| multi_topic        | Multiple distinct issues in one message            |
| vague_insufficient | Insufficient detail to act on                      |

---

## Priority Levels

| Priority | Meaning                                                              |
| -------- | -------------------------------------------------------------------- |
| P1       | School opens within 48hrs, privacy incident, or total system failure |
| P2       | Time-sensitive but not immediately blocking                          |
| P3       | Standard queue, no deadline                                          |
| P4       | Wrong queue — redirect only, no onboarding action needed             |

---

## Cost

At current model mix — gpt-4o-mini for classification, priority, routing, and escalation; gpt-4o for reply drafting — cost per message is approximately **$0.001**. For 200 messages/week that's roughly **$0.20/week**.

---

## Tech Stack

| Layer      | Technology                         |
| ---------- | ---------------------------------- |
| Frontend   | Next.js 15, React 19, Tailwind CSS |
| API        | Next.js API Routes (server-side)   |
| AI         | OpenAI API — gpt-4o-mini + gpt-4o  |
| Database   | Supabase (cloud Postgres)          |
| Deployment | Vercel                             |

---

## Known Limitations

- **Multi-topic messages** produce one triage output. A message with 3 distinct issues needs manual splitting into separate tickets.
- **Vague messages** produce low-confidence output flagged for human review. The clarifying question in the draft may not ask the right thing.
- **Privacy incidents** never receive an automated reply — always escalated to legal compliance with a hardcoded response.
- **Draft replies** are grounded in prompt engineering, not Brightwheel's actual help documentation. A RAG layer would significantly improve reply specificity.
- **Batch processing** is sequential. For high-volume scenarios a job queue would be needed.

---

## Production Roadmap

1. **RAG layer** — index Brightwheel help docs with pgvector so replies reference actual product steps
2. **Async job queue** — Supabase pgmq for high-volume batch processing
3. **Authentication** — per-user data isolation for multiple specialists
4. **PII masking** — Microsoft Presidio before LLM calls for COPPA/FERPA compliance
5. **Fine-tuning** — at 100+ labeled feedback examples, fine-tune gpt-4o-mini on this specific classification task
