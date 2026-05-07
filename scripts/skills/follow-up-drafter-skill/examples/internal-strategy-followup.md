# Example: Internal Strategy Meeting Follow-Up

## User Input

> Here are my notes from our strategy meeting today. Can you turn this into a follow-up email to the team?
>
> attendees: me, Sarah (product), Dave (eng), Nina (marketing), Carlos (sales)
>
> - talked about whether to launch the self-serve tier or keep sales-led only
> - Carlos says deals under $5K aren't worth the sales cycle, maybe self-serve those
> - Dave thinks we can build a basic self-serve flow in 6 weeks but not with the enterprise features
> - Nina needs to know the positioning — is self-serve a "starter" or a "free trial that converts"
> - we decided: yes, build self-serve, but only for the basic plan ($49/mo and $99/mo tiers)
> - enterprise stays sales-led, no changes there
> - pricing: Sarah thinks $49/mo is too low — suggested $79/mo as floor. no final decision on pricing but we'll test both
> - Dave will scope the eng work and give estimate by friday
> - nina will draft positioning options by next wednesday
> - carlos will pull data on how many deals last year were under $5K
> - I need to get CFO buy-in before we greenlight the eng work
> - Sarah raised concern about support load — who handles self-serve customer support? didn't resolve this
> - also talked about the conference in September — nina wants a booth but budget isn't approved. parked that.
> - next meeting: Thursday May 15, same time

---

## Skill's Internal Analysis (Not Shown to User)

**Parsing the notes:**

The notes are raw bullet points with mixed content: decisions, action items, unresolved questions, and a tangential topic (conference booth). The skill needs to separate these cleanly.

**Decisions extracted:**
1. Build self-serve tier — confirmed
2. Scope limited to basic plan ($49/mo, $99/mo) — confirmed
3. Enterprise remains sales-led — confirmed (no change)
4. Pricing not finalized — explicitly undecided, will test two options

**Action items extracted:**
- Dave: scope engineering work, deliver estimate by Friday
- Nina: draft positioning options by Wednesday, May 14
- Carlos: pull sub-$5K deal data (no deadline stated — needs one)
- User (sender): get CFO buy-in before eng work starts

**Unresolved / parking lot:**
- Self-serve support model (Sarah's concern — not resolved)
- September conference booth (Nina's request — budget not approved)

**Meeting type:** Internal strategy/planning → efficient, no fluff, decisions first

**Tone:** Direct, task-oriented, no pleasantries. The audience was in the meeting — they need alignment and accountability, not a recap of what they already heard.

---

## Generated Email

**Subject:** Self-serve tier — decisions, action items, open questions [May 7 meeting]

Team,

Quick recap from today's strategy session. We covered a lot of ground — here's what was decided, what's still open, and who owns what.

**Decisions:**

1. **We're building a self-serve tier.** Scope: basic plan only ($49/mo and $99/mo tiers). Enterprise remains sales-led — no changes.
2. **Self-serve will not include enterprise features.** The self-serve flow covers signup, payment, and onboarding for the basic plan. Enterprise-grade features (SSO, custom integrations, dedicated support) stay behind the sales process.
3. **Pricing is not finalized.** Sarah flagged that $49/mo may be too low. We'll test $49 and $79 as floor options once the product is closer to launch. No final call today.
4. **Target build timeline: 6 weeks** (pending Dave's detailed scope).

**Action items:**

| Action | Owner | Deadline |
|--------|-------|----------|
| Scope the self-serve engineering work and deliver estimate | Dave | Friday, May 9 |
| Draft 2-3 positioning options (starter plan vs. trial-to-convert vs. hybrid) | Nina | Wednesday, May 14 |
| Pull data on deals under $5K from last 12 months (volume, conversion rate, avg cycle time) | Carlos | Wednesday, May 14 |
| Get CFO buy-in on self-serve investment before eng work begins | Me | Before next meeting (May 15) |

**Open questions (parking lot):**

- **Self-serve support model:** Who handles support for self-serve customers? Options discussed but not resolved: (a) existing support team absorbs it, (b) self-serve gets docs/community only with no human support, (c) dedicated tier-1 support hire. Sarah — could you sketch out the support load estimate based on similar products? Would help us decide at the next meeting.
- **September conference booth:** Nina wants a booth. Budget isn't approved. We'll revisit once the self-serve budget picture is clearer.

**Next meeting:** Thursday, May 15, same time. Agenda: review Dave's eng estimate, discuss Nina's positioning options, Carlos's deal data, and my CFO readout.

Come prepared with your items and we'll make the final go/no-go call on the build.

Thanks,
[Your Name]

---

## Why This Works

### Subject Line Design

"Self-serve tier — decisions, action items, open questions [May 7 meeting]" tells the reader three things before opening: the topic, what the email contains, and when the meeting was. Anyone searching their inbox in three weeks can find this instantly. Compare to "Strategy meeting notes" — which matches every meeting in the company's history.

The date is in brackets at the end because it's reference metadata, not the headline.

### No Opening Fluff

The email starts with "Team," and immediately signals what's coming: "here's what was decided, what's still open, and who owns what." Internal emails don't need "Thanks for a great meeting today" or "I appreciate everyone's time." The team was there. They want the recap, not the compliments.

The single line of context ("Quick recap from today's strategy session") is for anyone who might be forwarded the email later. It takes 4 seconds to read and orients a cold reader.

### Decisions Section

Uses numbered, definitive statements. "We decided..." and "We're building..." — not "We discussed possibly building..." or "The consensus seemed to be..."

Clarity here prevents the meeting-after-the-meeting problem, where two people walk away with different understandings of what was agreed. If the email says "We're building a self-serve tier for the basic plan," that's the record.

**Critical move: the pricing non-decision is explicit.** Rather than glossing over an unresolved item, decision #3 clearly states "Pricing is not finalized" with the plan to test. This prevents Sarah from claiming "$49 was approved" and Carlos from claiming "$79 was approved." Ambiguity in internal emails breeds conflict later.

Decision #2 (no enterprise features in self-serve) wasn't stated as a separate decision in the notes — it's implied by Dave's comment. The skill surfaces implicit decisions and makes them explicit because implied agreements are the ones that get disputed.

### Action Items Table

Every item has a named owner (not a team) and a specific deadline. Note what the skill did with deadlines:

- **Dave:** Deadline was stated in the notes ("by Friday") → used as-is with the specific date
- **Nina:** Deadline was stated ("by next Wednesday") → converted to a specific date
- **Carlos:** No deadline was stated in the notes → skill assigned one that aligns with the other items (Wednesday, May 14), so all inputs arrive before the Thursday meeting
- **Sender:** The deadline is conditional ("before eng work begins") → framed as "Before next meeting" because that's when the go/no-go decision happens

The table format works here because there are exactly 4 items across 4 different owners. Fewer than 3 items could be inline; more than 6 would need grouping by team.

### Parking Lot Section

Two kinds of unresolved items, handled differently:

1. **Support model** — genuinely needs to be decided before launch. The email doesn't just say "we'll discuss later." It lists the three options that were raised, assigns prep work to Sarah (estimate the support load), and sets a target to resolve it at the next meeting. This turns a vague parking lot item into a structured decision point.

2. **Conference booth** — lower priority, budget-dependent. Gets a single sentence and a condition for when it gets revisited. This acknowledges Nina's request without cluttering the action items.

### Next Meeting Agenda

The agenda does double duty. It tells the team what to prepare, and it creates accountability: everyone shows up Thursday with their deliverables because the agenda was set five days in advance. "Come prepared with your items" is a polite but clear reminder that showing up without the assigned work isn't acceptable.

### Tone Calibration

Efficient and direct throughout. No social lubrication. No emoji. No "great discussion today" or "I'm excited about this direction." The email respects people's time by being scannable in 45 seconds.

Internal emails are not the place for warmth signaling. Warmth in internal comms comes from clarity, fairness (everyone gets clear assignments), and follow-through — not from exclamation marks.

### What's Intentionally Absent

- **No discussion summary.** The team was there. They don't need a replay of Carlos's argument about sub-$5K deals or Sarah's concern about pricing. The email captures the outputs (decisions and actions), not the inputs (debate and reasoning).
- **No attribution of who argued for what.** "Carlos says deals under $5K aren't worth the sales cycle" is useful in the meeting. In the email, the decision is collective: "We decided to build self-serve." Attributing arguments in writing creates political dynamics ("Carlos pushed for this, so if it fails...").
- **No editorializing.** No "Great energy in the room today" or "This is an exciting direction." The team will decide how they feel about the decisions. The follow-up email's job is to be the authoritative record, not the cheerleader.
- **No lengthy context-setting.** The subject line does that work. Anyone who needs the full context was in the meeting.
- **No CC list management.** The email goes to the five attendees. It doesn't CC the CFO (that's a separate conversation the sender is handling), the support team (premature), or the wider company (nothing to announce yet).
