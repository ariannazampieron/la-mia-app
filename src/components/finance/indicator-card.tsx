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
  className,
}: {
  title: string;
  value: number;
  breakdown: { label: string; value: number }[];
  tone: CardTone;
  className?: string;
}) {
  const colors = CARD_TONES[tone];

  return (
    <Card
      className={className}
      style={{ backgroundColor: colors.bgSoft, borderColor: `${colors.bg}33` }}
    >
      <CardHeader>
        <CardTitle
          className="text-sm font-semibold"
          style={{ color: colors.text }}
        >
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p
          className={cn("font-mono text-3xl font-semibold tabular-nums")}
          style={{ color: value < 0 ? "var(--destructive)" : colors.text }}
        >
          {currencyFormatter.format(value)}
        </p>
        <dl
          className="space-y-1 border-t pt-3 text-xs"
          style={{ borderColor: `${colors.bg}33`, color: colors.text }}
        >
          {breakdown.map((item) => (
            <div key={item.label} className="flex items-center justify-between opacity-80">
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
