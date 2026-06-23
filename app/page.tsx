"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type AgentStep = {
  name: string;
  label: string;
  status: "pending" | "running" | "complete" | "error";
  output?: string;
};

type TriageResult = {
  message: {
    message_id?: string;
    sender_name: string;
    sender_email: string;
    subject: string;
    body: string;
    received_at?: string;
  };
  classification: { category: string; confidence: string; reasoning: string };
  priority: { priority: string; urgency_reason: string };
  routing: {
    assigned_to: string;
    secondary_owner: string;
    routing_reason: string;
  };
  reply: { draft_reply: string; reply_tone: string };
  escalation: {
    flags: string[];
    needs_human_review: boolean;
    escalation_reason: string;
  };
};

type BatchResult = {
  index: number;
  result: TriageResult;
};

type DashboardRow = {
  id: string;
  created_at: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  category: string;
  priority: string;
  assigned_to: string;
  draft_reply: string;
  confidence: string;
  flags: string[];
  needs_human_review: boolean;
  reasoning: string;
  source: string;
};

const BW_PRIMARY = "#4B4EFC";
const BW_PRIMARY_DARK = "#3B3EC7";

const PRIORITY_STYLES: Record<string, string> = {
  P1: "bg-red-100 text-red-800 border border-red-300",
  P2: "bg-amber-100 text-amber-800 border border-amber-300",
  P3: "bg-blue-100 text-blue-800 border border-blue-300",
  P4: "bg-gray-100 text-gray-600 border border-gray-300",
};

const CATEGORY_LABELS: Record<string, string> = {
  urgent_escalation: "Urgent escalation",
  billing_issue: "Billing issue",
  technical_bug: "Technical bug",
  setup_question: "Setup question",
  account_management: "Account management",
  wrong_queue_sales: "Wrong queue — sales",
  wrong_queue_hr: "Wrong queue — HR",
  follow_up: "Follow up",
  privacy_incident: "Privacy incident",
  multi_topic: "Multi topic",
  vague_insufficient: "Vague / insufficient",
};

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-semibold ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.P3}`}
    >
      {priority}
    </span>
  );
}

function SourceBadge({ source }: { source?: string }) {
  if (!source || source === "manual") return null;

  const styles: Record<string, string> = {
    email: "bg-indigo-50 text-indigo-600 border-indigo-200",
    csv: "bg-emerald-50 text-emerald-600 border-emerald-200",
  };

  const labels: Record<string, string> = {
    email: "via email",
    csv: "via CSV",
  };

  const style = styles[source] || "bg-gray-50 text-gray-500 border-gray-200";
  const label = labels[source] || source;

  return (
    <span
      className={`text-xs border px-2 py-0.5 rounded-full hidden md:block ${style}`}
    >
      {label}
    </span>
  );
}

function FlagBadge({ flag }: { flag: string }) {
  const isUrgent =
    flag === "privacy_incident" ||
    flag === "needs_human_review" ||
    flag === "school_opens_soon" ||
    flag === "go_live_soon";
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs border ${isUrgent ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}
    >
      {flag.replace(/_/g, " ")}
    </span>
  );
}

function AgentPipeline({ steps }: { steps: AgentStep[] }) {
  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <div key={step.name} className="flex items-start gap-3 text-sm">
          <div className="w-5 h-5 flex items-center justify-center mt-0.5 flex-shrink-0">
            {step.status === "pending" && (
              <div className="w-3 h-3 rounded-full border-2 border-gray-300" />
            )}
            {step.status === "running" && (
              <div className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            )}
            {step.status === "complete" && (
              <svg
                className="w-4 h-4 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
            {step.status === "error" && (
              <svg
                className="w-4 h-4 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <span
              className={`font-medium ${step.status === "pending" ? "text-gray-400" : step.status === "running" ? "text-blue-600" : "text-gray-700"}`}
            >
              {step.label}
            </span>
            {step.output && (
              <span className="ml-2 text-gray-500">{step.output}</span>
            )}
            {step.status === "running" && !step.output && (
              <span className="ml-2 text-blue-400">running...</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function LogoutButton({ email }: { email?: string | null }) {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="flex items-center gap-3">
      {email && (
        <span className="text-xs text-indigo-200 hidden sm:block">{email}</span>
      )}
      <button
        onClick={handleLogout}
        disabled={loading}
        className="text-xs text-indigo-200 hover:text-white border border-indigo-400 hover:border-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}

function FeedbackRow({
  triageId,
  submitted,
  onSubmit,
}: {
  triageId?: string;
  submitted?: "correct" | "incorrect";
  onSubmit: (id: string, rating: "correct" | "incorrect") => void;
}) {
  const handleSubmit = async (rating: "correct" | "incorrect") => {
    if (!triageId) return;
    onSubmit(triageId, rating);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ triage_id: triageId, rating }),
    });
  };

  if (submitted) {
    return (
      <div className="pt-2 border-t border-gray-100 text-xs text-gray-400">
        {submitted === "correct" ? "Marked as correct" : "Marked as incorrect"}{" "}
        — thank you
      </div>
    );
  }

  return (
    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
      <span className="text-xs text-gray-400">Was this triage accurate?</span>
      <div className="flex gap-2">
        <button
          onClick={() => handleSubmit("correct")}
          className="flex items-center gap-1 px-2.5 py-1 text-xs border border-green-200 text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          Correct
        </button>
        <button
          onClick={() => handleSubmit("incorrect")}
          className="flex items-center gap-1 px-2.5 py-1 text-xs border border-red-200 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          Incorrect
        </button>
      </div>
    </div>
  );
}

function TriageCard({
  result,
  feedbackMap,
  onFeedbackSubmit,
}: {
  result: TriageResult;
  feedbackMap: Record<string, "correct" | "incorrect">;
  onFeedbackSubmit: (id: string, rating: "correct" | "incorrect") => void;
}) {
  const [copied, setCopied] = useState(false);
  const [editedReply, setEditedReply] = useState(result.reply.draft_reply);
  const isPrivacy = result.classification.category === "privacy_incident";
  const isP1 = result.priority.priority === "P1";

  const copyReply = () => {
    navigator.clipboard.writeText(editedReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openInEmail = () => {
    const to = encodeURIComponent(result.message.sender_email || "");
    const subject = encodeURIComponent(`Re: ${result.message.subject || ""}`);
    const body = encodeURIComponent(editedReply);
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };

  return (
    <div
      className={`rounded-xl border ${isPrivacy ? "border-red-300 bg-red-50" : isP1 ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"} overflow-hidden`}
    >
      <div
        className={`px-5 py-3 flex items-center justify-between ${isPrivacy ? "bg-red-100" : isP1 ? "bg-amber-100" : "bg-gray-50"} border-b ${isPrivacy ? "border-red-200" : isP1 ? "border-amber-200" : "border-gray-200"}`}
      >
        <div className="flex items-center gap-2">
          <PriorityBadge priority={result.priority.priority} />
          <span className="font-semibold text-gray-800 text-sm">
            {CATEGORY_LABELS[result.classification.category] ||
              result.classification.category}
          </span>
        </div>
        {result.escalation.needs_human_review && (
          <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded font-medium">
            Human review required
          </span>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">
              From
            </span>
            <p className="text-gray-800 font-medium">
              {result.message.sender_name}
            </p>
            <p className="text-gray-500 text-xs">
              {result.message.sender_email}
            </p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">
              Subject
            </span>
            <p className="text-gray-800 font-medium line-clamp-2">
              {result.message.subject}
            </p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">
              Assigned to
            </span>
            <p className="text-gray-800 font-medium capitalize">
              {result.routing.assigned_to.replace(/_/g, " ")}
            </p>
            {result.routing.secondary_owner && (
              <p className="text-gray-500 text-xs capitalize">
                + {result.routing.secondary_owner.replace(/_/g, " ")}
              </p>
            )}
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">
              Confidence
            </span>
            <p
              className={`font-medium capitalize ${result.classification.confidence === "high" ? "text-green-600" : result.classification.confidence === "medium" ? "text-amber-600" : "text-red-600"}`}
            >
              {result.classification.confidence}
            </p>
          </div>
        </div>

        {result.escalation.flags.length > 0 && (
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide block mb-1.5">
              Flags
            </span>
            <div className="flex flex-wrap gap-1.5">
              {result.escalation.flags.map((flag) => (
                <FlagBadge key={flag} flag={flag} />
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-gray-500 text-xs uppercase tracking-wide">
              Draft reply
            </span>
            <span className="text-xs text-gray-400">Edit before sending</span>
          </div>
          {isPrivacy ? (
            <div className="rounded-lg p-3 text-sm bg-red-100 border border-red-200 text-red-800 font-medium">
              {editedReply}
            </div>
          ) : (
            <textarea
              className="w-full rounded-lg p-3 text-sm text-gray-800 bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 resize-none"
              rows={6}
              value={editedReply}
              onChange={(e) => setEditedReply(e.target.value)}
            />
          )}
          {!isPrivacy && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={openInEmail}
                className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors"
                style={{ backgroundColor: BW_PRIMARY }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = BW_PRIMARY_DARK)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = BW_PRIMARY)
                }
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Open in email
              </button>
              <button
                onClick={copyReply}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                {copied ? "Copied!" : "Copy text"}
              </button>
            </div>
          )}
        </div>

        <div>
          <span className="text-gray-500 text-xs uppercase tracking-wide block mb-1">
            Agent reasoning
          </span>
          <p className="text-sm text-gray-600 italic">
            {result.classification.reasoning}
          </p>
        </div>

        <FeedbackRow
          triageId={result.message.message_id}
          submitted={
            result.message.message_id
              ? feedbackMap[result.message.message_id]
              : undefined
          }
          onSubmit={onFeedbackSubmit}
        />
      </div>
    </div>
  );
}

function ExpandableRow({
  index,
  r,
  feedbackMap,
  onFeedbackSubmit,
}: {
  index: number;
  r: TriageResult;
  feedbackMap: Record<string, "correct" | "incorrect">;
  onFeedbackSubmit: (id: string, rating: "correct" | "incorrect") => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div
        onClick={() => setExpanded(!expanded)}
        className={`px-5 py-3 flex items-center gap-4 text-sm cursor-pointer hover:bg-gray-50 ${r.classification.category === "privacy_incident" ? "bg-red-50" : r.priority.priority === "P1" ? "bg-amber-50" : ""}`}
      >
        <PriorityBadge priority={r.priority.priority} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-800 truncate">
            {r.message.sender_name}
          </p>
          <p className="text-gray-500 text-xs truncate">{r.message.subject}</p>
        </div>
        <span className="text-gray-500 text-xs capitalize hidden sm:block">
          {CATEGORY_LABELS[r.classification.category] ||
            r.classification.category}
        </span>
        <span className="text-gray-500 text-xs capitalize hidden sm:block">
          {r.routing.assigned_to.replace(/_/g, " ")}
        </span>
        <div className="flex gap-1 flex-shrink-0">
          {r.escalation.flags.slice(0, 2).map((f) => (
            <FlagBadge key={f} flag={f} />
          ))}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
      {expanded && (
        <div className="px-5 pb-5 pt-3 bg-gray-50 border-t border-gray-100">
          <TriageCard
            result={r}
            feedbackMap={feedbackMap}
            onFeedbackSubmit={onFeedbackSubmit}
          />
        </div>
      )}
    </div>
  );
}

function Dashboard({
  feedbackMap,
  onFeedbackSubmit,
}: {
  feedbackMap: Record<string, "correct" | "incorrect">;
  onFeedbackSubmit: (id: string, rating: "correct" | "incorrect") => void;
}) {
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/dashboard");
        const data = await res.json();
        setRows(data.rows || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const p1Count = rows.filter((r) => r.priority === "P1").length;
  const privacyCount = rows.filter(
    (r) => r.category === "privacy_incident",
  ).length;
  const reviewCount = rows.filter((r) => r.needs_human_review).length;
  const wrongCount = rows.filter((r) =>
    r.category.startsWith("wrong_queue"),
  ).length;
  const emailCount = rows.filter((r) => r.source === "email").length;
  const csvCount = rows.filter((r) => r.source === "csv").length;
  const manualCount = rows.filter(
    (r) => !r.source || r.source === "manual",
  ).length;

  const priorityFiltered =
    filter === "all"
      ? rows
      : filter === "P1"
        ? rows.filter((r) => r.priority === "P1")
        : filter === "privacy"
          ? rows.filter((r) => r.category === "privacy_incident")
          : filter === "wrong"
            ? rows.filter((r) => r.category.startsWith("wrong_queue"))
            : filter === "review"
              ? rows.filter((r) => r.needs_human_review)
              : rows.filter((r) => r.priority === filter);

  const filtered =
    sourceFilter === "all"
      ? priorityFiltered
      : priorityFiltered.filter((r) =>
          sourceFilter === "manual"
            ? !r.source || r.source === "manual"
            : r.source === sourceFilter,
        );

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
          style={{ borderColor: BW_PRIMARY, borderTopColor: "transparent" }}
        />
        <p className="text-gray-500 text-sm">Loading from Supabase...</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm">
          No messages processed yet. Use Single message or Batch / CSV to get
          started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: "P1 urgent",
            value: p1Count,
            color: "text-red-600",
            filterKey: "P1",
          },
          {
            label: "Privacy incidents",
            value: privacyCount,
            color: "text-red-700",
            filterKey: "privacy",
          },
          {
            label: "Wrong queue",
            value: wrongCount,
            color: "text-gray-600",
            filterKey: "wrong",
          },
          {
            label: "Human review",
            value: reviewCount,
            color: "text-amber-600",
            filterKey: "review",
          },
        ].map((s) => (
          <div
            key={s.label}
            onClick={() =>
              setFilter(filter === s.filterKey ? "all" : s.filterKey)
            }
            className={`rounded-xl border p-4 text-center cursor-pointer transition-all ${filter === s.filterKey ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200" : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}
          >
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <span className="font-semibold text-gray-800 text-sm">
            {filtered.length} of {rows.length} messages
          </span>
          <div className="flex items-center gap-3">
            {/* Source filter */}
            <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5 border border-gray-200">
              {[
                { key: "all", label: `All (${rows.length})` },
                { key: "email", label: `Email (${emailCount})` },
                { key: "csv", label: `CSV (${csvCount})` },
                { key: "manual", label: `Manual (${manualCount})` },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() =>
                    setSourceFilter(sourceFilter === s.key ? "all" : s.key)
                  }
                  className="px-2 py-1 rounded text-xs font-medium transition-colors"
                  style={
                    sourceFilter === s.key
                      ? { backgroundColor: BW_PRIMARY, color: "white" }
                      : { color: "#6b7280" }
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
            {/* Priority filter */}
            <div className="flex gap-1">
              {["all", "P1", "P2", "P3", "P4"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(filter === f ? "all" : f)}
                  className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                  style={
                    filter === f
                      ? { backgroundColor: BW_PRIMARY, color: "white" }
                      : { color: "#6b7280" }
                  }
                >
                  {f === "all" ? "All" : f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filtered.map((row) => (
            <div key={row.id}>
              <div
                onClick={() =>
                  setExpandedId(expandedId === row.id ? null : row.id)
                }
                className={`px-5 py-3 flex items-center gap-4 text-sm cursor-pointer hover:bg-gray-50 ${row.category === "privacy_incident" ? "bg-red-50" : row.priority === "P1" ? "bg-amber-50" : ""}`}
              >
                <PriorityBadge priority={row.priority} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">
                    {row.sender_name}
                  </p>
                  <p className="text-gray-500 text-xs truncate">
                    {row.subject}
                  </p>
                </div>
                <span className="text-gray-500 text-xs capitalize hidden sm:block">
                  {CATEGORY_LABELS[row.category] || row.category}
                </span>
                <span className="text-gray-500 text-xs capitalize hidden sm:block">
                  {row.assigned_to.replace(/_/g, " ")}
                </span>
                <SourceBadge source={row.source} />
                <span className="text-gray-400 text-xs hidden md:block">
                  {new Date(row.created_at).toLocaleDateString()}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${expandedId === row.id ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
              {expandedId === row.id && (
                <div className="px-5 pb-5 pt-3 bg-gray-50 border-t border-gray-100">
                  <TriageCard
                    result={{
                      message: {
                        message_id: row.id,
                        sender_name: row.sender_name,
                        sender_email: row.sender_email,
                        subject: row.subject,
                        body: "",
                      },
                      classification: {
                        category: row.category,
                        confidence: row.confidence,
                        reasoning: row.reasoning,
                      },
                      priority: { priority: row.priority, urgency_reason: "" },
                      routing: {
                        assigned_to: row.assigned_to,
                        secondary_owner: "",
                        routing_reason: "",
                      },
                      reply: { draft_reply: row.draft_reply, reply_tone: "" },
                      escalation: {
                        flags: row.flags || [],
                        needs_human_review: row.needs_human_review,
                        escalation_reason: "",
                      },
                    }}
                    feedbackMap={feedbackMap}
                    onFeedbackSubmit={onFeedbackSubmit}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function initSteps(): AgentStep[] {
  return [
    { name: "classifier", label: "Classifier agent", status: "pending" },
    { name: "priority", label: "Priority agent", status: "pending" },
    { name: "router", label: "Router agent", status: "pending" },
    { name: "reply", label: "Reply agent", status: "pending" },
    { name: "escalation", label: "Escalation agent", status: "pending" },
  ];
}

export default function Home() {
  const [tab, setTab] = useState<"single" | "batch" | "dashboard">("single");
  const [feedbackMap, setFeedbackMap] = useState<
    Record<string, "correct" | "incorrect">
  >({});
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
    };
    getUser();
  }, []);

  const handleFeedbackSubmit = (
    id: string,
    rating: "correct" | "incorrect",
  ) => {
    setFeedbackMap((prev) => ({ ...prev, [id]: rating }));
  };

  const [form, setForm] = useState({
    sender_name: "",
    sender_email: "",
    subject: "",
    body: "",
  });
  const [steps, setSteps] = useState<AgentStep[]>(initSteps());
  const [result, setResult] = useState<TriageResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    sender?: string;
  } | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const updateStep = (
    name: string,
    status: AgentStep["status"],
    output?: string,
  ) => {
    setSteps((prev) =>
      prev.map((s) => (s.name === name ? { ...s, status, output } : s)),
    );
  };

  const handleSingleSubmit = async () => {
    setProcessing(true);
    setResult(null);
    setError(null);
    setSteps(initSteps());

    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = JSON.parse(line.slice(6));
          if (data.step === "complete") {
            const resultWithId = {
              ...data.result,
              message: {
                ...data.result.message,
                message_id:
                  data.result.message.message_id || `single-${Date.now()}`,
              },
            };
            setResult(resultWithId);
          } else if (data.step === "error") {
            setError(data.error);
          } else {
            updateStep(data.step, data.status, data.output);
          }
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBatchProcessing(true);
    setBatchResults([]);
    setBatchProgress(null);
    setBatchFilter("all");

    const text = await file.text();
    const lines = text.trim().split("\n");
    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0]
      .split(delimiter)
      .map((h) => h.trim().replace(/"/g, ""));

    const messages = lines.slice(1).map((line) => {
      const values = line
        .split(delimiter)
        .map((v) => v.replace(/^"|"$/g, "").trim());
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] || "";
      });
      return {
        message_id: obj.message_id,
        received_at: obj.received_at,
        sender_name: obj.sender_name,
        sender_email: obj.sender_email,
        subject: obj.subject,
        body: obj.body,
      };
    });

    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, is_reference: true }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = JSON.parse(line.slice(6));
          if (data.type === "progress") {
            setBatchProgress({
              current: data.current,
              total: data.total,
              sender: data.sender,
            });
          } else if (data.type === "result") {
            setBatchResults((prev) => [
              ...prev,
              { index: data.index, result: data.result },
            ]);
          } else if (data.type === "complete") {
            setBatchProgress(null);
          }
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBatchProcessing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const filteredBatch =
    batchFilter === "all"
      ? batchResults
      : batchFilter === "P1"
        ? batchResults.filter((r) => r.result.priority.priority === "P1")
        : batchFilter === "privacy"
          ? batchResults.filter(
              (r) => r.result.classification.category === "privacy_incident",
            )
          : batchFilter === "wrong"
            ? batchResults.filter((r) =>
                r.result.classification.category.startsWith("wrong_queue"),
              )
            : batchFilter === "review"
              ? batchResults.filter(
                  (r) => r.result.escalation.needs_human_review,
                )
              : batchResults.filter(
                  (r) => r.result.priority.priority === batchFilter,
                );

  const p1Count = batchResults.filter(
    (r) => r.result.priority.priority === "P1",
  ).length;
  const privacyCount = batchResults.filter(
    (r) => r.result.classification.category === "privacy_incident",
  ).length;
  const wrongQueueCount = batchResults.filter((r) =>
    r.result.classification.category.startsWith("wrong_queue"),
  ).length;
  const humanReviewCount = batchResults.filter(
    (r) => r.result.escalation.needs_human_review,
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="text-white px-4 py-4 mb-6"
        style={{ backgroundColor: BW_PRIMARY }}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              style={{ color: BW_PRIMARY }}
            >
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold leading-tight">Onboard.ai</h1>
            <p className="text-indigo-200 text-xs">
              AI-powered message triage for SaaS onboarding teams
            </p>
          </div>
          <LogoutButton email={userEmail} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-8">
        {/* Tab navigation */}
        <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {(["single", "batch", "dashboard"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize"
              style={
                tab === t
                  ? { backgroundColor: BW_PRIMARY, color: "white" }
                  : { color: "#4b5563" }
              }
            >
              {t === "single"
                ? "Single message"
                : t === "batch"
                  ? "Batch / CSV"
                  : "Dashboard"}
            </button>
          ))}
        </div>

        {tab === "single" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="font-semibold text-gray-800">Inbound message</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">
                    Sender name
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 bg-white"
                    placeholder="Sandra Rivera"
                    value={form.sender_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sender_name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">
                    Sender email
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 bg-white"
                    placeholder="srivera@company.com"
                    value={form.sender_email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sender_email: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">
                  Subject
                </label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 bg-white"
                  placeholder="URGENT - users cannot log in"
                  value={form.subject}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, subject: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">
                  Message body
                </label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 resize-none bg-white"
                  rows={5}
                  placeholder="Paste the full message here..."
                  value={form.body}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, body: e.target.value }))
                  }
                />
              </div>
              <button
                onClick={handleSingleSubmit}
                disabled={processing}
                className="w-full text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: processing ? BW_PRIMARY_DARK : BW_PRIMARY,
                }}
              >
                {processing ? "Processing..." : "Submit"}
              </button>
            </div>

            {(processing || result) && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-800 mb-4">
                  Agent pipeline
                </h2>
                <AgentPipeline steps={steps} />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {result && (
              <div>
                <h2 className="font-semibold text-gray-800 mb-3">
                  Triage result
                </h2>
                <TriageCard
                  result={result}
                  feedbackMap={feedbackMap}
                  onFeedbackSubmit={handleFeedbackSubmit}
                />
              </div>
            )}
          </div>
        )}

        {tab === "batch" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-1">Upload CSV</h2>
              <p className="text-sm text-gray-500 mb-4">
                Expects columns: message_id, received_at, sender_name,
                sender_email, subject, body
              </p>
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-indigo-400 transition-colors">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <span className="text-sm text-gray-500">
                  Click to upload CSV or drag and drop
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCSVUpload}
                  disabled={batchProcessing}
                />
              </label>
            </div>

            {batchProgress && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Processing {batchProgress.sender}...</span>
                  <span>
                    {batchProgress.current} / {batchProgress.total}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                      backgroundColor: BW_PRIMARY,
                    }}
                  />
                </div>
              </div>
            )}

            {batchResults.length > 0 && (
              <>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    {
                      label: "P1 urgent",
                      value: p1Count,
                      color: "text-red-600",
                      filterKey: "P1",
                    },
                    {
                      label: "Privacy incidents",
                      value: privacyCount,
                      color: "text-red-700",
                      filterKey: "privacy",
                    },
                    {
                      label: "Wrong queue",
                      value: wrongQueueCount,
                      color: "text-gray-600",
                      filterKey: "wrong",
                    },
                    {
                      label: "Human review",
                      value: humanReviewCount,
                      color: "text-amber-600",
                      filterKey: "review",
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      onClick={() =>
                        setBatchFilter(
                          batchFilter === s.filterKey ? "all" : s.filterKey,
                        )
                      }
                      className={`rounded-xl border p-4 text-center cursor-pointer transition-all ${batchFilter === s.filterKey ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200" : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}
                    >
                      <div className={`text-2xl font-bold ${s.color}`}>
                        {s.value}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="font-semibold text-gray-800 text-sm">
                      {filteredBatch.length} of {batchResults.length} messages
                    </span>
                    <div className="flex gap-1">
                      {["all", "P1", "P2", "P3", "P4"].map((f) => (
                        <button
                          key={f}
                          onClick={() =>
                            setBatchFilter(batchFilter === f ? "all" : f)
                          }
                          className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                          style={
                            batchFilter === f
                              ? { backgroundColor: BW_PRIMARY, color: "white" }
                              : { color: "#6b7280" }
                          }
                        >
                          {f === "all" ? "All" : f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {filteredBatch.map(({ index, result: r }) => (
                      <ExpandableRow
                        key={index}
                        index={index}
                        r={r}
                        feedbackMap={feedbackMap}
                        onFeedbackSubmit={handleFeedbackSubmit}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "dashboard" && (
          <Dashboard
            feedbackMap={feedbackMap}
            onFeedbackSubmit={handleFeedbackSubmit}
          />
        )}
      </div>
    </div>
  );
}
