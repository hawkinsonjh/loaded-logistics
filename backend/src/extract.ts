// Shared AI extraction for Loaded Logistics.
//
// ONE Anthropic call, used by BOTH:
//   - the Rate Cons tab (HTTP POST /api/ai/extract), and
//   - the Phase 2 Gmail worker (src/ingest.ts)
// so the parser that reads a pasted rate con is byte-for-byte the same one that
// reads rate cons out of your inbox. Handles plain email text AND attached PDFs.

const MODEL = "claude-sonnet-4-6";

export interface PdfAttachment {
  filename: string;
  data: string; // standard base64 (not base64url)
}

export interface ExtractedLoad {
  is_rate_con: boolean;
  confidence: number; // 0..1
  broker: string | null;
  rate: number | null; // total linehaul, USD
  miles: number | null;
  origin: string | null; // "City, ST"
  dest: string | null; // "City, ST"
  pickup_date: string | null; // YYYY-MM-DD
  ref: string | null; // load / PO / pro number
  commodity: string | null;
  notes: string | null;
}

const SYSTEM =
  "You extract one freight truckload from a broker email and/or an attached rate confirmation PDF. " +
  "Respond ONLY with a single JSON object — no prose, no code fences. Keys: " +
  "is_rate_con (boolean: true ONLY if this is a real rate confirmation / load tender / carrier confirmation for a booked truckload — " +
  "false for quote requests, load-board blasts, invoices, factoring notices, newsletters, or anything you cannot confirm is a booked load), " +
  "confidence (number 0..1: your confidence it is a rate con AND the figures are right), " +
  "broker (string or null), rate (number — total linehaul in USD, digits only, no $ or commas, or null), " +
  "miles (number or null), origin (string 'City, ST' or null), dest (string 'City, ST' or null), " +
  "pickup_date (YYYY-MM-DD or null), ref (load/PO/pro number or null), commodity (string or null), notes (string or null). " +
  "Use null when unknown. Never invent numbers — only report a rate or mileage you can actually see.";

async function callAnthropic(content: any[], maxTokens = 800): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error("Anthropic error " + r.status + (detail ? " " + detail.slice(0, 200) : ""));
  }
  const data: any = await r.json();
  return (data.content || []).map((c: any) => (c.type === "text" ? c.text : "")).join("\n");
}

function coerceNum(v: any): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseJSON(text: string): any {
  let t = (text || "").trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a >= 0 && b >= 0) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

export async function extractLoad(input: { text?: string; pdfs?: PdfAttachment[] }): Promise<ExtractedLoad> {
  const content: any[] = [];
  const text = (input.text || "").trim();
  content.push({ type: "text", text: text || "(no email body — read the attached rate confirmation PDF)" });
  for (const p of input.pdfs || []) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: p.data },
    });
  }

  const raw = await callAnthropic(content, 800);
  const j = parseJSON(raw);
  return {
    is_rate_con: !!j.is_rate_con,
    confidence: coerceNum(j.confidence) ?? 0,
    broker: j.broker ?? null,
    rate: coerceNum(j.rate),
    miles: coerceNum(j.miles),
    origin: j.origin ?? null,
    dest: j.dest ?? null,
    pickup_date: j.pickup_date ?? null,
    ref: j.ref != null ? String(j.ref) : null,
    commodity: j.commodity ?? null,
    notes: j.notes ?? null,
  };
}
