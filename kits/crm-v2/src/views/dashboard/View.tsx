import type { Infer } from "@kitstack/sdk";
import type { loader } from "./loader";

type Data = Infer<typeof loader>;

export function DashboardView({ data }: { data: Data }) {
  return (
    <div className="p-4">
      <h1 className="font-serif text-xl mb-4">Dashboard</h1>
      <p className="text-ks-muted mb-4">{data.length} item(s)</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ks-hair">
            <th className="text-left py-1">Name</th>
            <th className="text-left py-1">Description</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id} className="border-b border-ks-hair">
              <td className="py-1">{item.name}</td>
              <td className="py-1 text-ks-muted">{item.description || "\u2014"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
