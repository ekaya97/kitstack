import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { SkillZipContents } from "@/components/how-it-works/skill-zip-contents";
import { SkillOutputMock } from "@/components/how-it-works/skill-output-mock";
import { KitPipelineMock } from "@/components/how-it-works/kit-pipeline-mock";
import { KitPersistenceMock } from "@/components/how-it-works/kit-persistence-mock";
import { ClaudeCustomizeSidebar } from "@/components/how-it-works/claude-customize-sidebar";
import { ClaudeSkillsTab } from "@/components/how-it-works/claude-skills-tab";
import { ClaudeConnectorsPage } from "@/components/how-it-works/claude-connectors-page";
import { ClaudeAddConnectorModal } from "@/components/how-it-works/claude-add-connector-modal";
import { ChatGPTAppsSettings } from "@/components/how-it-works/chatgpt-apps-settings";
import { ChatGPTNewAppModal } from "@/components/how-it-works/chatgpt-new-app-modal";
import { GeminiGemManager } from "@/components/how-it-works/gemini-gem-manager";
import { GeminiGemEditor } from "@/components/how-it-works/gemini-gem-editor";
import { ChatGPTCreateGPT } from "@/components/how-it-works/chatgpt-create-gpt";
import { ChatGPTUploadFiles } from "@/components/how-it-works/chatgpt-upload-files";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Learn what KitStack skills and kits are, and how to set them up on Claude, ChatGPT, and Gemini.",
};

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-5">
      <div className="font-serif text-[40px] text-ks-accent italic leading-none pt-1 shrink-0 w-10">
        {n}
      </div>
      <div className="flex-1">
        <h3 className="font-serif text-[20px] text-ks-ink mb-2">{title}</h3>
        <div className="font-sans text-[14px] text-ks-muted leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="bg-ks-paper min-h-screen flex flex-col">
      <Nav active="How it works" />

      {/* HERO */}
      <section className="px-16 pt-14 pb-10 max-w-4xl mx-auto text-center">
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-3">
          HOW IT WORKS
        </div>
        <h1 className="font-serif text-[56px] leading-[1.02] tracking-tight text-ks-ink">
          Skills are free.{" "}
          <span className="italic text-ks-accent">Kits remember.</span>
        </h1>
        <p className="font-sans text-[18px] text-ks-muted mt-5 max-w-xl mx-auto leading-relaxed">
          Two products, one platform. Start with a free skill, upgrade to a kit
          when you need persistence and interactive UI.
        </p>
      </section>

      {/* WHAT ARE SKILLS */}
      <section className="px-16 py-14 bg-ks-paper-warm border-y border-ks-hair">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-[1fr_1fr] gap-12 items-start">
            <div>
              <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-2">
                TIER 1 &middot; FREE
              </div>
              <h2 className="font-serif text-[40px] tracking-tight mb-4">
                What are Skills?
              </h2>
              <p className="font-sans text-[15px] text-ks-ink2 leading-relaxed mb-4">
                A skill is a downloadable package that turns your AI into a
                specialist for one specific task &mdash; writing proposals,
                scanning contracts, crafting cold emails.
              </p>
              <p className="font-sans text-[15px] text-ks-ink2 leading-relaxed mb-4">
                You download a .zip file, upload it to Claude (or any compatible
                AI), and it just works. No account needed, no subscription, no
                setup beyond a single upload.
              </p>

              <div className="flex flex-col gap-2 mb-6">
                {[
                  "Free forever — no account, no card",
                  "Works on Claude, ChatGPT, Gemini, and more",
                  "Each skill includes expert methodology, not just prompts",
                  "Reference files with real domain knowledge",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 font-sans text-[13px] text-ks-ink"
                  >
                    <span className="text-green-700 text-xs shrink-0">
                      &#10003;
                    </span>
                    {item}
                  </div>
                ))}
              </div>

              <div className="ks-card p-4">
                <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-2">
                  THE TRADE-OFF
                </div>
                <p className="font-sans text-[13px] text-ks-muted leading-relaxed">
                  Skills have no memory. Every conversation starts from scratch.
                  They can&apos;t recall past work, track outcomes, or show
                  dashboards. That&apos;s what kits are for.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <SkillZipContents />
              <SkillOutputMock />
            </div>
          </div>
        </div>
      </section>

      {/* WHAT ARE KITS */}
      <section className="px-16 py-14">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-[1fr_1fr] gap-12 items-start">
            <div className="flex flex-col gap-4">
              <KitPipelineMock />
              <KitPersistenceMock />
            </div>

            <div>
              <div className="font-mono text-[10px] text-ks-accent tracking-wider mb-2">
                TIER 2 &middot; &euro;5/MO
              </div>
              <h2 className="font-serif text-[40px] tracking-tight mb-4">
                What are Kits?
              </h2>
              <p className="font-sans text-[15px] text-ks-ink2 leading-relaxed mb-4">
                A kit is the persistent, interactive version of a skill. It
                saves your data between conversations, shows dashboards and
                tables inline in the chat, and remembers everything.
              </p>
              <p className="font-sans text-[15px] text-ks-ink2 leading-relaxed mb-4">
                You connect KitStack once as a connector. All your activated kits
                become available automatically &mdash; no uploads, no
                extensions.
              </p>

              <div className="flex flex-col gap-2 mb-6">
                {[
                  "Your own private database per kit",
                  "Interactive UI: kanban boards, tables, dashboards",
                  "Data survives sessions and syncs across devices",
                  "Export your data anytime as CSV or JSON",
                  "Replaces €50–200/mo of SaaS tools",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 font-sans text-[13px] text-ks-ink"
                  >
                    <span className="text-ks-accent text-xs shrink-0">
                      &#10003;
                    </span>
                    {item}
                  </div>
                ))}
              </div>

              <Link
                href="/kits"
                className="ks-btn ks-btn-accent !text-[13px]"
              >
                Browse kits &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* THE UPGRADE PATH */}
      <section className="px-16 py-10 bg-ks-ink text-ks-paper">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-[36px] tracking-tight mb-3">
            The upgrade path is natural.
          </h2>
          <p className="font-sans text-[16px] text-ks-paper-deep leading-relaxed max-w-xl mx-auto mb-6">
            Download the free Proposal Skill. Generate a great proposal. Next
            week, you can&apos;t recall what you quoted that client. The CRM Kit
            remembers everything &mdash; proposals, contacts, deals, pipeline.
          </p>
          <div className="flex justify-center items-center gap-4 font-sans text-sm text-ks-paper-deep">
            <span>Download free skill</span>
            <span className="font-serif text-[28px] text-ks-accent italic">
              &rarr;
            </span>
            <span>Love it? Upgrade to the kit</span>
            <span className="font-serif text-[28px] text-ks-accent italic">
              &rarr;
            </span>
            <span>Keep your data forever</span>
          </div>
        </div>
      </section>

      {/* SETUP GUIDES */}
      <section className="px-16 pt-16 pb-6">
        <div className="max-w-4xl mx-auto text-center mb-8">
          <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-3">
            SETUP GUIDES
          </div>
          <h2 className="font-serif text-[48px] tracking-tight mb-8">
            Step-by-step for every platform.
          </h2>
          <div className="flex justify-center gap-3">
            <a
              href="#claude"
              className="ks-btn !py-2.5 !px-5 !text-[13px] !gap-2.5"
            >
              <span className="w-6 h-6 rounded bg-[#d97757] flex items-center justify-center text-white font-serif text-xs font-bold shrink-0">
                C
              </span>
              Claude
            </a>
            <a
              href="#chatgpt"
              className="ks-btn !py-2.5 !px-5 !text-[13px] !gap-2.5"
            >
              <span className="w-6 h-6 rounded bg-[#10a37f] flex items-center justify-center text-white font-serif text-xs font-bold shrink-0">
                G
              </span>
              ChatGPT
            </a>
            <a
              href="#gemini"
              className="ks-btn !py-2.5 !px-5 !text-[13px] !gap-2.5"
            >
              <span className="w-6 h-6 rounded bg-[#4285f4] flex items-center justify-center text-white font-serif text-xs font-bold shrink-0">
                G
              </span>
              Gemini
            </a>
          </div>
        </div>
      </section>

      {/* CLAUDE GUIDE */}
      <section className="px-16 pb-14" id="claude">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-[#d97757] flex items-center justify-center">
              <span className="text-white font-serif text-lg font-bold">C</span>
            </div>
            <div>
              <h3 className="font-serif text-[28px] tracking-tight">Claude</h3>
              <span className="font-mono text-[11px] text-ks-muted">
                claude.ai &middot; Desktop &middot; iOS &middot; Cowork
              </span>
            </div>
          </div>

          {/* Skills on Claude */}
          <div className="mb-10">
            <h4 className="font-serif text-[20px] text-ks-ink mb-5 pb-2 border-b border-ks-hair">
              Adding a skill to Claude
            </h4>
            <div className="grid grid-cols-[1fr_1fr] gap-8">
              <div className="flex flex-col gap-6">
                <Step n="01" title="Download the skill">
                  Find a skill on KitStack and click the download button. You&apos;ll
                  get a .zip file &mdash; no need to unzip it.
                </Step>
                <Step n="02" title="Open Customize">
                  In Claude&apos;s sidebar, click{" "}
                  <b className="text-ks-ink">Customize</b>.
                </Step>
                <Step n="03" title="Go to Skills">
                  Select the <b className="text-ks-ink">Skills</b> tab, then
                  click <b className="text-ks-ink">Add skill</b>.
                </Step>
                <Step n="04" title="Upload the .zip">
                  Select the downloaded .zip file. Claude will load the skill
                  immediately. Start a new conversation and it&apos;s ready.
                </Step>
              </div>
              <div className="flex flex-col gap-4">
                <ClaudeCustomizeSidebar />
                <ClaudeSkillsTab />
              </div>
            </div>
          </div>

          {/* Kits on Claude */}
          <div>
            <h4 className="font-serif text-[20px] text-ks-ink mb-5 pb-2 border-b border-ks-hair">
              Connecting KitStack kits to Claude
            </h4>
            <div className="grid grid-cols-[1fr_1fr] gap-8">
              <div className="flex flex-col gap-6">
                <Step n="01" title="Subscribe on KitStack">
                  Sign up at kitstack.co and choose the Starter plan (&euro;5/mo).
                  Activate the kits you want from your dashboard.
                </Step>
                <Step n="02" title="Copy the connector URL">
                  Your connector URL is{" "}
                  <code className="font-mono text-[12px] bg-ks-paper-warm px-1.5 py-0.5 rounded">
                    mcp.kitstack.co
                  </code>
                  . Copy it from your dashboard.
                </Step>
                <Step n="03" title="Add custom connector">
                  In Claude, go to <b className="text-ks-ink">Customize</b>{" "}
                  &rarr; <b className="text-ks-ink">Connectors</b> &rarr;{" "}
                  click the <b className="text-ks-ink">+</b> button &rarr;{" "}
                  <b className="text-ks-ink">Add custom connector</b>.
                </Step>
                <Step n="04" title="Enter name and URL">
                  Enter <b className="text-ks-ink">KitStack</b> as the name and
                  paste{" "}
                  <code className="font-mono text-[12px] bg-ks-paper-warm px-1.5 py-0.5 rounded">
                    mcp.kitstack.co
                  </code>{" "}
                  as the Remote MCP server URL. Click{" "}
                  <b className="text-ks-ink">Add</b>.
                </Step>
                <Step n="05" title="Authorize and use">
                  Claude will open a sign-in window. Use the same KitStack
                  account. Once authorized, all your active kits appear as tools
                  automatically.
                </Step>
              </div>
              <div className="flex flex-col gap-4">
                <ClaudeConnectorsPage />
                <ClaudeAddConnectorModal />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CHATGPT GUIDE */}
      <section className="px-16 py-14 bg-ks-paper-warm border-y border-ks-hair" id="chatgpt">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-[#10a37f] flex items-center justify-center">
              <span className="text-white font-serif text-lg font-bold">G</span>
            </div>
            <div>
              <h3 className="font-serif text-[28px] tracking-tight">ChatGPT</h3>
              <span className="font-mono text-[11px] text-ks-muted">
                chatgpt.com &middot; Desktop &middot; Mobile
              </span>
            </div>
          </div>

          <div className="mb-10">
            <h4 className="font-serif text-[20px] text-ks-ink mb-5 pb-2 border-b border-ks-hair">
              Adding a skill to ChatGPT
            </h4>
            <div className="grid grid-cols-[1fr_1fr] gap-8">
              <div className="flex flex-col gap-6">
                <Step n="01" title="Download the skill">
                  Download the .zip from KitStack. Unzip it to access the files.
                </Step>
                <Step n="02" title="Create a custom GPT or use Projects">
                  In ChatGPT, go to{" "}
                  <b className="text-ks-ink">Explore GPTs</b> &rarr;{" "}
                  <b className="text-ks-ink">Create</b>. Or use a{" "}
                  <b className="text-ks-ink">Project</b> and add the files
                  there.
                </Step>
                <Step n="03" title="Upload the skill files">
                  Upload SKILL.md and all reference files from the unzipped
                  folder. The SKILL.md contains the instructions ChatGPT will
                  follow.
                </Step>
                <Step n="04" title="Start chatting">
                  Use the custom GPT or start a conversation in the project.
                  ChatGPT will follow the skill&apos;s methodology.
                </Step>
              </div>
              <div className="flex flex-col gap-4">
                <ChatGPTCreateGPT />
                <ChatGPTUploadFiles />
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-serif text-[20px] text-ks-ink mb-5 pb-2 border-b border-ks-hair">
              Connecting KitStack kits to ChatGPT
            </h4>
            <div className="grid grid-cols-[1fr_1fr] gap-8">
              <div className="flex flex-col gap-6">
                <Step n="01" title="Subscribe on KitStack">
                  Same as Claude &mdash; sign up and activate your kits.
                </Step>
                <Step n="02" title="Open Settings &rarr; Apps">
                  Click your profile in the sidebar, then{" "}
                  <b className="text-ks-ink">Settings</b>. Select the{" "}
                  <b className="text-ks-ink">Apps</b> tab.
                </Step>
                <Step n="03" title="Enable Developer mode">
                  Click <b className="text-ks-ink">Advanced settings</b> at the
                  bottom. Toggle on{" "}
                  <b className="text-ks-ink">Developer mode</b>. A{" "}
                  <b className="text-ks-ink">Create app</b> button appears in
                  the header.
                </Step>
                <Step n="04" title="Create the app">
                  Click <b className="text-ks-ink">Create app</b>. Enter{" "}
                  <b className="text-ks-ink">KitStack</b> as the name and{" "}
                  <code className="font-mono text-[12px] bg-ks-paper-deep px-1.5 py-0.5 rounded">
                    mcp.kitstack.co
                  </code>{" "}
                  as the MCP Server URL. Set authentication to{" "}
                  <b className="text-ks-ink">OAuth</b> and click{" "}
                  <b className="text-ks-ink">Create</b>.
                </Step>
                <Step n="05" title="Authorize and use">
                  Sign in with your KitStack account. Your kits appear as tools
                  in ChatGPT conversations.
                </Step>
              </div>
              <div className="flex flex-col gap-4">
                <ChatGPTAppsSettings />
                <ChatGPTNewAppModal />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* GEMINI GUIDE */}
      <section className="px-16 py-14" id="gemini">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-[#4285f4] flex items-center justify-center">
              <span className="text-white font-serif text-lg font-bold">G</span>
            </div>
            <div>
              <h3 className="font-serif text-[28px] tracking-tight">Gemini</h3>
              <span className="font-mono text-[11px] text-ks-muted">
                gemini.google.com &middot; Google AI Studio
              </span>
            </div>
          </div>

          <div className="mb-10">
            <h4 className="font-serif text-[20px] text-ks-ink mb-5 pb-2 border-b border-ks-hair">
              Adding a skill to Gemini
            </h4>
            <div className="grid grid-cols-[1fr_1fr] gap-8">
              <div className="flex flex-col gap-6">
                <Step n="01" title="Download and unzip">
                  Download the skill .zip from KitStack and unzip it.
                </Step>
                <Step n="02" title="Open Gems">
                  In Gemini&apos;s sidebar, click{" "}
                  <b className="text-ks-ink">Gems</b>. Then click{" "}
                  <b className="text-ks-ink">+ New Gem</b>.
                </Step>
                <Step n="03" title="Name and add instructions">
                  Name the Gem after the skill (e.g. &quot;Client Proposal
                  Skill&quot;). Copy the entire contents of{" "}
                  <b className="text-ks-ink">SKILL.md</b> into the{" "}
                  <b className="text-ks-ink">Instructions</b> field.
                </Step>
                <Step n="04" title="Add reference files">
                  Drag individual reference files from the unzipped folder into
                  the <b className="text-ks-ink">Knowledge</b> section. Gemini
                  doesn&apos;t accept folders &mdash; add files one by one.
                </Step>
                <Step n="05" title="Save and chat">
                  Click <b className="text-ks-ink">Save</b> and start a
                  conversation. Gemini follows the skill&apos;s methodology.
                </Step>
              </div>
              <div className="flex flex-col gap-4">
                <GeminiGemManager />
                <GeminiGemEditor />
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-serif text-[20px] text-ks-ink mb-5 pb-2 border-b border-ks-hair">
              Connecting KitStack kits to Gemini
            </h4>
            <div className="grid grid-cols-[1fr_1fr] gap-8">
              <div className="flex flex-col gap-6">
                <Step n="01" title="MCP support coming soon">
                  Gemini is adding MCP connector support. Once available,
                  connecting KitStack will work the same way as Claude and
                  ChatGPT &mdash; paste the URL, authorize, and go.
                </Step>
              </div>
              <div>
                <div className="ks-card p-5">
                  <div className="font-mono text-[10px] text-ks-accent tracking-wider mb-2">
                    COMING SOON
                  </div>
                  <p className="font-sans text-[14px] text-ks-muted leading-relaxed">
                    We&apos;ll update this guide as soon as Gemini&apos;s MCP
                    connector is available. In the meantime, you can use skills
                    on Gemini via the Gem approach above.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* OTHER CLIENTS */}
      <section className="px-16 py-14 bg-ks-paper-warm border-t border-ks-hair">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-serif text-[32px] tracking-tight mb-6">
            Other compatible clients
          </h2>
          <p className="font-sans text-[15px] text-ks-muted leading-relaxed mb-6 max-w-xl">
            KitStack kits work with any client that supports the MCP protocol.
            Skills work with any AI that accepts uploaded files.
          </p>
          <div className="grid grid-cols-4 gap-4">
            {[
              { name: "VS Code", desc: "Copilot + MCP connectors", status: "Kits + Skills" },
              { name: "Cursor", desc: "MCP connector support", status: "Kits + Skills" },
              { name: "Goose", desc: "Block MCP client", status: "Kits" },
              { name: "Claude Code", desc: "CLI with MCP support", status: "Kits + Skills" },
            ].map((client) => (
              <div key={client.name} className="ks-card p-4">
                <div className="font-serif text-[18px] text-ks-ink mb-1">
                  {client.name}
                </div>
                <div className="font-sans text-[12px] text-ks-muted mb-2">
                  {client.desc}
                </div>
                <div className="font-mono text-[10px] text-ks-accent">
                  {client.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-16 py-14 text-center">
        <h2 className="font-serif text-[40px] tracking-tight mb-4">
          Ready to start?
        </h2>
        <p className="font-sans text-[16px] text-ks-muted mb-6">
          Download a free skill right now. No account needed.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/skills"
            className="ks-btn ks-btn-primary !py-3 !px-5 !text-[14px]"
          >
            Browse free skills
          </Link>
          <Link
            href="/kits"
            className="ks-btn ks-btn-accent !py-3 !px-5 !text-[14px]"
          >
            See kits in action &rarr;
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
