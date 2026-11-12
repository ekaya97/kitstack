# KitStack sales voice agent demo runbook

Status: rehearsal artifact for T-0194. As of 2026-09-17, production OAuth,
router discovery, all three View shells/loaders, the voice-service rollout,
and read-only health checks are verified. The controlled demo acceptance path
is the local OpenAI Realtime voice runtime; Twilio remains an optional
provider-seam rehearsal. Start local voice from the prepared session ID shown
by `prepare_debrief`.

## Preconditions

- Deploy the router and demo voice service from the same recorded commit.
- Configure the existing `mcp.kitstack.co` Claude connector; do not create a
  second connector for the demo.
- Set the demo service to `internal-signed` MCP mode in the deployed stage.
- Configure OpenAI Realtime credentials for the local voice path. Twilio,
  `DemoAllowedDestination`, and `KITSTACK_DEMO_VOICE_DOMAIN` are only required
  for the optional provider-seam rehearsal. `DemoAdminToken` and the operator
  timezone remain required for the controlled demo host.
- Configure the shared `DemoInternalSecret` in `.env.production`; sync it with
  `./infra/sync-secrets.sh production` before deploying. The MCP router and
  voice service must use the same value.
- Confirm recording is disabled, provider retention is disabled, and the
  destination allowlist contains only the presenter's test number.
- Reset demo data once before rehearsal. Preserve app registrations and tokens.

## Presenter sequence

1. In the existing Claude window, send:

   `Use kit - call the debrief kit - I am meeting a client in 2 minutes - call me back at 22:05; client is Acme Corp, contact Mr John Doe, location Köln Café.`

   If the presenter is not actually within the next 24 hours, use the exact
   same request with a callback time in the next 20–30 minutes. The runtime
   resolves a time-only value in the supplied operator timezone and rejects a
   time that is ambiguous, past, or more than 24 hours away.

2. Claude calls `prepare_debrief` with `callback_at`,
   `callback_timezone`, and `buffer_minutes: 5`. The response must contain the
   customer-aware prebrief, masked destination, `session_id`, and a
   `kit_view("debrief", "prebrief")` hint.

3. Claude calls `kit_view("debrief", "prebrief")`. Present the View while the
   scheduler waits. It must show Acme Corp, Mr John Doe, Köln Café, the prior
   interaction state, objective, scheduled time/countdown, and provider
   privacy status. It must not show a phone number, transcript, or audio.

4. Use the waiting window to explain the KitStack plumbing: the debrief kit is
   routed through the existing MCP connector; persistence, instructions,
   memory, AI/proxy, HTTP, trigger, channel, and scheduler are plugins; and
   the same customer/session/trace identifiers feed the dashboards.

5. At `scheduled_call_at` the scheduler path is visible in the dashboard. For
   the accepted local voice rehearsal, open the local voice page, paste the
   prepared `session_id`, and start the OpenAI Realtime `defineAgent` path. No
   dashboard start click is part of the workflow. Twilio phone completion is
   optional seam evidence.

6. During the call, state the outcome and provide a second customer address.
   After provider completion, the service persists only metadata plus an
   editable draft; it does not persist transcript or audio.

7. In the original Claude thread, send:

   `Give me the debrief for confirmation.`

   Claude calls `get_debrief_for_confirmation` and then
   `kit_view("debrief", "confirmation")`. Edit the outcome/next step and
   discovered address in the View; confirm. The response must show stable
   confirmation/address event IDs.

8. Claude calls `kit_view("debrief", "customer-timeline")`. The newest-first
   timeline must show `prebrief`, `call_completed`, `address_discovered`, and
   `debrief_confirmed` for Acme Corp. A different customer must not see those
   events.

9. Open `/demo` and show the Runtime/Registry evidence (kit/plugin registry,
   scheduler/call state, provider health) and Usage/Observability/FinOps
   evidence (proxy/AI usage, latency, estimated cost, memory/instruction
   references, and the prebrief → scheduled call → confirmation trace).

10. Reset and repeat the flow with the same customer. The prebrief must now
    retrieve the approved memory and previous confirmed interaction. Reset
    once more before the live presentation.

### Teaching variant

If the demo includes the learning loop, use `confirm_debrief` with
`outcome: "partial"` before `teach_from_correction`. Then approve and publish
the candidate memory, complete the editable confirmation, and run the second
prepare. Teaching after a fully confirmed session is intentionally rejected by
the state machine.

## Failure handling

- If the scheduler job is `starting` beyond its lease, stop and investigate;
  never manually retry a live call without confirming the provider did not
  receive the first request.
- If local OpenAI Realtime is unavailable, run the deterministic simulator
  path and show the same Views, persistence, and dashboard metadata; label it
  clearly as simulator evidence.
- If the MCP router or View shell regresses, roll back to the recorded router
  and voice-service commits, then verify existing kits through
  `mcp.kitstack.co` before attempting another release.

## Evidence to capture

- router and voice-service commit SHAs;
- `tools/list`, prebrief, confirmation, and timeline View screenshots;
- scheduler/call status and dashboard screenshots filtered to the Acme session;
- two-run memory retrieval result;
- existing-connector smoke result and any provider failure details.
