import { Check } from "lucide-react";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const percentFormatter = new Intl.NumberFormat("it-IT", {
  style: "percent",
  maximumFractionDigits: 0,
});

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Encouraging line for how far along a goal is. Calm, no emoji. */
function encouragement(progress: number, missing: string): string {
  if (progress >= 1) return "Obiettivo raggiunto. Ora tienilo stabile.";
  if (progress >= 0.75) return `Ci sei quasi: mancano solo ${missing}.`;
  if (progress >= 0.5) return `Oltre metà strada. Mancano ${missing}.`;
  if (progress >= 0.25)
    return `Buon ritmo: ogni mese ti avvicina. Mancano ${missing}.`;
  return `Si parte da qui: ogni euro messo via conta. Mancano ${missing}.`;
}

/**
 * One goal on the navy Home hero: a progress ring with the percentage, what it means, the
 * amounts and an encouraging line (plus an estimate of when it's reached, if known).
 */
export function GoalProgress({
  eyebrow,
  title,
  progress,
  current,
  target,
  missing,
  detail,
  eta,
}: {
  eyebrow: string;
  title: string;
  progress: number;
  current: number;
  target: number;
  missing: number;
  detail: string;
  /** e.g. "Al ritmo di quest'anno ci arrivi in circa 4 mesi"; null when not estimable. */
  eta: string | null;
}) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const reached = progress >= 1;

  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-white/[0.06] p-6 ring-1 ring-white/10 sm:flex-row sm:items-center">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            strokeWidth="10"
            className="stroke-white/15"
          />
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${clamped * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            className="stroke-primary"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {reached ? (
            <Check className="text-primary h-10 w-10" strokeWidth={3} />
          ) : (
            <span className="font-mono text-3xl font-bold tabular-nums">
              {percentFormatter.format(clamped)}
            </span>
          )}
        </div>
      </div>

      <div className="min-w-0 space-y-2">
        <p className="text-[11px] font-semibold tracking-wider text-white/60 uppercase">
          {eyebrow}
        </p>
        <h3 className="text-xl font-bold tracking-tight">{title}</h3>
        <p className="font-mono text-sm text-white/80 tabular-nums">
          {currencyFormatter.format(current)}{" "}
          <span className="text-white/50">
            di {currencyFormatter.format(target)}
          </span>
        </p>
        <p className="text-sm text-white/70">{detail}</p>
        <p className="text-primary text-sm font-semibold">
          {encouragement(progress, currencyFormatter.format(missing))}
        </p>
        {eta && !reached && <p className="text-xs text-white/60">{eta}</p>}
      </div>
    </div>
  );
}
