# Action Item Rules

Criteria for determining what qualifies as an actionable item versus discussion, information, or a wish.

---

## The Action Item Test

For a statement to qualify as an action item, it must pass ALL of the following:

### 1. Specificity Test
**Question:** Can someone read this and know exactly what to do?

**PASS:**
- "Draft the Q3 marketing budget spreadsheet" — clear task
- "Schedule a call with the Acme Bakery team for next week" — specific action
- "Review the contract and flag red flags by Thursday" — defined task with criteria

**FAIL:**
- "Think about marketing" — too vague
- "We need to improve our process" — no specific action
- "Look into some options" — what options? for what?

### 2. Owner Test
**Question:** Is there a specific person responsible for this?

**PASS:**
- "Sarah will draft the proposal" — explicit owner
- "[Speaker] I'll handle the client follow-up" — first-person commitment
- "The design team will update the mockups" — team-level owner (acceptable)

**FAIL:**
- "Someone should look into this" — no owner
- "We should probably do X" — collective vagueness
- "It would be good if..." — wish, not commitment

**Note:** When an owner can be INFERRED but isn't explicitly stated, assign the inferred owner with a "[Confirm owner]" flag. See inference rules in SKILL.md, Step 3.

### 3. Commitment Test
**Question:** Did someone actually commit to doing this, or was it just discussed?

**PASS:**
- "I'll send the report by Friday" — explicit commitment
- "Let's schedule that for next week" — implicit commitment (someone said "let's")
- "Can you handle the client presentation?" "Yes, I've got it." — confirmed commitment

**FAIL:**
- "We should consider updating the website" — consideration, not commitment
- "It might be worth exploring new vendors" — exploration is not a task
- "Has anyone thought about X?" — question, not commitment

### 4. Completability Test
**Question:** Can this be marked as "done" at some point?

**PASS:**
- "Send the invoice to Acme Corp" — done when sent
- "Hire a junior designer" — done when hired
- "Write the first draft of the blog post" — done when draft exists

**FAIL:**
- "Be more strategic about partnerships" — never "done"
- "Improve client communication" — ongoing, not completable
- "Stay aligned on the vision" — not a task

---

## Classification Decision Tree

```
Is it a specific task that someone can do?
├── NO → Is it a decision that was made?
│   ├── YES → DECISION
│   └── NO → Is it a question that wasn't answered?
│       ├── YES → OPEN QUESTION
│       └── NO → Is it relevant to future work?
│           ├── YES → PARKING LOT
│           └── NO → DISCUSSION POINT (include in summary only)
└── YES → Did someone commit to it (explicitly or implicitly)?
    ├── YES → ACTION ITEM
    └── NO → Is it important enough to track?
        ├── YES → ACTION ITEM with "[Confirm: was this committed to?]"
        └── NO → DISCUSSION POINT
```

---

## Common Patterns and Their Classifications

### Definitely Action Items
- "I'll [verb] the [thing] by [time]"
- "[Name] will [verb]"
- "Can you [verb]? — Yes"
- "Let's [verb] by [time]"
- "The next step is to [verb]"
- "ACTION: [task]" (sometimes notes explicitly label actions)
- "TODO: [task]"

### Probably Action Items (capture with confirmation flag)
- "We need to [verb]" — Capture as action, flag "[Confirm owner and commitment]"
- "[Name] mentioned they could [verb]" — Capture, flag "[Confirm: was this a commitment?]"
- "Let's try to [verb] this week" — Capture with soft deadline
- "I think we should [verb]" — Capture if specific enough, flag "[Confirm]"

### NOT Action Items
- "We discussed [topic]" — Discussion
- "The market is shifting toward [trend]" — Information
- "It would be nice to have [feature]" — Wish (parking lot)
- "[Name] shared an update on [project]" — Information
- "Everyone agreed that [statement]" — Decision
- "We're happy with the progress on [project]" — Status update (information)
- "The budget was approved" — Decision, not action (unless someone needs to do something with the budget)

---

## Edge Cases

### The Vague Commitment
**Raw:** "Yeah, I'll look into it."
**Handling:** Capture as action item BUT make it specific. "Look into it" becomes "[Name]: Research [the topic that was being discussed] and report back" — with flag "[Vague commitment — confirm scope and deadline]"

### The Conditional Action
**Raw:** "If the client approves the budget, we'll start the design phase."
**Handling:** Capture as action with condition: "[Name]: Begin design phase (contingent on client budget approval)" — and capture "Confirm client budget approval" as a separate action or open question.

### The Delegation Request
**Raw:** "Can someone on the team handle this?"
**Handling:** Capture as action with owner "[TO BE ASSIGNED]" and add to open questions: "Who will own [task]?"

### The Repeated Item
**Raw:** Same task mentioned multiple times in the meeting.
**Handling:** Capture once. If the task evolved during the meeting (scope changed, owner changed), capture the final version.

### The Already-Done Item
**Raw:** "Oh, I already sent that email yesterday."
**Handling:** Do NOT capture as an action item. If relevant, note in the summary: "[Name] confirmed that [task] is complete."

### The Recurring Task
**Raw:** "We should do this every week."
**Handling:** Capture the first instance as an action item: "[Name]: [Task] — this week." Add to parking lot: "Recurring: [Task] — discussed making this weekly."

---

## Priority Assignment Rules

### High Priority
- Explicitly called "urgent," "ASAP," "top priority," or "critical"
- Blocking other people's work (someone can't proceed until this is done)
- Client-facing deadline
- Risk of negative consequence if delayed (contract expiry, compliance deadline)
- Due within 48 hours

### Medium Priority
- Important but not blocking
- Has a reasonable deadline (1-2 weeks)
- Internal impact (affects team but not external relationships)
- Part of an ongoing project with established cadence

### Low Priority
- Nice-to-have
- No stated urgency
- Exploratory or research tasks
- No deadline mentioned or inferable
- Can be deferred without consequence

### When Priority Conflicts
If the speaker said "this is important" but the task itself seems routine, trust the speaker's assessment and mark it as they described it. Add a note if needed: "[Marked high priority per [Name]'s request]"
