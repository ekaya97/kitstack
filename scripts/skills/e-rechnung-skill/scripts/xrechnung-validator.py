"""
XRechnung Validator — Validates XML invoices against XRechnung rules.

Checks for mandatory fields, format compliance, calculation consistency,
and common errors that cause rejection by German public authorities.

Usage:
    python xrechnung-validator.py invoice.xml
    cat invoice.xml | python xrechnung-validator.py -
    python xrechnung-validator.py --help

Output: Structured compliance report with PASS / WARN / FAIL per check.
"""

import sys
import re
import xml.etree.ElementTree as ET
from typing import Optional


# ── Namespaces ──────────────────────────────────────────────────────────────

NS = {
    "ubl": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
}


# ── Validation Checks ──────────────────────────────────────────────────────


class ValidationResult:
    def __init__(self):
        self.checks = []

    def add(self, status: str, code: str, message: str, detail: str = ""):
        self.checks.append({
            "status": status,  # PASS, WARN, FAIL
            "code": code,
            "message": message,
            "detail": detail,
        })

    @property
    def passed(self):
        return sum(1 for c in self.checks if c["status"] == "PASS")

    @property
    def warnings(self):
        return sum(1 for c in self.checks if c["status"] == "WARN")

    @property
    def failed(self):
        return sum(1 for c in self.checks if c["status"] == "FAIL")

    @property
    def overall(self):
        if self.failed > 0:
            return "FAIL"
        if self.warnings > 0:
            return "WARN"
        return "PASS"

    def report(self) -> str:
        lines = []
        lines.append("# XRechnung Validation Report")
        lines.append("")
        lines.append(f"**Overall: {self.overall}** — {self.passed} passed, {self.warnings} warnings, {self.failed} failed")
        lines.append("")

        if self.failed > 0:
            lines.append("## Failures")
            for c in self.checks:
                if c["status"] == "FAIL":
                    lines.append(f"- **FAIL [{c['code']}]** {c['message']}")
                    if c["detail"]:
                        lines.append(f"  {c['detail']}")
            lines.append("")

        if self.warnings > 0:
            lines.append("## Warnings")
            for c in self.checks:
                if c["status"] == "WARN":
                    lines.append(f"- **WARN [{c['code']}]** {c['message']}")
                    if c["detail"]:
                        lines.append(f"  {c['detail']}")
            lines.append("")

        lines.append("## All Checks")
        for c in self.checks:
            icon = {"PASS": "✅", "WARN": "⚠️", "FAIL": "❌"}[c["status"]]
            lines.append(f"- {icon} [{c['code']}] {c['message']}")

        return "\n".join(lines)


def find_text(root, xpath: str) -> Optional[str]:
    """Find text content at an XPath, handling namespaces."""
    el = root.find(xpath, NS)
    return el.text if el is not None else None


def find_all(root, xpath: str):
    return root.findall(xpath, NS)


def validate_xrechnung(xml_content: str) -> ValidationResult:
    """Run all validation checks on an XRechnung XML string."""

    result = ValidationResult()

    # ── Parse XML ───────────────────────────────────────────
    try:
        # Register namespaces to avoid ns0/ns1 prefixes
        for prefix, uri in NS.items():
            ET.register_namespace(prefix, uri)
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        result.add("FAIL", "XML-01", "XML is not well-formed", str(e))
        return result

    result.add("PASS", "XML-01", "XML is well-formed")

    # ── BT-24: Customization ID ─────────────────────────────
    customization = find_text(root, "cbc:CustomizationID")
    if customization and "xrechnung" in customization.lower():
        result.add("PASS", "BT-24", "XRechnung customization ID present")
    elif customization:
        result.add("WARN", "BT-24", "Customization ID present but may not be XRechnung",
                    f"Found: {customization}")
    else:
        result.add("FAIL", "BT-24", "Missing CustomizationID (XRechnung specification identifier)")

    # ── BT-1: Invoice number ────────────────────────────────
    invoice_id = find_text(root, "cbc:ID")
    if invoice_id and invoice_id.strip():
        result.add("PASS", "BT-1", f"Invoice number present: {invoice_id}")
    else:
        result.add("FAIL", "BT-1", "Missing invoice number (cbc:ID)")

    # ── BT-2: Issue date ────────────────────────────────────
    issue_date = find_text(root, "cbc:IssueDate")
    if issue_date:
        try:
            from datetime import datetime
            datetime.strptime(issue_date, "%Y-%m-%d")
            result.add("PASS", "BT-2", f"Invoice date valid: {issue_date}")
        except ValueError:
            result.add("FAIL", "BT-2", f"Invoice date format invalid: {issue_date}",
                        "Expected format: YYYY-MM-DD")
    else:
        result.add("FAIL", "BT-2", "Missing invoice issue date (cbc:IssueDate)")

    # ── BT-3: Invoice type code ─────────────────────────────
    type_code = find_text(root, "cbc:InvoiceTypeCode")
    valid_types = {"380": "Commercial invoice", "381": "Credit note", "384": "Corrected invoice"}
    if type_code in valid_types:
        result.add("PASS", "BT-3", f"Invoice type: {valid_types[type_code]} ({type_code})")
    elif type_code:
        result.add("WARN", "BT-3", f"Unusual invoice type code: {type_code}")
    else:
        result.add("FAIL", "BT-3", "Missing invoice type code (cbc:InvoiceTypeCode)")

    # ── BT-5: Currency ──────────────────────────────────────
    currency = find_text(root, "cbc:DocumentCurrencyCode")
    if currency and len(currency) == 3:
        result.add("PASS", "BT-5", f"Currency: {currency}")
    else:
        result.add("FAIL", "BT-5", "Missing or invalid currency code")

    # ── BT-10: Buyer reference ──────────────────────────────
    buyer_ref = find_text(root, "cbc:BuyerReference")
    if buyer_ref and buyer_ref.strip():
        # Check for Leitweg-ID pattern
        leitweg_pattern = r"^\d{4}:\d+-\d+-\d{2}$"
        if re.match(leitweg_pattern, buyer_ref):
            result.add("PASS", "BT-10", f"Buyer reference (Leitweg-ID): {buyer_ref}")
        else:
            result.add("PASS", "BT-10", f"Buyer reference present: {buyer_ref}",
                        "Note: Does not match Leitweg-ID format — OK for B2B, may be PO number")
    else:
        result.add("FAIL", "BT-10", "Missing buyer reference (cbc:BuyerReference)",
                    "For B2G: This must be the Leitweg-ID. For B2B: Purchase order or contract number.")

    # ── BG-4: Seller ────────────────────────────────────────
    seller_name = find_text(root,
        "cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName")
    if seller_name:
        result.add("PASS", "BT-27", f"Seller name: {seller_name}")
    else:
        result.add("FAIL", "BT-27", "Missing seller name")

    # Seller VAT / Tax ID
    seller_tax_schemes = find_all(root,
        "cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID")
    if seller_tax_schemes:
        for el in seller_tax_schemes:
            result.add("PASS", "BT-31/32", f"Seller tax identifier: {el.text}")
    else:
        result.add("FAIL", "BT-31/32", "Missing seller tax identifier (Steuernummer or USt-IdNr)")

    # Seller address
    seller_city = find_text(root,
        "cac:AccountingSupplierParty/cac:Party/cac:PostalAddress/cbc:CityName")
    if seller_city:
        result.add("PASS", "BG-5", f"Seller address present (city: {seller_city})")
    else:
        result.add("WARN", "BG-5", "Seller postal address incomplete")

    # ── BG-7: Buyer ─────────────────────────────────────────
    buyer_name = find_text(root,
        "cac:AccountingCustomerParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName")
    if buyer_name:
        result.add("PASS", "BT-44", f"Buyer name: {buyer_name}")
    else:
        result.add("FAIL", "BT-44", "Missing buyer name")

    # ── BG-16: Payment means ────────────────────────────────
    pay_code = find_text(root, "cac:PaymentMeans/cbc:PaymentMeansCode")
    if pay_code:
        result.add("PASS", "BT-81", f"Payment means code: {pay_code}")
    else:
        result.add("FAIL", "BT-81", "Missing payment means code")

    iban = find_text(root, "cac:PaymentMeans/cac:PayeeFinancialAccount/cbc:ID")
    if iban:
        result.add("PASS", "BT-84", f"Payment account (IBAN): {iban}")
    else:
        result.add("WARN", "BT-84", "No payment account (IBAN) specified")

    # ── Tax totals (BG-23) ──────────────────────────────────
    tax_amount_el = root.find("cac:TaxTotal/cbc:TaxAmount", NS)
    if tax_amount_el is not None:
        result.add("PASS", "BT-110", f"Tax total: {tax_amount_el.text} {tax_amount_el.get('currencyID', '')}")
    else:
        result.add("FAIL", "BT-110", "Missing tax total amount")

    # ── Monetary totals (BG-22) ─────────────────────────────
    payable = find_text(root, "cac:LegalMonetaryTotal/cbc:PayableAmount")
    tax_exclusive = find_text(root, "cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount")
    tax_inclusive = find_text(root, "cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount")

    if payable:
        result.add("PASS", "BT-115", f"Payable amount: {payable}")
    else:
        result.add("FAIL", "BT-115", "Missing payable amount")

    # ── Calculation consistency ─────────────────────────────
    if tax_exclusive and tax_amount_el is not None and tax_inclusive:
        try:
            net = float(tax_exclusive)
            tax = float(tax_amount_el.text)
            gross = float(tax_inclusive)
            expected = round(net + tax, 2)
            if abs(expected - gross) < 0.02:
                result.add("PASS", "CALC-01", "Tax calculation consistent (net + tax = gross)")
            else:
                result.add("FAIL", "CALC-01",
                    f"Tax calculation mismatch: {net} + {tax} = {net + tax}, but gross is {gross}")
        except (ValueError, TypeError):
            result.add("WARN", "CALC-01", "Could not verify tax calculation (non-numeric values)")

    # ── Invoice lines ───────────────────────────────────────
    lines = find_all(root, "cac:InvoiceLine")
    if lines:
        result.add("PASS", "BG-25", f"Invoice has {len(lines)} line item(s)")
        for i, line in enumerate(lines, 1):
            line_id = line.find("cbc:ID", NS)
            line_amount = line.find("cbc:LineExtensionAmount", NS)
            line_desc = line.find("cac:Item/cbc:Description", NS)
            if line_amount is None:
                result.add("FAIL", f"LINE-{i}", f"Line {i}: Missing line extension amount")
            if line_desc is None:
                result.add("WARN", f"LINE-{i}", f"Line {i}: Missing item description")
    else:
        result.add("FAIL", "BG-25", "No invoice lines found")

    return result


# ── Main ────────────────────────────────────────────────────────────────────


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("--help", "-h"):
        print(__doc__)
        sys.exit(0)

    if sys.argv[1] == "-":
        xml_content = sys.stdin.read()
    else:
        filepath = sys.argv[1]
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                xml_content = f.read()
        except FileNotFoundError:
            print(f"Error: File not found: {filepath}", file=sys.stderr)
            sys.exit(1)

    result = validate_xrechnung(xml_content)
    print(result.report())
    sys.exit(0 if result.overall != "FAIL" else 1)


if __name__ == "__main__":
    main()
