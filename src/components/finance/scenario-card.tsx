import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Runway } from "@/lib/finance/scenarios";

const monthsFormatter = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 1,
});

export function formatRunway(months: Runway) {
  if (months === null) return "Senza limite";
  return `${monthsFormatter.format(months)} ${months === 1 ? "mese" : "mesi"}`;
}

/** One "what if" question with its answers, each a headline figure and how it's computed. */
export function ScenarioCard({
  title,
  question,
  options,
}: {
  title: string;
  question: string;
  options: { label: string; value: string; detail: string }[];
}) {
  return (
    <Card className="border-t-navy border-t-4">
      <CardHeader className="space-y-1">
        <CardTitle className="text-navy text-sm font-semibold tracking-wider uppercase">
          {title}
        </CardTitle>
        <p className="text-sm font-medium">{question}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {options.map((o) => (
          <div key={o.label} className="border-border border-t pt-3">
            <p className="text-muted-foreground text-xs">{o.label}</p>
            <p className="font-mono text-2xl font-bold tracking-tight tabular-nums">
              {o.value}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">{o.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
