import { useKit } from "@kitstackco/sdk/view";
import { Chip, Prototyp } from "../shared";

type Data = {
  name: string;
  species: string;
  breed: string | null;
  ageYears: number | null;
  weightKg: number | null;
  needs: string[];
} | null;

const SPECIES_EMOJI: Record<string, string> = { hund: "🐶", katze: "🐱" };

export function PetCardView() {
  const { data } = useKit<Data>();
  if (!data) {
    return <div className="p-4 text-sm text-ks-muted">Noch kein Tierprofil.</div>;
  }
  const meta = [
    data.breed,
    data.ageYears != null ? `${data.ageYears} Jahre` : null,
    data.weightKg != null ? `${data.weightKg} kg` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="p-4">
      <div className="flex items-center gap-4 rounded-2xl border border-ks-hair bg-ks-paper p-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ks-accent-soft text-3xl">
          {SPECIES_EMOJI[data.species] ?? "🐾"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="truncate text-xl font-semibold text-ks-ink">{data.name}</h1>
            <span className="text-[11px] font-medium uppercase tracking-wider text-ks-accent">
              Mein Tier
            </span>
          </div>
          {meta && <p className="mt-0.5 text-sm text-ks-muted">{meta}</p>}
          {data.needs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.needs.map((n) => (
                <Chip key={n} tone="accent">
                  {n}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </div>
      <Prototyp />
    </div>
  );
}
