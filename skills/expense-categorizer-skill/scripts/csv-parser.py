"""
Bank CSV Parser for German Bank Exports

Parses CSV exports from common German banks into a standardized expense format.
Supported banks: Sparkasse, N26, ING, Commerzbank, DKB

Usage:
    python csv-parser.py <input_file.csv> [--bank <bank_name>] [--output <output_file.csv>]

If --bank is not specified, the script attempts to auto-detect the bank format.

Output format:
    Date, Description, Amount, Currency, Original_Category (if available)
"""

import csv
import sys
import os
from datetime import datetime
from typing import Optional


# ── Bank Format Definitions ──────────────────────────────────────────────────

BANK_FORMATS = {
    "sparkasse": {
        "encoding": "iso-8859-1",
        "delimiter": ";",
        "skip_header_lines": 0,
        "date_column": "Buchungstag",
        "date_format": "%d.%m.%y",
        "description_columns": ["Buchungstext", "Verwendungszweck"],
        "amount_column": "Betrag",
        "decimal_separator": ",",
        "currency_column": "Waehrung",
        "detection_hints": ["Buchungstag", "Wertstellung", "Buchungstext", "Verwendungszweck"],
    },
    "n26": {
        "encoding": "utf-8",
        "delimiter": ",",
        "skip_header_lines": 0,
        "date_column": "Date",
        "date_format": "%Y-%m-%d",
        "description_columns": ["Payee", "Payment reference"],
        "amount_column": "Amount (EUR)",
        "decimal_separator": ".",
        "currency_column": None,  # Always EUR
        "category_column": "Category",
        "detection_hints": ["Date", "Payee", "Account number", "Amount (EUR)"],
    },
    "ing": {
        "encoding": "iso-8859-1",
        "delimiter": ";",
        "skip_header_lines": 0,
        "date_column": "Buchung",
        "date_format": "%d.%m.%Y",
        "description_columns": ["Auftraggeber/Empfaenger", "Verwendungszweck"],
        "amount_column": "Betrag",
        "decimal_separator": ",",
        "currency_column": "Waehrung",
        "detection_hints": ["Buchung", "Valuta", "Auftraggeber/Empfaenger", "Buchungstext"],
    },
    "commerzbank": {
        "encoding": "iso-8859-1",
        "delimiter": ";",
        "skip_header_lines": 0,
        "date_column": "Buchungstag",
        "date_format": "%d.%m.%Y",
        "description_columns": ["Buchungstext", "Umsatzart"],
        "amount_column": "Betrag",
        "decimal_separator": ",",
        "currency_column": "Waehrung",
        "detection_hints": ["Buchungstag", "Wertstellung", "Umsatzart", "Buchungstext"],
    },
    "dkb": {
        "encoding": "iso-8859-1",
        "delimiter": ";",
        "skip_header_lines": 6,  # DKB has 6 header lines with account info
        "date_column": "Buchungsdatum",
        "date_format": "%d.%m.%Y",
        "description_columns": ["Beschreibung"],
        "amount_column": "Betrag (EUR)",
        "decimal_separator": ",",
        "currency_column": None,  # Always EUR
        "category_column": "Kontoart",
        "detection_hints": ["Buchungsdatum", "Wertstellung", "Beschreibung", "Betrag (EUR)"],
    },
}


# ── Parsing Functions ────────────────────────────────────────────────────────


def detect_bank(filepath: str) -> Optional[str]:
    """Auto-detect the bank format by reading the first few lines."""
    for encoding in ["utf-8", "iso-8859-1"]:
        try:
            with open(filepath, "r", encoding=encoding) as f:
                # Read first 10 lines to check for detection hints
                header_lines = []
                for i, line in enumerate(f):
                    if i >= 10:
                        break
                    header_lines.append(line)

                content = "\n".join(header_lines)

                for bank_name, fmt in BANK_FORMATS.items():
                    hints = fmt["detection_hints"]
                    matches = sum(1 for hint in hints if hint in content)
                    if matches >= 3:  # At least 3 column names must match
                        return bank_name
        except (UnicodeDecodeError, FileNotFoundError):
            continue

    return None


def parse_amount(amount_str: str, decimal_separator: str = ",") -> float:
    """Parse a German-formatted amount string to float."""
    if not amount_str or amount_str.strip() == "":
        return 0.0

    # Remove whitespace
    amount_str = amount_str.strip()

    # Remove currency symbols
    amount_str = amount_str.replace("EUR", "").replace("€", "").strip()

    # Remove thousand separators and normalize decimal separator
    if decimal_separator == ",":
        amount_str = amount_str.replace(".", "")  # Remove thousand separators
        amount_str = amount_str.replace(",", ".")  # Normalize decimal
    else:
        amount_str = amount_str.replace(",", "")  # Remove thousand separators

    # Remove any remaining whitespace
    amount_str = amount_str.strip()

    try:
        return float(amount_str)
    except ValueError:
        print(f"Warning: Could not parse amount '{amount_str}', using 0.00")
        return 0.0


def parse_date(date_str: str, date_format: str) -> str:
    """Parse a date string and return ISO format (YYYY-MM-DD)."""
    if not date_str or date_str.strip() == "":
        return ""

    date_str = date_str.strip()

    try:
        parsed = datetime.strptime(date_str, date_format)
        return parsed.strftime("%Y-%m-%d")
    except ValueError:
        # Try common alternative formats
        for alt_format in ["%d.%m.%Y", "%d.%m.%y", "%Y-%m-%d", "%d/%m/%Y"]:
            try:
                parsed = datetime.strptime(date_str, alt_format)
                return parsed.strftime("%Y-%m-%d")
            except ValueError:
                continue
        print(f"Warning: Could not parse date '{date_str}', keeping original")
        return date_str


def parse_csv(filepath: str, bank_name: str) -> list[dict]:
    """Parse a bank CSV file and return standardized expense records."""
    fmt = BANK_FORMATS[bank_name]
    records = []

    try:
        with open(filepath, "r", encoding=fmt["encoding"]) as f:
            # Skip header lines (e.g., DKB has account info at the top)
            for _ in range(fmt["skip_header_lines"]):
                next(f)

            reader = csv.DictReader(f, delimiter=fmt["delimiter"])

            for row in reader:
                # Skip empty rows
                if not any(row.values()):
                    continue

                # Extract date
                date_col = fmt["date_column"]
                date_str = row.get(date_col, "")
                parsed_date = parse_date(date_str, fmt["date_format"])

                # Skip rows without a valid date (footer rows, summaries)
                if not parsed_date:
                    continue

                # Extract description (combine multiple columns)
                description_parts = []
                for col in fmt["description_columns"]:
                    value = row.get(col, "")
                    if value and value.strip():
                        description_parts.append(value.strip())
                description = " | ".join(description_parts)

                # Extract amount
                amount_col = fmt["amount_column"]
                amount_str = row.get(amount_col, "0")
                amount = parse_amount(amount_str, fmt["decimal_separator"])

                # Extract currency
                currency = "EUR"
                if fmt.get("currency_column"):
                    currency = row.get(fmt["currency_column"], "EUR").strip()

                # Extract category (if available)
                category = ""
                if fmt.get("category_column"):
                    category = row.get(fmt["category_column"], "").strip()

                records.append(
                    {
                        "date": parsed_date,
                        "description": description,
                        "amount": amount,
                        "currency": currency,
                        "original_category": category,
                        "bank": bank_name,
                    }
                )

    except FileNotFoundError:
        print(f"Error: File not found: {filepath}")
        sys.exit(1)
    except UnicodeDecodeError:
        print(
            f"Error: Could not read file with {fmt['encoding']} encoding. "
            f"Try specifying a different bank format."
        )
        sys.exit(1)
    except Exception as e:
        print(f"Error parsing CSV: {e}")
        sys.exit(1)

    return records


def filter_expenses(records: list[dict]) -> list[dict]:
    """Filter to only include expenses (negative amounts = outgoing money)."""
    expenses = []
    for record in records:
        # Most banks: negative = expense, positive = income
        # We want expenses, so we take negative amounts and make them positive
        if record["amount"] < 0:
            record["amount"] = abs(record["amount"])
            expenses.append(record)
    return expenses


def format_output(records: list[dict]) -> str:
    """Format records as a clean table for Claude to process."""
    if not records:
        return "No expense records found in the file."

    output_lines = []
    output_lines.append("# Parsed Bank Expenses")
    output_lines.append("")
    output_lines.append(f"**Bank:** {records[0]['bank'].upper()}")
    output_lines.append(f"**Records:** {len(records)} expenses")

    # Date range
    dates = [r["date"] for r in records if r["date"]]
    if dates:
        output_lines.append(f"**Period:** {min(dates)} to {max(dates)}")

    output_lines.append("")
    output_lines.append(
        "| # | Date | Description | Amount | Currency | Category |"
    )
    output_lines.append(
        "|---|------|-------------|--------|----------|----------|"
    )

    for i, record in enumerate(records, 1):
        desc = record["description"][:80]  # Truncate long descriptions
        amount = f"{record['amount']:.2f}"
        cat = record.get("original_category", "")
        output_lines.append(
            f"| {i} | {record['date']} | {desc} | {amount} | "
            f"{record['currency']} | {cat} |"
        )

    # Summary
    total = sum(r["amount"] for r in records)
    output_lines.append("")
    output_lines.append(f"**Total expenses:** {total:.2f} EUR")

    return "\n".join(output_lines)


def write_csv_output(records: list[dict], output_path: str):
    """Write standardized records to a CSV file."""
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "date",
                "description",
                "amount",
                "currency",
                "original_category",
            ],
        )
        writer.writeheader()
        for record in records:
            writer.writerow(
                {
                    "date": record["date"],
                    "description": record["description"],
                    "amount": f"{record['amount']:.2f}",
                    "currency": record["currency"],
                    "original_category": record.get("original_category", ""),
                }
            )
    print(f"Output written to: {output_path}")


# ── Main ─────────────────────────────────────────────────────────────────────


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("\nSupported banks: " + ", ".join(BANK_FORMATS.keys()))
        sys.exit(1)

    filepath = sys.argv[1]

    # Parse optional arguments
    bank_name = None
    output_path = None

    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == "--bank" and i + 1 < len(sys.argv):
            bank_name = sys.argv[i + 1].lower()
            i += 2
        elif sys.argv[i] == "--output" and i + 1 < len(sys.argv):
            output_path = sys.argv[i + 1]
            i += 2
        else:
            print(f"Unknown argument: {sys.argv[i]}")
            sys.exit(1)

    # Auto-detect bank if not specified
    if not bank_name:
        print("Auto-detecting bank format...")
        bank_name = detect_bank(filepath)
        if bank_name:
            print(f"Detected: {bank_name.upper()}")
        else:
            print(
                "Could not auto-detect bank format. "
                "Please specify with --bank <name>"
            )
            print("Supported banks: " + ", ".join(BANK_FORMATS.keys()))
            sys.exit(1)

    if bank_name not in BANK_FORMATS:
        print(f"Unknown bank: {bank_name}")
        print("Supported banks: " + ", ".join(BANK_FORMATS.keys()))
        sys.exit(1)

    # Parse CSV
    print(f"Parsing {filepath} as {bank_name.upper()} export...")
    records = parse_csv(filepath, bank_name)
    print(f"Found {len(records)} transactions.")

    # Filter to expenses only
    expenses = filter_expenses(records)
    print(f"Filtered to {len(expenses)} expenses (outgoing transactions).")

    if not expenses:
        print("No expenses found. The file may contain only income transactions.")
        print("Check that the amount column contains negative values for expenses.")
        sys.exit(0)

    # Output
    if output_path:
        write_csv_output(expenses, output_path)
    else:
        # Print formatted table to stdout (for Claude to process)
        print("\n" + format_output(expenses))


if __name__ == "__main__":
    main()
