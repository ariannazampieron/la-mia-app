import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CARD_TONES, type CardTone } from "@/lib/finance/card-tones";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

export function IndicatorCard({
  title,
  value,
  breakdown,
  tone,
  variant = "default",
  percentage,
  percentageLabel,
  className,
}: {
  title: string;
  value: number;
  /** `valueNode` replaces the formatted value, e.g. with an editable amount. */
  breakdown: { label: string; value: number; valueNode?: React.ReactNode }[];
  tone: CardTone;
  /** "alert": red border (amounts to pay); "solid": filled green, like the Casa value card;
   *  "tinted": full pale-teal fill with a larger figure (Home detail cards). */
  variant?: "default" | "alert" | "solid" | "tinted";
  /** Optional percentage shown as a small badge next to the title (e.g. savings rate on revenue). */
  percentage?: number;
  percentageLabel?: string;
  className?: string;
}) {
  const colors = CARD_TONES[tone];
  const solid = variant === "solid";
  const tinted = variant === "tinted";

  return (
    <Card
      className={cn(
        variant === "alert" && "border-destructive",
        solid && "border-success bg-success text-success-foreground",
        tinted && "bg-accent border-transparent shadow-none",
        className
      )}
      style={
        variant === "default"
          ? { borderTopWidth: "4px", borderTopColor: colors.bg }
          : variant === "alert"
            ? { borderTopWidth: "4px" }
            : undefined
      }
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle
            className={cn(
              "text-sm font-semibold tracking-wider uppercase",
              variant === "alert" && "text-destructive",
              tinted && "text-accent-foreground"
            )}
            style={variant === "default" ? { color: colors.text } : undefined}
          >
            {title}
          </CardTitle>
          {percentage !== undefined && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-semibold tabular-nums"
              style={{ backgroundColor: colors.bgSoft, color: colors.text }}
              title={percentageLabel}
            >
              {percentage.toFixed(1)}%
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p
          className={cn(
            "font-mono font-bold tracking-tight tabular-nums",
            solid || tinted ? "text-4xl" : "text-3xl",
            solid ? "text-success-foreground" : "text-foreground",
            !solid && value < 0 && "text-destructive"
          )}
        >
          {currencyFormatter.format(value)}
        </p>
        <dl
          className={cn(
            "space-y-1 border-t pt-3 text-xs",
            solid
              ? "border-success-foreground/30 text-success-foreground/85"
              : tinted
                ? "border-accent-foreground/15 text-accent-foreground/80"
                : "border-border text-muted-foreground"
          )}
        >
          {breakdown.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3"
            >
              <dt className="min-w-0 truncate">{item.label}</dt>
              <dd className="shrink-0 font-mono tabular-nums">
                {item.valueNode ?? currencyFormatter.format(item.value)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
