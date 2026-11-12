# Sales Debrief Agent — Technical Specification

Version 0.1 · 2026-09-05 · Status: draft for PoC build
Platform: kitstack (core = kit, trigger endpoints = SDK plugin)

---

## 1. Summary

An AI phone assistant for field sales reps. It detects the end of a customer meeting via the rep's calendar, calls the rep on their mobile, runs a short structured debrief interview (German), and writes the resulting entry to the CRM. Confirmation and corrections happen over SMS. A prep brief before the next meeting closes the loop.

Product framing: **this is the rep's assistant**, a prep-to-debrief pipeline. The CRM entry is the byproduct, not the pitch. Every design decision below is tested against that framing.

Design invariants:

1. **Push, not pull.** The agent initiates. The rep never has to remember anything.
2. **The rep's own account only.** The customer conversation is never recorded or processed. No §201 StGB exposure, no customer consent needed.
3. **Question count is computed, not scripted.** The agent asks only for what the rep didn't already say.
4. **No entry without confirmation.** Read-back on the call, correction window over SMS. A wrong CRM entry is worse than an empty one.
5. **Worker-friendly by construction.** No per-rep performance metrics, no audio retention, rep-owned skip. Betriebsvereinbarungs-fähig by design.

## 2. Success criteria (PoC / volunteer pilot)

| Metric | Target | Source |
|---|---|---|
| Meetings with committed CRM entry ≤ 24 h | ≥ 80 % | pipeline events |
| First-attempt answer rate | ≥ 60 % | call events |
| Median call duration | ≤ 2:00, hard cap 3:00 | call events |
| Entries corrected after commit | ≤ 20 % | SMS corrections |
| Tier-1 field extraction accuracy (vs. golden set) | ≥ 95 % | offline evals |
| Rep verdict ("would you keep it?") | ≥ 4/5 volunteers yes | interviews |

Demo criterion (director): calendar event ends → phone rings → ≤ 2 min call → entry visible in CRM UI. One take, no cuts.

## 3. Scope

**v0 (PoC, demo + volunteer pilot)**

- Calendar: Google Calendar or MS Graph (pick per what Ströer volunteers use; abstract behind connector interface).
- Telephony: Twilio (PSTN outbound + inbound on one number, media streams). SIP trunk not needed for PoC.
- CRM: HubSpot free tier as the demo CRM (real API, real UI, zero mock work), schema mirrored from Ströer's actual required fields once known. CRM access is an adapter (plugin) from day one.
- Channels: SMS out/in (Twilio). Prep brief as SMS.
- Language: German only.
- Single org, ≤ 10 reps, config in YAML per org/rep.

**Non-goals for v0**

- WhatsApp (channel plugin later; SMS proves the loop).
- Recording/summarizing the customer meeting itself — never, at any version.
- Auth/multi-tenant hardening, billing, admin UI.
- Email prep/follow-up drafting (v1 candidate; the follow-up email is the strongest "assistant" feature after the call itself).
- Salesforce adapter (v1, once Ströer's CRM is confirmed).

## 4. Architecture

### 4.1 Kit / plugin boundary

The **kit** is the agent: all state, policy, and intelligence. The **trigger plugin** is dumb transport: it exposes HTTP/WS endpoints in the SDK, validates the sender, normalizes the payload into an internal event, and hands it to the kit. No business logic in the plugin — endpoints must be replaceable (e.g. a different telephony vendor) without touching the kit.

**Trigger plugin — endpoint surface**

| Endpoint | Source | Normalized event |
|---|---|---|
| `POST /t/calendar` | Google push channel / Graph subscription notification | `calendar.changed { repId }` |
| `POST /t/voice/status` | Twilio call status callbacks | `call.status { sessionId, status }` |
| `WS /t/voice/media` | Twilio `<Connect><Stream>` bidirectional media | audio frames ↔ voice session |
| `POST /t/sms/inbound` | Twilio inbound SMS | `sms.received { from, body }` |
| `POST /t/tick` | EventBridge Scheduler | `scheduler.tick` (due debriefs, retries, expiries) |
| `POST /t/manual` | dev/demo | any event, signed |

All webhook endpoints validate provider signatures (Twilio `X-Twilio-Signature`, Graph validation token / Google channel token). Unsigned → 403, no side effects.

**Kit — internal components**

```
                        ┌──────────────────────────────────────────┐
 trigger plugin ──────▶ │ event router                             │
                        │   ├─ meeting ingestion + classification  │
                        │   ├─ debrief scheduler (state machine)   │
                        │   ├─ voice session orchestrator          │
                        │   │    STT ⇄ interview engine ⇄ TTS      │
                        │   ├─ extraction service (async)          │
                        │   ├─ messaging service (SMS, prep brief) │
                        │   └─ flywheel logger (snapshots/deltas)  │
                        │ plugins: crm adapter · calendar connector │
                        │          channel (sms) · trigger sources │
                        └──────────────────────────────────────────┘
```

### 4.2 AWS mapping (SST)

- API/webhooks: API Gateway (HTTP + WS) → Lambda; media WS session pinned to a lightweight Fargate task or a long-running Lambda per active call (media loops don't fit request/response Lambdas — decide in M1 latency test; Fargate is the safe default).
- State: DynamoDB (single-table, entities below). Scheduling: EventBridge Scheduler one-off schedules per debrief (created at meeting classification, cancelled on state change) — no polling.
- Region: `eu-central-1` only. Transcripts in S3 (SSE, lifecycle 30 d). Secrets in SSM.
- LLM: Anthropic API. Conversation turns on a fast model (low TTFT); extraction and classification on a stronger model, async. Both configurable per config file (§6).

## 5. Data model

Entities (DynamoDB single table, `pk`/`sk` sketch):

**Rep** `REP#{id}` — name, mobile (E.164, verified), calendarRef, crmUserRef, config overrides, consent record (timestamp, version), active flag.

**Meeting** `REP#{id} / MTG#{id}` — source event id, title, start/end, attendees (hashed emails), location, classification (`customer | internal | unknown | rep_labeled_non_customer`), matched `accountRef`, matchConfidence.

**DebriefSession** `MTG#{id} / DBF#{n}` — state (§7 state machine), attempts [{ts, outcome}], scheduledAt, callSid, transcriptRef (S3), durationSec, questionCount, endReason.

**EntryDraft** `DBF#{id} / DRAFT` — extraction output (schema §10), per-field confidence + evidence span, status (`draft | confirmed | committed | patched`), crmRefs after commit (activity id, task id, deal id).

**Account cache** `ACC#{crmId}` — name, open deal + stage, last activity summary, openFollowUps[] (feeds context pack and memory question). Refreshed at schedule time, not at call time.

**Correction** `DRAFT#{id} / COR#{ts}` — raw SMS text, resolved patch, applied flag. Primary flywheel signal.

## 6. Configuration (YAML)

All behavior parametrized; org file + per-rep overrides. This is the product's tuning surface and the target of flywheel updates.

```yaml
org: stroer-research
locale: de-DE
form_of_address: du            # du | sie — confirm in rep workshop
models:
  conversation: <fast, low-latency>
  extraction: <strong>
trigger:
  buffer_min: 15
  workday: { start: "08:00", end: "19:00", tz: Europe/Berlin }
  min_meeting_min: 15
  max_calls_per_day: 4
  retry: { count: 1, delay_min: 30 }
  expire_after_h: 24
  batch_gap_min: 20            # meetings closer than this → one combined call
interview:
  open_listen_max_s: 75
  tier1: [outcome_summary, next_step, next_step_date, stage]
  tier2: [decision_maker, objections, competitor, budget_signal]
  tier2_max_questions: 1
  tier2_only_if_elapsed_lt_s: 90
  memory_question: true        # max 1, from openFollowUps
  max_agent_questions: 6
  hard_cap_s: 180
  readback: required
channels:
  confirm: sms
  prep_brief: { enabled: true, lead_min: 30 }
crm:
  adapter: hubspot
  stage_enum: [Erstkontakt, Bedarf, Angebot, Verhandlung, Abschluss, Verloren]
privacy:
  retain_audio: never
  retain_transcript_days: 30
  performance_dashboards: none
```

## 7. Trigger & call policy

### 7.1 Meeting eligibility (classification)

A calendar change triggers re-classification of affected events. An event is a **customer meeting** candidate if: has ≥ 1 non-org attendee OR a physical location; duration ≥ `min_meeting_min`; not all-day; not private-flagged; title/attendees don't match internal patterns. Classification = rules first, LLM tie-break on `unknown` (title + attendees + location → `customer | internal`, no other data). Rep feedback ("das war kein Kundentermin") writes a durable negative label for that account/pattern.

Account matching: attendee email domain → CRM company; else fuzzy title/location match; below threshold → resolve in the call's first turn ("Bei welchem Kunden warst du gerade?") rather than blocking.

### 7.2 Debrief lifecycle state machine

```
DETECTED → ELIGIBLE → SCHEDULED ──▶ CALLING(1) ─answer─▶ IN_CALL ─▶ COMPLETED
                        │                │ no answer                    │ partial
                        │                ▼                              ▼
                        │           RETRY_WAIT(30m) → CALLING(2)   COMPLETED_PARTIAL
                        │                │ no answer
                        │                ▼
                        │             NUDGED (SMS, callback open) ──▶ EXPIRED (24 h)
                        └─ SKIPPED (rep) / SUPPRESSED (policy) at any point
```

Rules:

- Schedule at `end + buffer_min`. If the rep's calendar shows an adjacent event starting within `batch_gap_min` of the end, defer and **batch**: one call covering all meetings since the last debrief, iterating the interview per meeting.
- Never call during another calendar event, outside `workday`, or past `max_calls_per_day` (excess meetings go straight to NUDGED).
- Inbound is always open: the rep can call the number anytime; an open SCHEDULED/NUDGED session for that rep attaches to the inbound call. Push by default, pull always available.
- Snooze intents (in-call, or SMS "20 min", "später", "morgen") reschedule once; second snooze → NUDGED.
- Every transition emits an event to the flywheel log.

## 8. Voice pipeline

- **Telephony:** Twilio Programmable Voice, one DE number. Outbound with rep's saved E.164 only; inbound accepted only from verified rep numbers (caller-ID match; unknown callers get a polite reject). Answering-machine detection on outbound → no message, count as no-answer.
- **Pipeline:** Twilio `<Connect><Stream>` (bidirectional PCM) ⇄ orchestrator: streaming STT (German, custom vocabulary: Ströer product names, city names, top account names from CRM) → interview engine (fast model, streaming) → streaming TTS (German neural voice, neutral, clearly synthetic — no human impersonation; agent introduces itself as Assistent).
- **Latency budget (mouth-to-ear):** p50 ≤ 1.2 s, p95 ≤ 2.0 s. Split: STT endpointing 300 ms · LLM TTFT 400 ms · TTS TTFB 250 ms · network/jitter 250 ms. If unreachable with the pipeline, this kills the product feel — M1 gate.
- **Turn-taking:** barge-in mandatory (rep audio cancels TTS immediately). Endpointing tuned for monologue phase (longer silence tolerance ~1.5 s during open question, ~0.8 s otherwise). Filler acknowledgements ("mhm", "okay") only while in listen phase.
- **Failure handling:** STT confidence collapse or 3 s dead air twice → agent offers SMS fallback and closes gracefully; session → COMPLETED_PARTIAL with whatever was captured.
- **Environment reality:** reps call from cars. Test with road noise and Bluetooth hands-free audio profiles in M1, not after.

## 9. Interview engine

State machine over the live transcript. The agent never works from a fixed script; it computes the gap between the running extraction and the tier-1 field set.

**Phases**

0. **Greet + context** (≤ 2 sentences): name the account, prove context. Batched call: name the list, take meetings one at a time.
1. **Open question** (exactly one): "Wie war's bei {account}?" Then listen up to `open_listen_max_s`. No interruptions except fillers.
2. **Gap-fill (tier 1):** after the monologue, ask only for missing tier-1 fields, one question per turn, max 3. A rep who gave everything gets zero questions here.
3. **Memory question** (max 1, if `openFollowUps` non-empty): "Letztes Mal wolltest du {followUp} — ist das erledigt?" This is the assistant moment; never skip it to save time if it exists.
4. **Tier-2 opportunistic** (max `tier2_max_questions`, only if elapsed < `tier2_only_if_elapsed_lt_s` and the rep isn't rushing): pick the highest-value missing tier-2 field.
5. **Read-back** (required): one sentence covering tier-1 values. "Passt das so?" Corrections looped inline, max 2, then defer remaining corrections to SMS.
6. **Close** (≤ 1 sentence). If a next meeting is on the calendar, optionally announce the prep brief.

**Hard limits:** `max_agent_questions` total, `hard_cap_s` wall clock. On breach: read back what exists, close, mark COMPLETED_PARTIAL.

**Conversational rules (encoded in system prompt):** German, `form_of_address` from config; one question per turn; short declarative sentences; no filler praise, no small talk; mirror the rep's pace; "keine Zeit" → offer snooze immediately; never argue with a correction; never invent CRM facts — context pack only.

**Context pack** (assembled at schedule time, injected at call start — no tool calls during the conversation loop): rep name + form of address, meeting metadata, account summary, open deal + stage, last activity summary, openFollowUps, today's other debriefed meetings (for batch). Tool use inside the voice loop is limited to `end_call` and `schedule_callback` to protect latency; everything else is precomputed or async.

## 10. Extraction & write path

**Runs async, in parallel to the call** — after each rep utterance, the strong model re-extracts against the full transcript so far. The interview engine reads the latest draft to compute the gap; the voice loop never waits on extraction (fallback: previous draft).

**EntryDraft schema (v0, HubSpot mapping):**

```json
{
  "account": {"crmId": "...", "confidence": 0.97},
  "outcome_summary": {"value": "2 Citylight-Standorte, Budget bestätigt", "confidence": 0.9, "evidence": "t_014"},
  "next_step": {"value": "Angebot senden", "confidence": 0.95, "evidence": "t_018"},
  "next_step_date": {"value": "2026-09-12", "confidence": 0.9, "evidence": "t_018"},
  "stage": {"value": "Angebot", "confidence": 0.85, "evidence": "t_014"},
  "decision_maker": {"value": "Fr. Müller, anwesend", "confidence": 0.8, "evidence": "t_014"},
  "objections": null,
  "competitor": null,
  "budget_signal": {"value": "Budget passt", "confidence": 0.7, "evidence": "t_014"},
  "free_notes": "…everything said that fits no field, verbatim-close…"
}
```

**Validation rules:** dates resolved against the meeting date as anchor ("Freitag" → next Friday from meeting day), always ISO, ambiguous → ask, never guess. `stage` must be in `stage_enum`; anything else → ask or omit. Confidence < 0.6 on a tier-1 field counts as *missing* for gap-fill. Evidence spans are mandatory — a value without a transcript span is discarded.

**Write path:** read-back confirmed → commit: CRM activity note (structured summary + free_notes), task for next_step with due date, deal stage update (only on high confidence or explicit confirmation), decision-maker flag on contact. Committed entry id(s) stored on the draft. SMS correction within `expire_after_h` → parse free-text to a field patch (strong model), apply, reply with the changed line, mark `patched`. Unparseable correction → one clarifying SMS, then leave a note on the activity instead of guessing.

## 11. Channels

- **Confirmation SMS** (always): compact entry summary + "Antworte, um etwas zu korrigieren."
- **Nudge SMS** (no-answer path): one line, callback invitation, no guilt language.
- **Prep brief SMS** (if enabled): `lead_min` before the next customer meeting — account, open deal + stage, last outcome, open follow-ups, one suggested goal. This is pure give-back; it costs nothing and cements the assistant framing.
- WhatsApp: same channel interface, v1 plugin (Business API brings template approval + opt-in overhead; skip for PoC).

## 12. Agent tools (voice loop)

| Tool | Params | Notes |
|---|---|---|
| `end_call` | `reason: done \| snoozed \| declined \| failed` | closes stream, advances state machine |
| `schedule_callback` | `delay_min` | snooze; validates against workday + caps |

All other capabilities (CRM read = context pack, CRM write = post-confirm commit, SMS = post-call) deliberately live outside the loop.

## 13. Prompts (v0 drafts)

**Interviewer system prompt (conversation model, German):**

```
Du bist der Sales-Assistent von {rep_vorname}. Du rufst nach Kundenterminen an,
hörst zu und hältst das Wichtigste fest. Du bist Assistent, kein Kontrolleur.

Regeln:
- {du_sie}. Kurze Sätze. Eine Frage pro Redebeitrag. Kein Smalltalk, kein Lob-Filler.
- Beginne mit einer offenen Frage zum Termin bei {account}. Danach lass
  {rep_vorname} ausreden. Kurze Bestätigungslaute sind ok.
- Frage danach NUR nach Feldern, die im aktuellen Entwurf fehlen: {missing_fields}.
  Maximal {remaining_questions} weitere Fragen.
- Wenn offene Follow-ups existieren ({open_follow_ups}), frage genau einmal danach.
- Fasse am Ende in EINEM Satz zusammen: Ergebnis, nächster Schritt mit Datum, Stage.
  Frage: "Passt das so?" Korrekturen übernimmst du ohne Diskussion.
- Sagt {rep_vorname} "keine Zeit" o.ä.: biete sofort an, später anzurufen (schedule_callback).
- Erfinde nichts. Du kennst nur: {context_pack}. Bei Unklarheit: nachfragen oder weglassen.
- Sprich niemals über Bewertung, Kontrolle oder Management. Du arbeitest für {rep_vorname}.
```

**Extraction prompt (strong model):** transcript + meeting metadata + schema → JSON only, evidence spans mandatory, explicit date-resolution instruction with meeting date anchor, `stage_enum` closed set, "null over guess".

## 14. Flywheel & logging

Per existing product pattern: snapshot LLM output, capture human corrections, score deltas into config/prompt updates.

- Snapshots: every EntryDraft version, every question the engine chose (with the gap state that produced it), every read-back.
- Deltas: in-call corrections at read-back, SMS patches, fields reps add manually in the CRM within 48 h (poll adapter).
- Derived tuning targets: question phrasings per field (correction rate), tier-2 selection policy, endpointing timings, buffer_min per rep.
- Everything keyed to config version so A/B across volunteers is possible later.

## 15. Privacy & security

- **Never recorded:** the customer meeting. **Never retained:** call audio (streams only, no Twilio recordings). Transcripts: S3, EU, 30-day lifecycle, volunteer-consented, delete-on-request (hard delete incl. drafts).
- **No performance surface:** no per-rep dashboards, no call-time/answer-rate exposure to managers. Aggregate pilot metrics only, k ≥ 3.
- Demo uses synthetic accounts exclusively. Volunteer pilot: written consent (purpose, retention, deletion), reps informed the transcript includes customer names they speak — minimize by instructing the model to omit personal names of non-decision-makers from free_notes.
- Webhook signature validation everywhere; outbound/inbound restricted to verified rep numbers; CRM tokens scoped minimal; no CRM data read out to unverified callers.
- Betriebsrat posture (for the real deployment later, but designed in now): §87 Abs. 1 Nr. 6 BetrVG applies; the technical design above (no audio, no individual metrics, opt-in, skip-anytime) is the substance of the future Betriebsvereinbarung.

## 16. Evals

**Offline (before any volunteer):** 8–10 scripted rep personas as audio (kurz angebunden / Schwätzer / Nuschler / Autobahn + Freisprecher / Dialekt / korrigiert zweimal / verweigert / batch mit 3 Terminen). Golden annotations per persona. Measured: tier-1 accuracy, question count, duration, date resolution, stage mapping, graceful-failure behavior. Run on every prompt/config change (ties into the eval ambitions — this is a clean first professional dataset).

**Live (pilot):** the §2 table + endReason distribution + snooze/skip rates. Weekly transcript review against the interview rules.

## 17. Milestones

- **M1 (call core):** voice loop with hardcoded context pack. Gate: latency budget met, German STT usable with domain vocabulary, barge-in works, car-noise test passed.
- **M2 (entry loop):** extraction, HubSpot commit, confirmation SMS, correction patch. Gate: demo scene works end-to-end from a manual trigger.
- **M3 (trigger loop):** calendar connector, classification, scheduler state machine, prep brief. Gate: full unattended flow; director demo.
- **M4 (pilot):** 3–5 volunteers, 2 weeks, consent + deletion in place. Gate: §2 metrics + rep interviews → go/no-go on continuing.

## 18. Open questions

1. Ströer CRM system + actual required fields (defines tier-1 and stage_enum) — get in rep workshop.
2. Do field visits reliably exist as calendar events? If < ~70 %, add a manual trigger channel (SMS "war gerade bei X") before relying on calendar.
3. du/Sie and tone — rep workshop.
4. Who owns the phone number reps see (trust: saved contact "Sales-Assistent" per volunteer onboarding).
5. Media session runtime: Fargate task vs. long-running Lambda — decide in M1.
6. BracketLab Rahmenvertrag §1(4) / Kundenschutz: confirm the research framing covers a later commercial pilot before M4.
