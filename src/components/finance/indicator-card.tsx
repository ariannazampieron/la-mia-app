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
  percentage,
  percentageLabel,
  className,
}: {
  title: string;
  value: number;
  breakdown: { label: string; value: number }[];
  tone: CardTone;
  /** Optional percentage shown as a small badge next to the title (e.g. savings rate on revenue). */
  percentage?: number;
  percentageLabel?: string;
  className?: string;
}) {
  const colors = CARD_TONES[tone];

  return (
    <Card
      className={cn(className)}
      style={{
        borderTopWidth: "4px",
        borderTopColor: colors.bg,
      }}
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle
            className="text-sm font-semibold tracking-wider uppercase"
            style={{ color: colors.text }}
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
            "font-mono text-3xl font-bold tracking-tight tabular-nums text-foreground",
            value < 0 && "text-destructive"
          )}
        >
          {currencyFormatter.format(value)}
        </p>
        <dl className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          {breakdown.map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <dt>{item.label}</dt>
              <dd className="font-mono tabular-nums">
                {currencyFormatter.format(item.value)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
