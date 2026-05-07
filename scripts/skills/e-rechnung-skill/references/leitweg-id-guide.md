# Leitweg-ID Guide

## What Is a Leitweg-ID?

The Leitweg-ID is a routing identifier used in German public sector e-invoicing. It tells the central invoice receiving system (ZRE or OZG-RE) which specific authority, department, or cost center should receive the invoice.

**Format:** `[Grobadressierung]:[Feinadressierung]-[Prüfziffer]`
**Example:** `0204:991-12345-67`

## Structure

```
0204  :  991-12345  -  67
│        │             │
│        │             └── Check digit (Prüfziffer, 2 digits)
│        └──────────────── Fine address (Feinadressierung, variable length)
└───────────────────────── Coarse address (Grobadressierung, 4 digits)
```

### Grobadressierung (Coarse Address)
The first 4 digits identify the broad organizational unit:
- `02XX` — Federal authorities (Bundesbehörden)
- `03XX`–`16XX` — State authorities (Landesbehörden), mapped by Bundesland
- `04XX` — Nordrhein-Westfalen
- `09XX` — Bayern
- `11XX` — Berlin

### Feinadressierung (Fine Address)
The part after the colon identifies the specific department, cost center, or project:
- Structure varies by organization
- Can contain numbers, separated by hyphens
- The receiving authority defines and communicates this part

### Prüfziffer (Check Digit)
The last 2 digits after the final hyphen are a check digit for validation:
- Calculated using a modulo algorithm
- Prevents routing errors from typos

## Format Validation

A valid Leitweg-ID must match this pattern:
```regex
^\d{4}:\d{1,}(-\d{1,})*-\d{2}$
```

### Valid Examples
- `0204:991-12345-67` — Federal authority
- `0911:001-2024-42` — Bavarian authority
- `0402:12345678-90` — NRW authority
- `1100:SENBWF-01-23` — Some authorities use alphanumeric fine addresses

### Invalid Examples
- `0204:991-12345` — Missing check digit
- `204:991-12345-67` — Coarse address must be 4 digits
- `0204-991-12345-67` — Must use colon after coarse address

## Where to Find the Leitweg-ID

### 1. Ask the Authority
The most reliable method. When a Behörde issues a purchase order (Bestellnummer), the Leitweg-ID is usually included. Ask your contact person.

### 2. Check the Purchase Order / Contract
The Leitweg-ID is often printed on:
- Bestellung (purchase order)
- Rahmenvertrag (framework agreement)
- Auftragsbestätigung (order confirmation)

### 3. E-Rechnungsportale
Federal authorities use the ZRE (Zentrale Rechnungseingangsplattform):
- **ZRE des Bundes:** https://xrechnung.bund.de
- **OZG-RE:** For state and municipal authorities

Some portals have a directory where you can look up Leitweg-IDs.

### 4. Ask Your Accounting Software Provider
Many German accounting tools maintain databases of Leitweg-IDs.

## Using the Leitweg-ID in XRechnung

The Leitweg-ID goes into the **BT-10 (Buyer Reference)** field:

```xml
<cbc:BuyerReference>0204:991-12345-67</cbc:BuyerReference>
```

This is the single most important field for B2G invoicing. Without it, the invoice cannot be routed to the correct recipient and will be rejected.

## Common Mistakes

1. **Omitting the Leitweg-ID entirely** — The invoice will be rejected immediately
2. **Using the wrong Leitweg-ID** — The invoice goes to the wrong department. You'll get a rejection or no response.
3. **Confusing Leitweg-ID with Bestellnummer** — They are different. The Bestellnummer is the purchase order number; the Leitweg-ID is the routing address.
4. **Formatting errors** — Missing colon, missing check digit, wrong number of digits
5. **Using an outdated Leitweg-ID** — Authorities reorganize. If your invoice is rejected, verify the current Leitweg-ID.

## Leitweg-ID by Bundesland

| Code Range | Bundesland |
|------------|------------|
| 0201-0299 | Bund (Federal) |
| 0301-0399 | Baden-Württemberg |
| 0401-0499 | Nordrhein-Westfalen |
| 0501-0599 | Niedersachsen |
| 0601-0699 | Hessen |
| 0701-0799 | Sachsen |
| 0801-0899 | Rheinland-Pfalz |
| 0901-0999 | Bayern |
| 1001-1099 | Schleswig-Holstein |
| 1101-1199 | Berlin |
| 1201-1299 | Sachsen-Anhalt |
| 1301-1399 | Thüringen |
| 1401-1499 | Brandenburg |
| 1501-1599 | Mecklenburg-Vorpommern |
| 1601-1699 | Hamburg, Bremen, Saarland |
