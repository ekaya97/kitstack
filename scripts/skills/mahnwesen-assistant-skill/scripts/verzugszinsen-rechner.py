#!/usr/bin/env python3
"""
Verzugszinsen-Rechner (Default Interest Calculator)

Calculates Verzugszinsen (default interest) on overdue invoices
per §§286-288 BGB (German Civil Code).

Usage:
    python verzugszinsen-rechner.py --amount 3500 --due-date 2026-03-15 --debtor-type business
    python verzugszinsen-rechner.py --amount 1200 --due-date 2026-01-15 --payment-date 2026-03-01 --debtor-type consumer
    python verzugszinsen-rechner.py --example
    echo '{"amount": 3500, "due_date": "2026-03-15", "debtor_type": "business"}' | python verzugszinsen-rechner.py --stdin
"""

import argparse
import json
import sys
from datetime import date, datetime
from typing import Optional

# =============================================================================
# Basiszinssatz (Base interest rate) — Published by Deutsche Bundesbank
# Updated every January 1 and July 1.
# Check: https://www.bundesbank.de/basiszinssatz
# Last updated: 2026-01-01
# =============================================================================
BASISZINSSATZ_PERIODS = [
    # (start_date, end_date, rate)
    (date(2024, 7, 1), date(2024, 12, 31), 3.37),
    (date(2025, 1, 1), date(2025, 6, 30), 2.27),
    (date(2025, 7, 1), date(2025, 12, 31), 2.27),  # Placeholder — update when published
    (date(2026, 1, 1), date(2026, 6, 30), 2.27),
]

# Surcharges per §288 BGB
SURCHARGE_B2C = 5.0   # §288 Abs. 1 BGB: Basiszinssatz + 5 percentage points
SURCHARGE_B2B = 9.0   # §288 Abs. 2 BGB: Basiszinssatz + 9 percentage points

# Mahnpauschale per §288 Abs. 5 BGB (B2B only)
MAHNPAUSCHALE_B2B = 40.00


def get_basiszinssatz(target_date: date) -> float:
    """Return the Basiszinssatz applicable on a given date."""
    for start, end, rate in BASISZINSSATZ_PERIODS:
        if start <= target_date <= end:
            return rate
    # Fallback: use the most recent known rate
    return BASISZINSSATZ_PERIODS[-1][2]


def get_surcharge(debtor_type: str) -> float:
    """Return the surcharge in percentage points based on debtor type."""
    if debtor_type in ("business", "b2b", "unternehmer"):
        return SURCHARGE_B2B
    elif debtor_type in ("consumer", "b2c", "verbraucher"):
        return SURCHARGE_B2C
    else:
        raise ValueError(
            f"Unknown debtor type: '{debtor_type}'. "
            f"Use 'business' (B2B) or 'consumer' (B2C)."
        )


def is_b2b(debtor_type: str) -> bool:
    """Check if the debtor type is B2B."""
    return debtor_type in ("business", "b2b", "unternehmer")


def calculate_verzugszinsen(
    amount: float,
    due_date: date,
    payment_date: date,
    debtor_type: str,
) -> dict:
    """
    Calculate Verzugszinsen for an overdue invoice.

    Args:
        amount: The outstanding invoice amount in EUR.
        due_date: The original due date of the invoice.
        payment_date: The date of payment or today for ongoing calculation.
        debtor_type: 'business' (B2B) or 'consumer' (B2C).

    Returns:
        Dictionary with calculation details.
    """
    if payment_date <= due_date:
        return {
            "error": "Payment date is on or before the due date. No Verzug.",
            "amount": amount,
            "due_date": due_date.isoformat(),
            "payment_date": payment_date.isoformat(),
            "days_overdue": 0,
            "verzugszinsen": 0.0,
            "mahnpauschale": 0.0,
            "total": amount,
        }

    # Verzug begins the day after the due date
    verzug_start = due_date
    total_days = (payment_date - due_date).days

    surcharge = get_surcharge(debtor_type)

    # Calculate interest, splitting by Basiszinssatz periods
    total_interest = 0.0
    period_details = []
    current_date = verzug_start

    while current_date < payment_date:
        basiszins = get_basiszinssatz(current_date)
        annual_rate = basiszins + surcharge

        # Find the end of the current Basiszinssatz period
        period_end = payment_date
        for start, end, rate in BASISZINSSATZ_PERIODS:
            if start <= current_date <= end:
                # The period ends at the earlier of: period end or payment date
                candidate = min(end, payment_date)
                if candidate < period_end:
                    period_end = candidate
                break

        # If current_date equals period_end, advance by one day to next period
        if current_date == period_end and period_end < payment_date:
            # Move to the next day (start of next Basiszinssatz period)
            next_day = date(
                period_end.year + (1 if period_end.month == 12 and period_end.day == 31 else 0),
                (period_end.month % 12) + 1 if period_end.day == 31 and period_end.month in (6, 12) else period_end.month,
                1 if period_end.day in (30, 31) else period_end.day + 1,
            )
            # Simplified: just move to next period start
            for start, end, rate in BASISZINSSATZ_PERIODS:
                if start > current_date:
                    current_date = start
                    break
            else:
                break
            continue

        days_in_period = (period_end - current_date).days
        if days_in_period <= 0:
            # Safety: advance to next period
            current_date = period_end + __import__('datetime').timedelta(days=1) if period_end < payment_date else payment_date
            continue

        daily_interest = (amount * (annual_rate / 100.0)) / 365.0
        period_interest = daily_interest * days_in_period

        period_details.append({
            "from": current_date.isoformat(),
            "to": period_end.isoformat(),
            "days": days_in_period,
            "basiszinssatz": basiszins,
            "annual_rate": annual_rate,
            "daily_interest": round(daily_interest, 4),
            "period_interest": round(period_interest, 2),
        })

        total_interest += period_interest

        # Move to the day after period_end
        from datetime import timedelta
        current_date = period_end + timedelta(days=1)
        if current_date > payment_date:
            break

    total_interest = round(total_interest, 2)
    mahnpauschale = MAHNPAUSCHALE_B2B if is_b2b(debtor_type) else 0.0
    total = round(amount + total_interest + mahnpauschale, 2)

    return {
        "amount": amount,
        "due_date": due_date.isoformat(),
        "payment_date": payment_date.isoformat(),
        "debtor_type": debtor_type,
        "days_overdue": total_days,
        "periods": period_details,
        "verzugszinsen": total_interest,
        "mahnpauschale": mahnpauschale,
        "total": total,
    }


def format_report(result: dict) -> str:
    """Format calculation result as a markdown report."""
    if "error" in result:
        return f"**Kein Verzug:** {result['error']}"

    lines = []
    lines.append("# Verzugszinsen-Berechnung")
    lines.append("")
    lines.append("## Ausgangsdaten")
    lines.append("")
    lines.append(f"| Feld | Wert |")
    lines.append(f"|------|------|")
    lines.append(f"| Rechnungsbetrag | {result['amount']:,.2f} EUR |")
    lines.append(f"| Faelligkeitsdatum | {result['due_date']} |")
    lines.append(f"| Berechnungsdatum | {result['payment_date']} |")
    lines.append(f"| Schuldnertyp | {result['debtor_type'].upper()} |")
    lines.append(f"| Tage im Verzug | {result['days_overdue']} |")
    lines.append("")

    if result.get("periods"):
        lines.append("## Zinsberechnung")
        lines.append("")
        lines.append("| Zeitraum | Tage | Basiszins | Zinssatz p.a. | Tageszins | Zinsen |")
        lines.append("|----------|------|-----------|---------------|-----------|--------|")
        for p in result["periods"]:
            lines.append(
                f"| {p['from']} - {p['to']} | {p['days']} | "
                f"{p['basiszinssatz']:.2f}% | {p['annual_rate']:.2f}% | "
                f"{p['daily_interest']:.4f} EUR | {p['period_interest']:.2f} EUR |"
            )
        lines.append("")

    lines.append("## Gesamtforderung")
    lines.append("")
    lines.append(f"| Position | Betrag |")
    lines.append(f"|----------|--------|")
    lines.append(f"| Rechnungsbetrag | {result['amount']:,.2f} EUR |")
    lines.append(f"| Verzugszinsen | {result['verzugszinsen']:,.2f} EUR |")
    if result["mahnpauschale"] > 0:
        lines.append(f"| Mahnpauschale (§288 Abs. 5 BGB) | {result['mahnpauschale']:,.2f} EUR |")
    lines.append(f"| **Gesamtforderung** | **{result['total']:,.2f} EUR** |")
    lines.append("")

    lines.append("## Rechtsgrundlagen")
    lines.append("")
    lines.append("- Verzugszinsen: §288 BGB")
    if result["mahnpauschale"] > 0:
        lines.append("- Mahnpauschale: §288 Abs. 5 BGB (nur B2B)")
    lines.append("- Verzugsbeginn: §286 BGB")
    lines.append(f"- Basiszinssatz: {result['periods'][0]['basiszinssatz']:.2f}% (Quelle: Deutsche Bundesbank)")
    lines.append("")

    return "\n".join(lines)


def print_example():
    """Print example usage and output."""
    print("=" * 60)
    print("EXAMPLE: B2B Invoice - Muller GmbH")
    print("=" * 60)
    print()
    print("Command:")
    print("  python verzugszinsen-rechner.py \\")
    print("    --amount 3500 \\")
    print("    --due-date 2026-03-01 \\")
    print("    --payment-date 2026-05-07 \\")
    print("    --debtor-type business")
    print()

    result = calculate_verzugszinsen(
        amount=3500.0,
        due_date=date(2026, 3, 1),
        payment_date=date(2026, 5, 7),
        debtor_type="business",
    )
    print(format_report(result))

    print()
    print("=" * 60)
    print("EXAMPLE: B2C Invoice - Private Client")
    print("=" * 60)
    print()
    print("Command:")
    print("  python verzugszinsen-rechner.py \\")
    print("    --amount 1200 \\")
    print("    --due-date 2026-01-15 \\")
    print("    --payment-date 2026-03-01 \\")
    print("    --debtor-type consumer")
    print()

    result = calculate_verzugszinsen(
        amount=1200.0,
        due_date=date(2026, 1, 15),
        payment_date=date(2026, 3, 1),
        debtor_type="consumer",
    )
    print(format_report(result))


def parse_date(date_str: str) -> date:
    """Parse a date string in YYYY-MM-DD format."""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError(
            f"Invalid date format: '{date_str}'. Use YYYY-MM-DD (e.g., 2026-03-15)."
        )


def main():
    parser = argparse.ArgumentParser(
        description="Verzugszinsen-Rechner: Calculate default interest per §§286-288 BGB",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --amount 3500 --due-date 2026-03-15 --debtor-type business
  %(prog)s --amount 1200 --due-date 2026-01-15 --payment-date 2026-03-01 --debtor-type consumer
  %(prog)s --example
  echo '{"amount": 3500, "due_date": "2026-03-15", "debtor_type": "business"}' | %(prog)s --stdin

Debtor types:
  business / b2b / unternehmer    — Basiszinssatz + 9%% (§288 Abs. 2 BGB)
  consumer / b2c / verbraucher    — Basiszinssatz + 5%% (§288 Abs. 1 BGB)

Current Basiszinssatz: 2.27%% (as of 2026-01-01)
Source: Deutsche Bundesbank — https://www.bundesbank.de/basiszinssatz
        """,
    )

    parser.add_argument(
        "--amount",
        type=float,
        help="Invoice amount in EUR (brutto)",
    )
    parser.add_argument(
        "--due-date",
        type=str,
        help="Original due date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--payment-date",
        type=str,
        default=None,
        help="Payment or calculation date (YYYY-MM-DD). Default: today.",
    )
    parser.add_argument(
        "--debtor-type",
        type=str,
        choices=["business", "b2b", "unternehmer", "consumer", "b2c", "verbraucher"],
        help="Type of debtor: business (B2B) or consumer (B2C)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output as JSON instead of markdown",
    )
    parser.add_argument(
        "--stdin",
        action="store_true",
        help="Read input as JSON from stdin",
    )
    parser.add_argument(
        "--example",
        action="store_true",
        help="Show example calculations",
    )

    args = parser.parse_args()

    if args.example:
        print_example()
        return

    # Read from stdin if --stdin flag is set
    if args.stdin:
        try:
            data = json.load(sys.stdin)
            amount = float(data["amount"])
            due_date = parse_date(data["due_date"])
            payment_date = parse_date(data.get("payment_date", date.today().isoformat()))
            debtor_type = data["debtor_type"]
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Error reading JSON from stdin: {e}", file=sys.stderr)
            print(
                'Expected format: {"amount": 3500, "due_date": "2026-03-15", "debtor_type": "business"}',
                file=sys.stderr,
            )
            sys.exit(1)
    else:
        # Validate required arguments
        if not args.amount or not args.due_date or not args.debtor_type:
            parser.error(
                "The following arguments are required: --amount, --due-date, --debtor-type\n"
                "Or use --stdin for JSON input, or --example for demo output."
            )

        amount = args.amount
        due_date = parse_date(args.due_date)
        payment_date = parse_date(args.payment_date) if args.payment_date else date.today()
        debtor_type = args.debtor_type

    # Calculate
    result = calculate_verzugszinsen(
        amount=amount,
        due_date=due_date,
        payment_date=payment_date,
        debtor_type=debtor_type,
    )

    # Output
    if args.json if hasattr(args, "json") and args.json else False:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(format_report(result))


if __name__ == "__main__":
    main()
