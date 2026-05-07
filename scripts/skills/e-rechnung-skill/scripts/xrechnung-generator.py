"""
XRechnung Generator — Generates XRechnung-compliant UBL 2.1 XML invoices.

Produces XML conforming to XRechnung 3.0 (based on EN 16931) in UBL 2.1 format.
All mandatory Business Term (BT) fields are included.

Usage:
    echo '{"seller": {...}, "buyer": {...}, "items": [...]}' | python xrechnung-generator.py
    python xrechnung-generator.py invoice-data.json
    python xrechnung-generator.py --example    # Print example JSON input

Output: XRechnung-compliant UBL 2.1 XML to stdout.
"""

import json
import sys
import os
from datetime import datetime
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom.minidom import parseString


# ── Namespaces ──────────────────────────────────────────────────────────────

NS = {
    "ubl": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
}


# ── XML Builder Helpers ─────────────────────────────────────────────────────


def cbc(parent, tag, text, **attribs):
    """Add a cbc: element."""
    el = SubElement(parent, f"{{{NS['cbc']}}}{tag}")
    el.text = str(text)
    for k, v in attribs.items():
        el.set(k, v)
    return el


def cac(parent, tag):
    """Add a cac: element."""
    return SubElement(parent, f"{{{NS['cac']}}}{tag}")


def amount_str(value):
    """Format a number to 2 decimal places for XML."""
    return f"{value:.2f}"


# ── Invoice XML Generation ──────────────────────────────────────────────────


def build_xrechnung(data):
    """Build a complete XRechnung UBL 2.1 XML document."""

    currency = data.get("currency", "EUR")
    invoice_date = data.get("invoice_date", datetime.now().strftime("%Y-%m-%d"))
    due_date = data.get("due_date", "")
    service_start = data.get("service_period_start", invoice_date)
    service_end = data.get("service_period_end", invoice_date)

    seller = data.get("seller", {})
    buyer = data.get("buyer", {})
    items = data.get("items", [])
    payment = data.get("payment", {})

    # ── Root element ────────────────────────────────────────
    root = Element(f"{{{NS['ubl']}}}Invoice")
    root.set("xmlns:cac", NS["cac"])
    root.set("xmlns:cbc", NS["cbc"])

    # BT-24: Specification identifier
    cbc(root, "CustomizationID",
        "urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0")

    # BT-23: Business process
    cbc(root, "ProfileID", "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0")

    # BT-1: Invoice number
    cbc(root, "ID", data.get("invoice_number", "RE-001"))

    # BT-2: Invoice issue date
    cbc(root, "IssueDate", invoice_date)

    # BT-9: Due date
    if due_date:
        cbc(root, "DueDate", due_date)

    # BT-3: Invoice type code (380 = commercial invoice)
    cbc(root, "InvoiceTypeCode", data.get("invoice_type_code", "380"))

    # BT-22: Notes
    if data.get("note"):
        cbc(root, "Note", data["note"])

    # BT-5: Currency
    cbc(root, "DocumentCurrencyCode", currency)

    # BT-10: Buyer reference (mandatory for XRechnung)
    cbc(root, "BuyerReference", data.get("buyer_reference", ""))

    # ── Invoice period (BT-73, BT-74) ──────────────────────
    period = cac(root, "InvoicePeriod")
    cbc(period, "StartDate", service_start)
    cbc(period, "EndDate", service_end)

    # ── Seller (BG-4) ──────────────────────────────────────
    supplier_party = cac(root, "AccountingSupplierParty")
    party = cac(supplier_party, "Party")

    # BT-34: Seller electronic address
    if seller.get("endpoint_id"):
        endpoint = cbc(party, "EndpointID", seller["endpoint_id"])
        endpoint.set("schemeID", seller.get("endpoint_scheme", "EM"))

    # Seller name (BT-27) and address (BG-5)
    postal = cac(party, "PostalAddress")
    cbc(postal, "StreetName", seller.get("street", ""))
    cbc(postal, "CityName", seller.get("city", ""))
    cbc(postal, "PostalZone", seller.get("postal_code", ""))
    country = cac(postal, "Country")
    cbc(country, "IdentificationCode", seller.get("country_code", "DE"))

    # BT-31: Seller VAT identifier
    if seller.get("vat_id"):
        tax_scheme_s = cac(party, "PartyTaxScheme")
        cbc(tax_scheme_s, "CompanyID", seller["vat_id"])
        scheme_s = cac(tax_scheme_s, "TaxScheme")
        cbc(scheme_s, "ID", "VAT")

    # BT-32: Seller tax registration (Steuernummer)
    if seller.get("tax_id"):
        tax_scheme_s2 = cac(party, "PartyTaxScheme")
        cbc(tax_scheme_s2, "CompanyID", seller["tax_id"])
        scheme_s2 = cac(tax_scheme_s2, "TaxScheme")
        cbc(scheme_s2, "ID", "FC")  # FC = fiscal code

    legal = cac(party, "PartyLegalEntity")
    cbc(legal, "RegistrationName", seller.get("name", ""))

    # Seller contact (BG-6)
    if seller.get("contact_name") or seller.get("email") or seller.get("phone"):
        contact = cac(party, "Contact")
        if seller.get("contact_name"):
            cbc(contact, "Name", seller["contact_name"])
        if seller.get("phone"):
            cbc(contact, "Telephone", seller["phone"])
        if seller.get("email"):
            cbc(contact, "ElectronicMail", seller["email"])

    # ── Buyer (BG-7) ───────────────────────────────────────
    customer_party = cac(root, "AccountingCustomerParty")
    cparty = cac(customer_party, "Party")

    # BT-49: Buyer electronic address
    if buyer.get("endpoint_id"):
        ep = cbc(cparty, "EndpointID", buyer["endpoint_id"])
        ep.set("schemeID", buyer.get("endpoint_scheme", "EM"))

    cpostal = cac(cparty, "PostalAddress")
    cbc(cpostal, "StreetName", buyer.get("street", ""))
    cbc(cpostal, "CityName", buyer.get("city", ""))
    cbc(cpostal, "PostalZone", buyer.get("postal_code", ""))
    ccountry = cac(cpostal, "Country")
    cbc(ccountry, "IdentificationCode", buyer.get("country_code", "DE"))

    if buyer.get("vat_id"):
        tax_scheme_b = cac(cparty, "PartyTaxScheme")
        cbc(tax_scheme_b, "CompanyID", buyer["vat_id"])
        scheme_b = cac(tax_scheme_b, "TaxScheme")
        cbc(scheme_b, "ID", "VAT")

    clegal = cac(cparty, "PartyLegalEntity")
    cbc(clegal, "RegistrationName", buyer.get("name", ""))

    # ── Payment means (BG-16) ──────────────────────────────
    pay_means = cac(root, "PaymentMeans")
    # BT-81: Payment means code (30 = credit transfer)
    cbc(pay_means, "PaymentMeansCode", payment.get("means_code", "30"))

    if payment.get("iban"):
        payee_account = cac(pay_means, "PayeeFinancialAccount")
        cbc(payee_account, "ID", payment["iban"].replace(" ", ""))
        if payment.get("bic"):
            branch = cac(payee_account, "FinancialInstitutionBranch")
            cbc(branch, "ID", payment["bic"])

    # ── Payment terms (BT-20) ──────────────────────────────
    if data.get("payment_terms"):
        pt = cac(root, "PaymentTerms")
        cbc(pt, "Note", data["payment_terms"])

    # ── Tax totals (BG-23) ─────────────────────────────────
    # Calculate totals
    line_extension_total = 0.0
    tax_by_rate = {}

    for item in items:
        qty = item.get("quantity", 1)
        price = item.get("unit_price", 0)
        line_total = qty * price
        line_extension_total += line_total

        rate = item.get("tax_rate", 19)
        rate_key = f"{rate:.1f}"
        if rate_key not in tax_by_rate:
            tax_by_rate[rate_key] = {"rate": rate, "taxable": 0.0}
        tax_by_rate[rate_key]["taxable"] += line_total

    total_tax = 0.0
    for info in tax_by_rate.values():
        info["tax"] = round(info["taxable"] * info["rate"] / 100, 2)
        total_tax += info["tax"]

    tax_total = cac(root, "TaxTotal")
    ta = cbc(tax_total, "TaxAmount", amount_str(total_tax))
    ta.set("currencyID", currency)

    for rate_key, info in tax_by_rate.items():
        subtotal_el = cac(tax_total, "TaxSubtotal")
        tb = cbc(subtotal_el, "TaxableAmount", amount_str(info["taxable"]))
        tb.set("currencyID", currency)
        tax_a = cbc(subtotal_el, "TaxAmount", amount_str(info["tax"]))
        tax_a.set("currencyID", currency)
        cat = cac(subtotal_el, "TaxCategory")
        cbc(cat, "ID", "S")  # S = standard rate
        cbc(cat, "Percent", amount_str(info["rate"]))
        ts = cac(cat, "TaxScheme")
        cbc(ts, "ID", "VAT")

    # ── Monetary totals (BG-22) ────────────────────────────
    monetary = cac(root, "LegalMonetaryTotal")
    le = cbc(monetary, "LineExtensionAmount", amount_str(line_extension_total))
    le.set("currencyID", currency)
    te = cbc(monetary, "TaxExclusiveAmount", amount_str(line_extension_total))
    te.set("currencyID", currency)
    ti = cbc(monetary, "TaxInclusiveAmount", amount_str(line_extension_total + total_tax))
    ti.set("currencyID", currency)
    pa = cbc(monetary, "PayableAmount", amount_str(line_extension_total + total_tax))
    pa.set("currencyID", currency)

    # ── Invoice lines (BG-25) ──────────────────────────────
    for idx, item in enumerate(items, 1):
        line = cac(root, "InvoiceLine")
        cbc(line, "ID", str(idx))

        qty = item.get("quantity", 1)
        price = item.get("unit_price", 0)
        line_total = qty * price

        iq = cbc(line, "InvoicedQuantity", str(qty))
        iq.set("unitCode", item.get("unit_code", "HUR"))  # HUR = hours

        lea = cbc(line, "LineExtensionAmount", amount_str(line_total))
        lea.set("currencyID", currency)

        # Line tax
        line_tax = cac(line, "Item")
        cbc(line_tax, "Description", item.get("description", ""))
        cbc(line_tax, "Name", item.get("name", item.get("description", "")))

        ctax = cac(line_tax, "ClassifiedTaxCategory")
        cbc(ctax, "ID", "S")
        cbc(ctax, "Percent", amount_str(item.get("tax_rate", 19)))
        cts = cac(ctax, "TaxScheme")
        cbc(cts, "ID", "VAT")

        # Price
        price_el = cac(line, "Price")
        pam = cbc(price_el, "PriceAmount", amount_str(price))
        pam.set("currencyID", currency)

    return root


def to_pretty_xml(root):
    """Convert ElementTree to pretty-printed XML string."""
    rough = tostring(root, encoding="unicode", xml_declaration=False)
    declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
    dom = parseString(rough)
    pretty = dom.toprettyxml(indent="  ", encoding=None)
    # Remove the extra declaration added by minidom
    lines = pretty.split("\n")
    if lines[0].startswith("<?xml"):
        lines = lines[1:]
    return declaration + "\n".join(lines)


# ── Example Data ────────────────────────────────────────────────────────────

EXAMPLE_DATA = {
    "invoice_number": "RE-2026-0042",
    "invoice_date": "2026-05-07",
    "due_date": "2026-05-21",
    "service_period_start": "2026-04-01",
    "service_period_end": "2026-04-30",
    "currency": "EUR",
    "buyer_reference": "PO-2026-1234",
    "payment_terms": "Zahlbar innerhalb von 14 Tagen nach Rechnungserhalt.",
    "seller": {
        "name": "Anna Schmidt Consulting",
        "street": "Torstraße 123",
        "city": "Berlin",
        "postal_code": "10119",
        "country_code": "DE",
        "vat_id": "DE123456789",
        "tax_id": "27/456/12345",
        "email": "anna@schmidtconsulting.de",
        "phone": "+49 30 12345678",
        "endpoint_id": "anna@schmidtconsulting.de",
        "endpoint_scheme": "EM"
    },
    "buyer": {
        "name": "Bundesamt für Beispiel",
        "street": "Beispielstraße 1",
        "city": "Bonn",
        "postal_code": "53113",
        "country_code": "DE",
        "endpoint_id": "0204:991-12345-67",
        "endpoint_scheme": "0204"
    },
    "items": [
        {
            "description": "IT-Beratung — Digitalisierung Fachverfahren",
            "name": "IT-Beratung",
            "quantity": 40,
            "unit_price": 130.00,
            "unit_code": "HUR",
            "tax_rate": 19
        },
        {
            "description": "Workshop Durchführung und Nachbereitung",
            "name": "Workshop",
            "quantity": 2,
            "unit_price": 950.00,
            "unit_code": "DAY",
            "tax_rate": 19
        }
    ],
    "payment": {
        "means_code": "30",
        "iban": "DE89 3704 0044 0532 0130 00",
        "bic": "COBADEFFXXX"
    }
}


# ── Main ────────────────────────────────────────────────────────────────────


def main():
    if len(sys.argv) > 1:
        if sys.argv[1] == "--example":
            print(json.dumps(EXAMPLE_DATA, indent=2, ensure_ascii=False))
            return
        if sys.argv[1] in ("--help", "-h"):
            print(__doc__)
            return

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

    root = build_xrechnung(data)
    print(to_pretty_xml(root))


if __name__ == "__main__":
    main()
