import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <>
      <div className="mb-10">
        <div className="font-mono text-[11px] text-ks-muted tracking-wider uppercase mb-3">
          Legal
        </div>
        <h1>Terms of Service</h1>
        <p className="!text-ks-faint !text-xs font-mono !mb-0">
          Last updated: April 2026
        </p>
      </div>

      <h2>1. Service Description</h2>
      <p>KitStack provides two product tiers:</p>
      <ul>
        <li>
          <strong>Skills</strong> &mdash; free, downloadable .zip files that
          enhance Claude&apos;s capabilities for specific tasks. No account
          required.
        </li>
        <li>
          <strong>Kits</strong> &mdash; subscription-based applications with
          database persistence, interactive UI, and cross-session memory,
          delivered via the KitStack MCP connector.
        </li>
      </ul>

      <h2>2. Skills (Free Tier)</h2>
      <p>
        Skills are provided free of charge under a permissive license. You may
        use, modify, and share skills freely. KitStack makes no guarantees
        about skill output quality &mdash; they are tools, not professional
        services.
      </p>

      <h2>3. Kits (Subscription Tier)</h2>
      <p>
        Kit subscriptions are billed monthly. By subscribing, you receive:
      </p>
      <ul>
        <li>Access to all kit tools via the MCP connector</li>
        <li>A dedicated database per activated kit</li>
        <li>Interactive UI components in your AI conversations</li>
        <li>Data export capability at any time</li>
      </ul>

      <h2>4. Your Data</h2>
      <p>
        You own all data you create through KitStack kits. We store your data
        in isolated databases in the EU (Frankfurt). You can export at any
        time using built-in export tools. Upon account deletion, your data is
        permanently removed within 30 days.
      </p>

      <h2>5. Disclaimers</h2>
      <ul>
        <li>
          <strong>Contract Red Flag Skill/Kit</strong> &mdash; output is not
          legal advice. Always consult a qualified lawyer.
        </li>
        <li>
          <strong>Expense &amp; Tax Prep Skill/Kit</strong> &mdash; output is
          not tax advice. Always review with your Steuerberater.
        </li>
      </ul>
      <p>
        KitStack is a productivity tool. It does not replace professional
        advisory services.
      </p>

      <h2>6. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Reverse-engineer the MCP server or kit infrastructure</li>
        <li>Share your MCP connector credentials</li>
        <li>Use kits to store or process illegal content</li>
        <li>Exceed reasonable usage limits</li>
      </ul>

      <h2>7. Cancellation</h2>
      <p>
        You may cancel at any time. Access continues until the end of the
        current billing period. Your data remains accessible for 30 days
        after expiry for export. After 30 days, databases are deleted.
      </p>

      <h2>8. Widerrufsrecht</h2>
      <p>
        Under EU consumer law, you have a 14-day right of withdrawal from the
        date of subscription. To exercise this right, email{" "}
        <a href="mailto:hello@kitstack.co">hello@kitstack.co</a> within 14
        days. You will receive a full refund.
      </p>

      <h2>9. Limitation of Liability</h2>
      <p>
        KitStack is provided &ldquo;as is&rdquo; without warranties. We are
        not liable for indirect, incidental, or consequential damages. Our
        total liability is limited to the amount paid in the 12 months
        preceding the claim.
      </p>

      <h2>10. Governing Law</h2>
      <p>
        These terms are governed by the laws of the Federal Republic of
        Germany.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href="mailto:hello@kitstack.co">hello@kitstack.co</a>
      </p>
    </>
  );
}
