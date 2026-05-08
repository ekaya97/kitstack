# View Patterns

Views are optional React components that render inside the LLM client as interactive iframes. Each view has three files in a directory under `src/views/`.

## View Structure

```
src/views/dashboard/
  index.ts      # View definition (defineView)
  loader.ts     # Server-side data fetching (defineLoader)
  View.tsx      # React component
```

## View Definition (index.ts)

```ts
import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";

export default defineView({
  slug: "dashboard",
  title: "Dashboard",
  loader,
});
```

The `slug` is used in URLs and `kit_view` calls. Keep it short and kebab-case.

## Loader (loader.ts)

The loader runs server-side and fetches data from the database. It receives the same `db` and `ctx` as tool handlers.

```ts
import { defineLoader } from "@kitstackco/sdk";
import { desc, sql, isNull } from "drizzle-orm";
import { contacts, deals } from "../../schema";

export const loader = defineLoader(async (db, ctx) => {
  const recentContacts = await db
    .select()
    .from(contacts)
    .where(isNull(contacts.archivedAt))
    .orderBy(desc(contacts.updatedAt))
    .limit(5);

  const dealsByStage = await db
    .select({
      stage: deals.stage,
      count: sql<number>`count(*)`,
      totalValue: sql<number>`sum(${deals.value})`,
    })
    .from(deals)
    .groupBy(deals.stage);

  return {
    recentContacts,
    dealsByStage,
    totalContacts: recentContacts.length,
  };
});
```

The return type is inferred — the React component receives it as typed props.

## React Component (View.tsx)

```tsx
import type { ViewProps } from "@kitstackco/sdk/runtime";
import type { loader } from "./loader";
import { useTool, useRefreshView } from "@kitstackco/sdk/runtime";

export default function Dashboard({ data }: ViewProps<typeof loader>) {
  const refresh = useRefreshView();

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Contacts" value={data.totalContacts} />
        {data.dealsByStage.map((s) => (
          <StatCard key={s.stage} label={s.stage} value={s.count} />
        ))}
      </div>

      {/* Recent Contacts */}
      <section>
        <h2 className="text-sm font-medium text-gray-500 uppercase mb-2">
          Recent Contacts
        </h2>
        <ul className="divide-y">
          {data.recentContacts.map((c) => (
            <li key={c.id} className="py-2 flex justify-between">
              <span className="font-medium">{c.name}</span>
              <span className="text-gray-400 text-sm">{c.company}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-500 capitalize">{label}</div>
    </div>
  );
}
```

## SDK Hooks

### useRefreshView()
Triggers the loader to re-run and re-render the component.

```tsx
const refresh = useRefreshView();
// After a mutation:
await callTool("add_contact", { name: "Sarah" });
refresh(); // View shows updated data
```

### useTool()
Call a tool directly from the view (e.g., from a button click).

```tsx
const { call, loading } = useTool("archive_contact");

<button
  onClick={() => call({ contactId: contact.id }).then(refresh)}
  disabled={loading}
>
  Archive
</button>
```

### callTool()
One-shot tool call without state management.

```tsx
import { callTool } from "@kitstackco/sdk/runtime";

await callTool("update_deal", { dealId: "dl_123", stage: "won" });
```

## Styling

Views use Tailwind CSS. The CSS file is at `src/views/styles.css`:

```css
@import "tailwindcss";
```

Configure in `tailwind.config.ts`:
```ts
export default {
  content: ["./src/views/**/*.tsx"],
};
```

## Common View Types

### Table / List View
Shows a sortable, filterable table of entities. Good for contacts, expenses, tasks.

### Dashboard View
Shows aggregated stats, charts, and recent activity. Good as the kit's "home" view.

### Detail View
Shows all information about a single entity. Good for contact detail, project detail.

### Form View
Collects user input and calls tools. Good for settings, import wizards.

### Kanban / Pipeline View
Shows entities as cards in columns by status/stage. Good for deals, tasks.

## Registering Views

In `kit.config.ts`:
```ts
import dashboardView from "./src/views/dashboard";
import contactsView from "./src/views/contacts";

export default defineKit({
  // ...
  views: [dashboardView, contactsView],
});
```
