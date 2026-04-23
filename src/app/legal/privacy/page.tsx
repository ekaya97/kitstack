import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy / Datenschutzerklärung",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy / Datenschutzerklärung</h1>
      <p className="text-ks-muted">Last updated: April 2026</p>

      <h2>1. Overview</h2>
      <p>
        KitStack (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates
        kitstack.co and the KitStack MCP connector. This policy explains how
        we collect, use, and protect your data.
      </p>

      <h2>2. Data Controller</h2>
      <p>
        enka Consulting, Enes Kaya
        <br />
        E-Mail: hello@kitstack.co
      </p>

      <h2>3. What We Collect</h2>

      <h3>3.1 Skills (Free Downloads)</h3>
      <p>
        Downloading a skill requires <strong>no account and no personal data</strong>.
        We track anonymous download counts. No cookies are set for skill downloads.
      </p>

      <h3>3.2 Kit Subscriptions</h3>
      <p>When you create an account, we store:</p>
      <ul>
        <li>Email address and hashed password (via BetterAuth)</li>
        <li>Subscription status and plan</li>
        <li>Kit activation records (which kits you use)</li>
      </ul>

      <h3>3.3 Kit Data (User-Generated Content)</h3>
      <p>
        Each activated kit stores your data in a <strong>dedicated, isolated
        database</strong> (Turso, Frankfurt region). This includes contacts,
        deals, expenses, meeting notes, or other content you create through
        kit tools. This data is:
      </p>
      <ul>
        <li>Stored exclusively in the EU (Frankfurt, Germany)</li>
        <li>Isolated per user per kit — no other user can access your data</li>
        <li>Exportable at any time via the kit&apos;s export tool</li>
        <li>Deleted when you delete your account</li>
      </ul>

      <h2>4. Third-Party Processors</h2>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Purpose</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Turso (Frankfurt)</td>
            <td>Database hosting</td>
            <td>Kit data, user records</td>
          </tr>
          <tr>
            <td>AWS (Frankfurt)</td>
            <td>Hosting, Lambda, S3, DynamoDB</td>
            <td>Application data</td>
          </tr>
          <tr>
            <td>PostHog</td>
            <td>Product analytics</td>
            <td>Anonymous usage events</td>
          </tr>
          <tr>
            <td>Lemon Squeezy</td>
            <td>Payment processing (future)</td>
            <td>Payment details, email</td>
          </tr>
        </tbody>
      </table>

      <h2>5. Cookies</h2>
      <p>
        We use only <strong>essential cookies</strong> for authentication
        sessions. We do not use tracking cookies. PostHog is configured in
        cookieless mode.
      </p>

      <h2>6. Your Rights (GDPR)</h2>
      <p>You have the right to:</p>
      <ul>
        <li><strong>Access</strong> — request a copy of your data</li>
        <li><strong>Rectification</strong> — correct inaccurate data</li>
        <li><strong>Erasure</strong> — delete your account and all data</li>
        <li><strong>Portability</strong> — export your data (every kit has an export tool)</li>
        <li><strong>Object</strong> — object to processing</li>
        <li><strong>Complaint</strong> — file a complaint with a supervisory authority</li>
      </ul>
      <p>
        To exercise these rights, email{" "}
        <a href="mailto:hello@kitstack.co">hello@kitstack.co</a>.
      </p>

      <h2>7. Data Retention</h2>
      <p>
        Account data is retained while your account is active. Upon deletion,
        all user databases, authentication records, and subscription data are
        permanently deleted within 30 days.
      </p>

      <h2>8. Data Security</h2>
      <p>
        All data is encrypted in transit (TLS) and at rest. Database tokens
        are scoped per user per kit. OAuth tokens expire after 1 hour.
      </p>
    </>
  );
}
