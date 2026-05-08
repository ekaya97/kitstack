"""
Quick Validate — Fast pre-check for common KitStack tool issues.

Reads kit source files and flags problems WITHOUT running tools.
Catches issues like missing .describe(), wrong response format patterns,
and missing error handling before you waste time on full iteration.

Usage:
    python quick-validate.py                    # Scan current directory
    python quick-validate.py /path/to/kit       # Scan specific kit directory
    python quick-validate.py --json             # Output as JSON

Output: Markdown report of issues found by static analysis.
"""

import os
import sys
import re
import json
from pathlib import Path
from typing import Optional


# ── Patterns to Detect ──────────────────────────────────────────────────────

ISSUES = {
    "missing_describe": {
        "pattern": r"z\.(string|number|boolean|enum|array)\(\)",
        "negative": r"\.describe\(",
        "severity": "warning",
        "message": "Zod param without .describe() — LLMs see bare types",
        "fix": "Add .describe('explanation') to every z.string(), z.number(), etc.",
    },
    "kit_text_in_write": {
        "pattern": r"kit\.text\(",
        "context": r"(add_|create_|insert_|update_|delete_|remove_)",
        "severity": "critical",
        "message": "Write tool uses kit.text() instead of kit.result() — breaks chaining",
        "fix": "Use kit.result(kit.created(id, entityType, message)) for writes",
    },
    "no_not_found_check": {
        "pattern": r"(args\.\w+Id|args\.id)",
        "negative": r"(kit\.notFound|not found|!.*\[0\])",
        "severity": "warning",
        "message": "Tool uses an ID param but may not check for not-found",
        "fix": "After querying by ID, check if result is empty and return kit.notFound()",
    },
    "generic_entity_type": {
        "pattern": r'kit\.(created|updated|deleted)\(\s*\w+\s*,\s*"(item|record|entity|data|thing)"',
        "severity": "warning",
        "message": "Generic entity type in kit.created/updated/deleted",
        "fix": 'Use specific types like "contact", "deal", "expense"',
    },
    "empty_description": {
        "pattern": r'description:\s*""',
        "severity": "warning",
        "message": "Tool has an empty description string",
        "fix": "Add a clear description of what the tool does",
    },
    "no_empty_check": {
        "pattern": r"(rows|results|data)\.(map|forEach|join)",
        "negative": r"(length\s*===?\s*0|\.length\s*<|\.length\s*!|isEmpty|no .* found)",
        "severity": "suggestion",
        "message": "Array operation without empty-state check",
        "fix": "Check if array is empty first and return a helpful message",
    },
    "missing_instructions": {
        "pattern": r'instructions:\s*""',
        "severity": "warning",
        "message": "Kit instructions are empty — LLM has no behavioral guidance",
        "fix": "Add instructions with use cases, triggers, and formatting conventions",
    },
}


# ── Scanner ─────────────────────────────────────────────────────────────────


def scan_file(filepath: str) -> list[dict]:
    """Scan a single file for issues."""
    findings = []

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            lines = content.split("\n")
    except (UnicodeDecodeError, FileNotFoundError):
        return findings

    for issue_id, rule in ISSUES.items():
        pattern = re.compile(rule["pattern"])

        for line_num, line in enumerate(lines, 1):
            if pattern.search(line):
                # Check negative pattern (if issue should NOT be flagged when present)
                if "negative" in rule:
                    # Look at surrounding lines (±5) for the negative pattern
                    context_start = max(0, line_num - 6)
                    context_end = min(len(lines), line_num + 5)
                    context_block = "\n".join(lines[context_start:context_end])
                    if re.search(rule["negative"], context_block):
                        continue

                # Check context pattern (issue only applies in certain contexts)
                if "context" in rule:
                    # Look at surrounding lines for context
                    context_start = max(0, line_num - 20)
                    context_end = min(len(lines), line_num + 5)
                    context_block = "\n".join(lines[context_start:context_end])
                    if not re.search(rule["context"], context_block):
                        continue

                findings.append({
                    "file": filepath,
                    "line": line_num,
                    "issue_id": issue_id,
                    "severity": rule["severity"],
                    "message": rule["message"],
                    "fix": rule["fix"],
                    "code": line.strip(),
                })

    return findings


def scan_directory(kit_path: str) -> list[dict]:
    """Scan all TypeScript files in a kit directory."""
    all_findings = []
    path = Path(kit_path)

    # Find all .ts files
    ts_files = list(path.rglob("*.ts"))

    if not ts_files:
        print(f"No .ts files found in {kit_path}", file=sys.stderr)
        return all_findings

    for ts_file in ts_files:
        # Skip node_modules and build output
        parts = ts_file.parts
        if "node_modules" in parts or "dist" in parts or ".kitstack" in parts:
            continue
        findings = scan_file(str(ts_file))
        all_findings.extend(findings)

    return all_findings


# ── Report ──────────────────────────────────────────────────────────────────


def format_report(findings: list[dict], kit_path: str) -> str:
    """Format findings as a markdown report."""
    lines = []
    lines.append("# Quick Validation Report")
    lines.append("")

    critical = [f for f in findings if f["severity"] == "critical"]
    warnings = [f for f in findings if f["severity"] == "warning"]
    suggestions = [f for f in findings if f["severity"] == "suggestion"]

    lines.append(f"**Scanned:** {kit_path}")
    lines.append(
        f"**Found:** {len(findings)} issues "
        f"({len(critical)} critical, {len(warnings)} warning, {len(suggestions)} suggestion)"
    )
    lines.append("")

    if not findings:
        lines.append("No issues found by static analysis. Run the full tool iterator for runtime testing.")
        return "\n".join(lines)

    if critical:
        lines.append("## Critical")
        for f in critical:
            rel_path = os.path.relpath(f["file"], kit_path)
            lines.append(f"- **{rel_path}:{f['line']}** — {f['message']}")
            lines.append(f"  `{f['code']}`")
            lines.append(f"  **Fix:** {f['fix']}")
            lines.append("")

    if warnings:
        lines.append("## Warnings")
        for f in warnings:
            rel_path = os.path.relpath(f["file"], kit_path)
            lines.append(f"- **{rel_path}:{f['line']}** — {f['message']}")
            lines.append(f"  `{f['code']}`")
            lines.append(f"  **Fix:** {f['fix']}")
            lines.append("")

    if suggestions:
        lines.append("## Suggestions")
        for f in suggestions:
            rel_path = os.path.relpath(f["file"], kit_path)
            lines.append(f"- **{rel_path}:{f['line']}** — {f['message']}")
            lines.append(f"  **Fix:** {f['fix']}")
            lines.append("")

    lines.append("---")
    lines.append(
        "*This is a static analysis pre-check. "
        "Run the full tool iterator for runtime verification.*"
    )

    return "\n".join(lines)


# ── Main ────────────────────────────────────────────────────────────────────


def main():
    kit_path = "."
    output_json = False

    for arg in sys.argv[1:]:
        if arg == "--json":
            output_json = True
        elif arg in ("--help", "-h"):
            print(__doc__)
            sys.exit(0)
        else:
            kit_path = arg

    kit_path = os.path.abspath(kit_path)

    # Verify it's a kit directory
    config_path = os.path.join(kit_path, "kit.config.ts")
    if not os.path.exists(config_path):
        print(f"Warning: No kit.config.ts found in {kit_path}", file=sys.stderr)
        print("Scanning anyway...", file=sys.stderr)

    findings = scan_directory(kit_path)

    if output_json:
        print(json.dumps(findings, indent=2))
    else:
        print(format_report(findings, kit_path))

    # Exit with error code if critical issues found
    critical_count = sum(1 for f in findings if f["severity"] == "critical")
    sys.exit(1 if critical_count > 0 else 0)


if __name__ == "__main__":
    main()
