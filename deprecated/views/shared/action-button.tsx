import { useAction, type ActionState } from "./use-kit-actions";

const STATE_LABELS: Record<string, Record<ActionState, string>> = {
  default: { idle: "", loading: "...", success: "\u2713", error: "\u2717" },
};

const STATE_CLASSES: Record<ActionState, string> = {
  idle: "border-ks-hair text-ks-muted hover:bg-ks-paper-warm",
  loading: "border-ks-hair text-ks-muted opacity-70 cursor-wait",
  success: "border-emerald-200 text-emerald-700 bg-emerald-50",
  error: "border-red-200 text-red-600 bg-red-50",
};

interface ActionButtonProps {
  label: string;
  successLabel?: string;
  errorLabel?: string;
  onClick: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function ActionButton({
  label,
  successLabel = "Done!",
  errorLabel = "Failed",
  onClick,
  disabled,
  className = "",
}: ActionButtonProps) {
  const [run, state] = useAction(onClick);

  const text = state === "idle" ? label
    : state === "loading" ? `${label}...`
    : state === "success" ? successLabel
    : errorLabel;

  return (
    <button
      onClick={run}
      disabled={disabled || state === "loading"}
      className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-all ${STATE_CLASSES[state]} ${className}`}
    >
      {text}
    </button>
  );
}

export { useAction };
