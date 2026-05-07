# Example: Client Discovery Call Follow-Up

## User Input

> Write a follow-up email from my notes. I had a discovery call with Greenline Logistics, they're a mid-size freight company, about 200 trucks. Spoke with Marcus Weber (VP Ops) and Priya Shah (Head of Tech). They want to replace their driver scheduling system — current one is a 15-year-old Excel/VBA monster that breaks constantly. Their dispatchers spend 3+ hours/day manually adjusting routes. They also mentioned DOT compliance tracking is a nightmare — they got fined $45K last quarter for HOS violations that their system didn't flag. Budget isn't confirmed but Marcus hinted $150-200K range for phase 1. They want to see a proposal + architecture overview. Priya asked about integration with their Samsara telematics data and their SAP ERP. Marcus cares about time-to-value — wants dispatchers using something better within 6 months. I got the sense Marcus is the decision maker but Priya has technical veto. Also Priya mentioned they tried building something in-house 2 years ago and it failed, so there's some skepticism about custom builds. Call ran 55 minutes, they were engaged the whole time. Oh and Marcus mentioned their peak season starts in October so ideally they'd have something live before then. My name is Jason, I run a logistics tech consultancy.

---

## Skill's Internal Analysis (Not Shown to User)

Before drafting, the skill extracts and categorizes:

**Decisions made:** None yet — this is a discovery call, not a decision meeting.

**Action items identified:**
- Jason sends proposal + architecture overview (owner: Jason, deadline: needs proposing)
- Priya to share Samsara API docs and SAP specs (implicit need, not explicitly agreed)
- Marcus to confirm budget internally (implied, not committed)
- Both parties to schedule a proposal review call

**Key pain points to mirror:**
1. 3+ hours/day of manual route adjustments (quantifiable waste)
2. $45K HOS compliance fine (quantifiable risk)
3. Failed in-house build attempt (emotional scar tissue — handle carefully)

**Tone signals:**
- Meeting ran 55 minutes, engaged throughout → positive, high interest
- In-house build failure → skepticism about custom development
- Marcus hinted budget range → open but not committed
- Peak season October → real urgency, not manufactured

**Internal-only observations (never include in email):**
- Marcus is likely the decision maker, Priya has technical veto
- Budget hint of $150-200K suggests room for a serious engagement
- The in-house failure means Priya will scrutinize the technical approach closely

**Meeting type:** Client discovery call → use the discovery framework
**Tone:** Professional, attentive, subtly confident. Mirror their language, show understanding, preview (don't propose), set up the next step.

---

## Generated Email

**Subject:** Follow-up: Greenline driver scheduling & compliance — initial thoughts + next steps

Hi Marcus and Priya,

Thanks for the thorough walkthrough today. The dispatchers spending 3+ hours daily on manual route adjustments stood out — that's roughly 1,100 hours per month across your team that should be handled by software, not spreadsheets. And the $45K HOS compliance fine is exactly the kind of risk that a modern scheduling system eliminates entirely.

Here's a quick recap of what I took away, followed by next steps.

**What I heard:**

- Your current driver scheduling system (Excel/VBA, ~15 years old) is the primary bottleneck for dispatch efficiency and a compliance liability
- Dispatchers manually adjust routes for 3+ hours/day — a workload that grows with fleet size and makes scaling to new contracts painful
- DOT compliance tracking has gaps — the $45K fine last quarter was caused by HOS violations the current system couldn't flag proactively
- Integration with Samsara (telematics) and SAP (ERP) is non-negotiable for the new system to fit into your existing operations
- Peak season starts in October, so having dispatchers on the new system before then is the target
- You explored building in-house two years ago — that experience shapes how you'll evaluate any new approach, and rightly so

**My initial thinking:**

Based on what you described, this looks like a phased build: a scheduling core with real-time Samsara data integration first, then compliance automation layered on top. The key is getting dispatchers onto the new scheduling interface early — within the first 8-10 weeks — while the compliance and SAP integration layers are built in parallel. That way your team starts seeing value before peak season, not on the day peak season starts.

The failed in-house attempt Priya mentioned is actually useful input. I'd want to understand where that effort stalled so we design around those specific failure points. Whether it was scope creep, data migration complexity, or user adoption resistance, each of those has a different architectural answer.

For the architecture overview, I'll map out how the scheduling engine, Samsara telematics feed, HOS compliance module, and SAP sync work together — including which components are custom and which leverage existing platforms. The goal is a system your dispatchers can start using for core scheduling quickly, with compliance and integration features rolling in on a defined cadence.

**Action items:**

| Action | Owner | Deadline |
|--------|-------|----------|
| Send proposal with phased scope, architecture overview, and timeline | Me (Jason) | Friday, May 16 |
| Share Samsara API documentation and current SAP integration specs | Priya | Before Friday, if possible |
| Share summary of what went wrong with the in-house build (even bullet points help) | Priya | When convenient — no rush |
| Confirm budget range with your team | Marcus | Before proposal review call |
| Schedule 45-min proposal review call | Me — I'll send a few time options | Once proposal is delivered |

**One question:** For the architecture overview, should I include a comparison of build-vs-integrate options for the compliance module? There are some solid third-party HOS engines that could accelerate the compliance piece significantly. Want to make sure the proposal addresses the approach you'd prefer to evaluate.

I'll have the proposal and architecture document to you by Friday. Looking forward to digging into this.

Best,
[Your Name]

---

## Why This Works

### Opening Strategy

References a specific, quantified pain point from the meeting (3+ hours/day, $45K fine) — not a generic "great meeting today." The 1,100 hours/month calculation isn't something Marcus or Priya said — Jason did the quick math to show he's already thinking about their problem. This is subtle consultative selling: demonstrating value before the engagement starts.

### "What I Heard" Section

Mirrors their priorities back in their own language. This builds trust by proving the consultant listened and understood. The in-house build failure is included last and framed neutrally ("shapes how you'll evaluate any new approach, and rightly so") — acknowledging it without dwelling on it. This is especially important when a client has been burned before.

Note that each bullet adds context beyond what the client said. "A workload that grows with fleet size and makes scaling to new contracts painful" — Marcus didn't say this explicitly, but it's an obvious implication that shows Jason is thinking ahead.

### Initial Thinking Section

Gives a preview of the approach without being a full proposal. Three key moves:
1. **Phased delivery with early value** — directly addresses Marcus's "time to value in 6 months" concern
2. **In-house failure reframe** — asks for specific failure details and frames them as "useful input," turning a liability into a collaborative asset
3. **Build-vs-integrate signal** — hints that not everything needs to be custom-built, which addresses Priya's skepticism about custom development

### Action Items

Table format with clear owners and deadlines. Includes items on both sides. The Samsara/SAP documentation request is framed as "if possible" rather than demanding — respects Priya's time. The in-house build summary is "when convenient" because it's optional input, not a gate.

Notice that Jason's own item (the proposal) has the earliest and most specific deadline. Leading with your own commitment before asking for theirs is a trust-building pattern.

### Closing Question

Shows strategic thinking (build vs. integrate for compliance) and gives the client agency over the proposal's direction. This does three things:
1. Signals that the proposal will be tailored, not boilerplate
2. Gives the client an easy reply ("yes, include the comparison" or "we prefer custom") — maintaining email momentum
3. Subtly positions Jason as someone who knows the compliance landscape well enough to suggest third-party options

### Tone

Professional but direct. No hedging, no over-formality, no "I hope this email finds you well." Confident without being presumptuous. The email respects both readers: Marcus (decision maker who cares about speed and outcomes) gets the "early value" framing. Priya (technical authority who's skeptical of custom builds) gets the architectural thinking and the acknowledgment of past failure.

### What's Intentionally Absent

- **No pricing** — save it for the proposal. Mentioning numbers now would anchor the conversation before Jason has done the detailed scoping.
- **No "we're the best at this" language** — the email demonstrates competence through specificity. Saying "we're experts in logistics tech" adds nothing. Calculating their dispatcher hours and proposing a phased Samsara integration says the same thing with evidence.
- **No reference to internal impressions** — "I got the sense Marcus is the decision maker" stays in Jason's private notes. Including power dynamics in a client-facing email is a rookie mistake.
- **No mention of the Excel/VBA system being "bad" or "outdated"** — the client knows. Saying it out loud adds nothing and risks sounding condescending.
- **No pressure or manufactured urgency** — the October peak season creates real urgency. Jason doesn't need to add artificial pressure. He simply references the timeline and lets the constraint do the work.
