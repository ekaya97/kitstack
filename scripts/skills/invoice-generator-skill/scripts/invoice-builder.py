"""
Invoice Builder — Generates professional HTML invoices from structured data.

Reads the invoice-template.html asset and populates it with invoice data
provided as JSON via stdin or file argument.

Usage:
    echo '{"sender": {...}, "client": {...}, "items": [...]}' | python invoice-builder.py
    python invoice-builder.py invoice-data.json
    python invoice-builder.py --example    # Print example JSON structure

Output: Complete HTML document to stdout, ready for browser rendering or PDF export.
"""

import json
import sys
import os
from datetime import datetime, timedelta
from typing import Optional


# ── Default Values ──────────────────────────────────────────────────────────

DEFAULTS = {
    "currency": "EUR",
    "tax_rate": 19.0,
    "payment_days": 30,
    "lang": "de",
}

CURRENCY_SYMBOLS = {
    "EUR": "€",
    "USD": "$",
    "GBP": "£",
    "CHF": "CHF",
}

# German / English label pairs
LABELS = {
    "de": {
        "invoice_title": "Rechnung",
        "invoice_nr": "Rechnungsnr.",
        "date": "Datum",
        "due": "Fällig",
        "service_date": "Leistungsdatum",
        "bill_to": "Rechnungsempfänger",
        "from": "Rechnungssteller",
        "description": "Beschreibung",
        "qty": "Menge",
        "unit_price": "Einzelpreis",
        "amount": "Betrag",
        "subtotal": "Zwischensumme",
        "tax": "USt.",
        "total": "Gesamtbetrag",
        "payment_details": "Bankverbindung",
        "payment_terms": "Zahlungsbedingungen",
        "thank_you": "Vielen Dank für Ihr Vertrauen.",
    },
    "en": {
        "invoice_title": "Invoice",
        "invoice_nr": "Invoice No.",
        "date": "Date",
        "due": "Due Date",
        "service_date": "Service Date",
        "bill_to": "Bill To",
        "from": "From",
        "description": "Description",
        "qty": "Qty",
        "unit_price": "Unit Price",
        "amount": "Amount",
        "subtotal": "Subtotal",
        "tax": "VAT",
        "total": "Total Due",
        "payment_details": "Payment Details",
        "payment_terms": "Payment Terms",
        "thank_you": "Thank you for your business.",
    },
}


# ── Formatting Helpers ──────────────────────────────────────────────────────


def format_amount(amount: float, currency: str, lang: str = "de") -> str:
    """Format a number as currency with proper locale conventions."""
    symbol = CURRENCY_SYMBOLS.get(currency, currency)
    if lang == "de":
        # German: 1.234,56 €
        formatted = f"{amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        return f"{formatted} {symbol}"
    else:
        # English: €1,234.56 or $1,234.56
        formatted = f"{amount:,.2f}"
        return f"{symbol}{formatted}"


def format_date(date_str: str, lang: str = "de") -> str:
    """Format a date string (YYYY-MM-DD) for display."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        if lang == "de":
            return dt.strftime("%d.%m.%Y")
        else:
            return dt.strftime("%B %d, %Y")
    except (ValueError, TypeError):
        return date_str or ""


def today_str() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def due_date_str(invoice_date: str, days: int) -> str:
    try:
        dt = datetime.strptime(invoice_date, "%Y-%m-%d")
        return (dt + timedelta(days=days)).strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return ""


# ── Template Rendering ──────────────────────────────────────────────────────


def render_line_items(items: list, currency: str, lang: str) -> str:
    """Render the line items table body rows."""
    rows = []
    for item in items:
        desc = item.get("description", "")
        detail = item.get("detail", "")
        qty = item.get("quantity", 1)
        unit_price = item.get("unit_price", 0)
        total = qty * unit_price

        detail_html = f'<div class="item-detail">{detail}</div>' if detail else ""

        rows.append(
            f"        <tr>\n"
            f'          <td><div class="item-description">{desc}</div>{detail_html}</td>\n'
            f'          <td class="align-right">{qty}</td>\n'
            f'          <td class="align-right">{format_amount(unit_price, currency, lang)}</td>\n'
            f'          <td class="align-right">{format_amount(total, currency, lang)}</td>\n'
            f"        </tr>"
        )

    return "\n".join(rows)


def render_tax_rows(subtotal: float, tax_entries: list, currency: str, lang: str, labels: dict) -> str:
    """Render one or more tax rows."""
    rows = []
    for entry in tax_entries:
        rate = entry.get("rate", 0)
        amount = entry.get("amount", subtotal * rate / 100)
        rate_display = f"{rate:.0f}%" if rate == int(rate) else f"{rate:.1f}%"
        rows.append(
            f'        <tr class="tax-row">\n'
            f"          <td>{labels['tax']} {rate_display}</td>\n"
            f"          <td>{format_amount(amount, currency, lang)}</td>\n"
            f"        </tr>"
        )
    return "\n".join(rows)


def build_bank_details(bank: dict, lang: str) -> str:
    """Format bank details for display."""
    lines = []
    if bank.get("account_holder"):
        label = "Kontoinhaber" if lang == "de" else "Account Holder"
        lines.append(f'<span class="highlight">{bank["account_holder"]}</span>')
    if bank.get("iban"):
        lines.append(f"IBAN: {bank['iban']}")
    if bank.get("bic"):
        lines.append(f"BIC: {bank['bic']}")
    if bank.get("bank_name"):
        lines.append(bank["bank_name"])
    if bank.get("account_number"):
        label = "Account" if lang == "en" else "Konto"
        lines.append(f"{label}: {bank['account_number']}")
    if bank.get("routing_number"):
        lines.append(f"Routing: {bank['routing_number']}")
    return "<br>".join(lines) if lines else "—"


def build_invoice_html(data: dict) -> str:
    """Build the complete invoice HTML from structured data."""

    # ── Resolve defaults ────────────────────────────────────
    lang = data.get("lang", DEFAULTS["lang"])
    currency = data.get("currency", DEFAULTS["currency"])
    labels = LABELS.get(lang, LABELS["en"])
    tax_rate = data.get("tax_rate", DEFAULTS["tax_rate"])
    invoice_date = data.get("invoice_date", today_str())
    payment_days = data.get("payment_days", DEFAULTS["payment_days"])
    due = data.get("due_date", due_date_str(invoice_date, payment_days))
    service_date = data.get("service_date", invoice_date)

    # ── Sender / Client ─────────────────────────────────────
    sender = data.get("sender", {})
    client = data.get("client", {})

    sender_name = sender.get("name", "[Your Name]")
    sender_addr1 = sender.get("address_line1", "[Your Address]")
    sender_addr2 = sender.get("address_line2", "")
    sender_contact = sender.get("contact", "")

    client_name = client.get("name", "[Client Name]")
    client_addr1 = client.get("address_line1", "[Client Address]")
    client_addr2 = client.get("address_line2", "")

    # ── Line items & calculations ───────────────────────────
    items = data.get("items", [])
    subtotal = sum(item.get("quantity", 1) * item.get("unit_price", 0) for item in items)

    # Handle tax — single rate or multiple
    kleinunternehmer = data.get("kleinunternehmer", False)
    if kleinunternehmer:
        tax_entries = [{"rate": 0, "amount": 0}]
        total = subtotal
    elif data.get("tax_entries"):
        tax_entries = data["tax_entries"]
        total = subtotal + sum(e.get("amount", subtotal * e.get("rate", 0) / 100) for e in tax_entries)
    else:
        tax_amount = subtotal * tax_rate / 100
        tax_entries = [{"rate": tax_rate, "amount": tax_amount}]
        total = subtotal + tax_amount

    # ── Payment / Legal ─────────────────────────────────────
    bank = data.get("bank", {})
    payment_terms = data.get("payment_terms", "")
    if not payment_terms:
        if lang == "de":
            payment_terms = f"Zahlbar innerhalb von {payment_days} Tagen nach Rechnungserhalt."
        else:
            payment_terms = f"Payment due within {payment_days} days of invoice date."

    tax_id = sender.get("tax_id", "")
    vat_id = sender.get("vat_id", "")
    tax_id_line_parts = []
    if tax_id:
        label = "Steuernummer" if lang == "de" else "Tax ID"
        tax_id_line_parts.append(f"{label}: {tax_id}")
    if vat_id:
        tax_id_line_parts.append(f"USt-IdNr.: {vat_id}" if lang == "de" else f"VAT ID: {vat_id}")
    tax_id_line = " · ".join(tax_id_line_parts)

    legal_notice = data.get("legal_notice", "")
    if not legal_notice and kleinunternehmer:
        legal_notice = "Gemäß §19 UStG wird keine Umsatzsteuer berechnet." if lang == "de" else "VAT exempt under §19 UStG (small business regulation)."

    notes = data.get("notes", "")
    notes_section = ""
    if notes:
        notes_section = (
            f'<div style="margin-bottom: 32px; padding: 16px; '
            f'background: var(--ks-paper); border-radius: 8px; '
            f'font-size: 12px; color: var(--ks-ink2);">'
            f"<strong>{'Hinweis' if lang == 'de' else 'Notes'}:</strong> {notes}</div>"
        )

    # ── Read template ───────────────────────────────────────
    template_path = os.path.join(os.path.dirname(__file__), "..", "assets", "invoice-template.html")

    try:
        with open(template_path, "r", encoding="utf-8") as f:
            html = f.read()
    except FileNotFoundError:
        print(f"Error: Template not found at {template_path}", file=sys.stderr)
        print("Ensure assets/invoice-template.html exists relative to this script.", file=sys.stderr)
        sys.exit(1)

    # ── Replace placeholders ────────────────────────────────
    replacements = {
        "{{LANG}}": lang,
        "{{INVOICE_TITLE}}": labels["invoice_title"],
        "{{INVOICE_NUMBER}}": data.get("invoice_number", "INV-001"),
        "{{SENDER_NAME}}": sender_name,
        "{{SENDER_ADDRESS_LINE1}}": sender_addr1,
        "{{SENDER_ADDRESS_LINE2}}": sender_addr2,
        "{{SENDER_CONTACT}}": sender_contact,
        "{{CLIENT_NAME}}": client_name,
        "{{CLIENT_ADDRESS_LINE1}}": client_addr1,
        "{{CLIENT_ADDRESS_LINE2}}": client_addr2,
        "{{INVOICE_DATE}}": format_date(invoice_date, lang),
        "{{DUE_DATE}}": format_date(due, lang),
        "{{SERVICE_DATE}}": format_date(service_date, lang),
        "{{LINE_ITEMS}}": render_line_items(items, currency, lang),
        "{{SUBTOTAL}}": format_amount(subtotal, currency, lang),
        "{{TAX_ROWS}}": render_tax_rows(subtotal, tax_entries, currency, lang, labels),
        "{{TOTAL}}": format_amount(total, currency, lang),
        "{{BANK_DETAILS}}": build_bank_details(bank, lang),
        "{{PAYMENT_TERMS}}": payment_terms,
        "{{NOTES_SECTION}}": notes_section,
        "{{LEGAL_NOTICE}}": legal_notice,
        "{{TAX_ID_LINE}}": tax_id_line,
        "{{THANK_YOU}}": data.get("thank_you", labels["thank_you"]),
        "{{LABEL_INVOICE_NR}}": labels["invoice_nr"],
        "{{LABEL_DATE}}": labels["date"],
        "{{LABEL_DUE}}": labels["due"],
        "{{LABEL_SERVICE_DATE}}": labels["service_date"],
        "{{LABEL_BILL_TO}}": labels["bill_to"],
        "{{LABEL_FROM}}": labels["from"],
        "{{LABEL_DESCRIPTION}}": labels["description"],
        "{{LABEL_QTY}}": labels["qty"],
        "{{LABEL_UNIT_PRICE}}": labels["unit_price"],
        "{{LABEL_AMOUNT}}": labels["amount"],
        "{{LABEL_SUBTOTAL}}": labels["subtotal"],
        "{{LABEL_TOTAL}}": labels["total"],
        "{{LABEL_PAYMENT_DETAILS}}": labels["payment_details"],
        "{{LABEL_PAYMENT_TERMS}}": labels["payment_terms"],
    }

    for placeholder, value in replacements.items():
        html = html.replace(placeholder, str(value))

    return html


# ── Example Data ────────────────────────────────────────────────────────────

EXAMPLE_DATA = {
    "lang": "de",
    "currency": "EUR",
    "invoice_number": "RE-2026-042",
    "invoice_date": "2026-05-07",
    "service_date": "2026-04-30",
    "payment_days": 14,
    "tax_rate": 19,
    "sender": {
        "name": "Anna Schmidt Design",
        "address_line1": "Torstraße 123",
        "address_line2": "10119 Berlin",
        "contact": "anna@schmidtdesign.de · +49 30 12345678",
        "tax_id": "27/456/12345",
        "vat_id": "DE123456789",
    },
    "client": {
        "name": "Müller & Partner GmbH",
        "address_line1": "Kaiserstraße 42",
        "address_line2": "60329 Frankfurt am Main",
    },
    "items": [
        {
            "description": "UX Design — App Redesign",
            "detail": "User research, wireframes, prototypes (April 2026)",
            "quantity": 40,
            "unit_price": 110.00,
        },
        {
            "description": "Design System Dokumentation",
            "detail": "Component library, style guide, usage guidelines",
            "quantity": 1,
            "unit_price": 1500.00,
        },
        {
            "description": "Stakeholder Workshop",
            "detail": "Ganztägiger Workshop inkl. Vorbereitung",
            "quantity": 1,
            "unit_price": 950.00,
        },
    ],
    "bank": {
        "account_holder": "Anna Schmidt",
        "iban": "DE89 3704 0044 0532 0130 00",
        "bic": "COBADEFFXXX",
        "bank_name": "Commerzbank",
    },
    "notes": "Projektref: APP-2026-Q2 · Vielen Dank für die gute Zusammenarbeit!",
}


# ── Main ────────────────────────────────────────────────────────────────────


def print_example():
    """Print the example JSON data structure."""
    print(json.dumps(EXAMPLE_DATA, indent=2, ensure_ascii=False))


def main():
    if len(sys.argv) > 1:
        if sys.argv[1] == "--example":
            print_example()
            return
        if sys.argv[1] == "--help" or sys.argv[1] == "-h":
            print(__doc__)
            return

        # Read from file
        filepath = sys.argv[1]
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except FileNotFoundError:
            print(f"Error: File not found: {filepath}", file=sys.stderr)
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        # Read from stdin
        try:
            raw = sys.stdin.read()
            if not raw.strip():
                print(__doc__)
                print("\nUse --example to see the expected JSON structure.")
                sys.exit(0)
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON from stdin: {e}", file=sys.stderr)
            sys.exit(1)

    html = build_invoice_html(data)
    print(html)


if __name__ == "__main__":
    main()
