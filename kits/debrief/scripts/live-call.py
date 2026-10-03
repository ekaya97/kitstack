#!/usr/bin/env python3
"""Run the full debrief cycle with real phone calls against a local server.

Usage (from the repo root, with `ngrok http 127.0.0.1:3011` already running):
    python3 kits/debrief/scripts/live-call.py https://<id>.ngrok-free.dev

Reads credentials from .env.production and starts the debrief server on :3011
(LIVE_CALL_PORT) with a fresh local file database for this run. Each round:
prepare -> real call -> review the draft -> optional correction (taught,
approved and published as memory) -> confirm. A further round calls again so
you can check the agent uses what it learned. Stops the server at the end.
"""
import json, os, subprocess, sys, time, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
KIT = ROOT / "kits" / "debrief"
PORT = int(os.environ.get("LIVE_CALL_PORT", "3011"))
BASE = f"http://127.0.0.1:{PORT}"
RUN_ID = datetime.now().strftime("%Y%m%d-%H%M%S")
DRAFT_FIELDS = ("outcome", "next_step", "customer_update", "discovered_address", "follow_up_date")
CUSTOMER = {
    "goal": "Debrief the Fressnapf store meeting and agree next steps",
    "company": "Fressnapf Filiale Köln-Ehrenfeld",
    "contact_name": "Anna Becker",
    "location": "Köln",
}

if len(sys.argv) != 2 or not sys.argv[1].startswith("https://"):
    sys.exit("usage: live-call.py https://<public-tunnel-host>")
public = sys.argv[1].rstrip("/")

env_file = {}
for line in (ROOT / ".env.production").read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        key, value = line.split("=", 1)
        env_file[key.strip()] = value.strip().strip('"').strip("'")

env = {k: v for k, v in os.environ.items() if not k.startswith(("TURSO", "KITSTACK_DEMO_DB"))}
env.update({
    "PORT": str(PORT),
    # A fresh file per run: data survives the server, and prepared sessions
    # from earlier runs can never be dialled by this run's scheduler.
    "KITSTACK_DEMO_DB_URL": "file:" + str(KIT / ".kitstack" / f"live-call-{RUN_ID}.db"),
    "TWILIO_ACCOUNT_SID": env_file["TwilioAccountSid"],
    "TWILIO_AUTH_TOKEN": env_file["TwilioAuthToken"],
    "TWILIO_FROM_NUMBER": env_file["TwilioFromNumber"],
    "OPENAI_API_KEY": env_file["OpenAiApiKey"],
    "OPENAI_REALTIME_MODEL": env_file.get("OPENAI_REALTIME_MODEL", "gpt-realtime"),
    "OPENAI_REALTIME_VOICE": env_file.get("OPENAI_REALTIME_VOICE", "marin"),
    "KITSTACK_DEMO_ALLOWED_DESTINATION": env_file["DemoAllowedDestination"],
    "KITSTACK_DEMO_ADMIN_TOKEN": env_file["DemoAdminToken"],
    "KITSTACK_DEMO_PUBLIC_HTTPS_URL": public,
    "KITSTACK_DEMO_PUBLIC_WSS_URL": public.replace("https://", "wss://", 1) + "/t/voice/media",
})
# HubSpot (private app token) when configured; otherwise an in-memory demo CRM.
if env_file.get("HUBSPOT_ACCESS_TOKEN"):
    env["HUBSPOT_ACCESS_TOKEN"] = env_file["HUBSPOT_ACCESS_TOKEN"]
else:
    env.setdefault("KITSTACK_DEMO_CRM", "memory")


def post(path, body, headers=None):
    request = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), method="POST",
                                     headers={"content-type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read() or b"null")
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read() or b"null")


def mcp(name, arguments):
    """Call a debrief tool through the KitStack `kit` tool (View data via `__load_view`)."""
    call = ({"id": "debrief", "cmd": "__load_view", "params": {"view": arguments["view"]}}
            if name == "kit_view" else {"id": "debrief", "cmd": name, "params": arguments})
    status, body = post("/mcp", {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                                 "params": {"name": "kit", "arguments": call}})
    result = (body or {}).get("result") or {}
    if status != 200 or (body or {}).get("error") or "content" not in result or result.get("isError"):
        raise RuntimeError(f"{name} failed: {status} {body}")
    return json.loads(result["content"][0]["text"])


def show_fields(title, fields):
    print(f"\n{title}")
    if not fields:
        print("  (empty)")
    for key, value in fields.items():
        print(f"  {key:<20} {value}")


def ask(prompt):
    try:
        return input(prompt).strip()
    except EOFError:
        return ""


def wait_for_server():
    for _ in range(60):
        try:
            urllib.request.urlopen(BASE + "/healthz", timeout=2)
            return
        except Exception:
            if server.poll() is not None:
                sys.exit(f"server exited; see {log.name}")
            time.sleep(1)
    sys.exit(f"server did not become healthy; see {log.name}")


def check_tunnel():
    # Twilio hangs up immediately if it cannot reach the media stream, so
    # prove the tunnel reaches this server before placing a real call.
    try:
        probe = urllib.request.Request(public + "/healthz", headers={"ngrok-skip-browser-warning": "1"})
        with urllib.request.urlopen(probe, timeout=10) as response:
            if json.loads(response.read()).get("status") != "ok":
                raise RuntimeError("unexpected health response")
    except Exception as error:
        sys.exit(f"tunnel {public} does not reach this server ({error}); check the URL shown by ngrok")


def run_round(number):
    print(f"\n=== Round {number} ===")
    # Callback well in the future so the scheduler does not dial on its own.
    callback = (datetime.now(timezone.utc) + timedelta(hours=6)).strftime("%Y-%m-%dT%H:%M:%SZ")
    session = mcp("prepare_debrief", {**CUSTOMER, "callback_at": callback, "callback_timezone": "Europe/Berlin"})
    session_id = session["sessionId"]
    print(f"prepared session {session_id}; approved memories in the briefing: {len(session.get('memoryIds') or [])}")
    print(f"last interaction in the briefing: {(session.get('prebrief_sections') or {}).get('last_interaction', 'n/a')}")
    for line in session.get("crm_context") or ["CRM: no matching account (or no CRM configured)"]:
        print(f"  {line}")

    ask("Press Enter to place the call (answer your phone)... ")
    status, started = post("/t/voice/live/start",
                           {"session_id": session_id, "to": env["KITSTACK_DEMO_ALLOWED_DESTINATION"], "confirmation": True},
                           {"x-demo-admin-token": env["KITSTACK_DEMO_ADMIN_TOKEN"]})
    if status != 202:
        sys.exit(f"call did not start: {status} {started}")
    print(f"calling... (call {started['callId']})")

    state = "calling"
    for _ in range(150):  # up to 12.5 minutes
        time.sleep(5)
        current = mcp("get_session", {"session_id": session_id})
        state = current["state"]
        if state != "calling":
            break
    print(f"call ended; session is {state}" + (f" (note: {current.get('error')})" if current.get("error") else ""))
    if state != "awaiting_confirmation":
        print(f"nothing to confirm; see {log.name}")
        return False

    review = mcp("get_debrief_for_confirmation", {"session_id": session_id})
    fields = {k: v for k, v in review["draft"]["fields"].items() if k in DRAFT_FIELDS}
    show_fields("Draft saved by the agent:", fields)
    completion = review["draft"]["fields"].get("completion_reason")
    if completion:
        print(f"  (call ended by: {completion})")

    correction = ask("\nCorrection to teach the agent for next time (Enter to skip): ")
    if correction:
        memory = mcp("teach_from_correction", {"session_id": session_id, "correction": correction})
        mcp("approve_memory", {"session_id": session_id, "memory_id": memory["memoryId"]})
        mcp("publish_memory", {"session_id": session_id, "memory_id": memory["memoryId"]})
        print(f"taught, approved and published memory {memory['memoryId']}")

    if not fields and ask("The draft is empty. Confirm it anyway? [y/N] ").lower() != "y":
        print("left unconfirmed")
        return True
    confirmed = mcp("confirm_debrief_draft", {"session_id": session_id})
    print(f"debrief confirmed (state {confirmed['state']}, event {confirmed.get('confirmed_event_id')})")
    crm = confirmed.get("crm") or {}
    if crm.get("status") == "synced":
        print(f"CRM ({crm['provider']}): call {crm['callId']} logged" + (f", task {crm['taskId']} created" if crm.get("taskId") else "") + f" on company {crm.get('companyId')}")
    else:
        print(f"CRM: {crm.get('status')} - {crm.get('message') or crm.get('reason')}")
    return True


log = open(KIT / ".kitstack" / "live-call.log", "w")
server = subprocess.Popen(["npx", "tsx", "src/transports/server.ts"], cwd=KIT, env=env, stdout=log, stderr=log)
try:
    wait_for_server()
    check_tunnel()
    print(f"server up and tunnel reachable; database {env['KITSTACK_DEMO_DB_URL']}")
    number = 1
    while run_round(number):
        if ask("\nCall again to check the agent uses what it learned? [y/N] ").lower() != "y":
            break
        number += 1
    timeline = mcp("kit_view", {"id": "debrief", "view": "customer-timeline"})
    print("\nCustomer timeline:")
    print(json.dumps(timeline, indent=2, ensure_ascii=False)[:4000])
finally:
    server.terminate()
    server.wait(timeout=10)
    print(f"\nserver stopped; log at {log.name}")
