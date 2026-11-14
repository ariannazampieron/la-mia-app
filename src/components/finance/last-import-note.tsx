import { CalendarClock } from "lucide-react";

/** "Dati aggiornati all'ultimo import: …", from the date entered in Transazioni. */
export function LastImportNote({ date }: { date: string | null }) {
  const formatted = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("it-IT", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <p className="bg-muted text-muted-foreground mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs">
      <CalendarClock className="h-3.5 w-3.5" />
      {formatted ? (
        <>
          Ultimo import estratti conto:{" "}
          <span className="text-foreground font-medium">{formatted}</span>
        </>
      ) : (
        "Data dell'ultimo import non ancora inserita in Transazioni"
      )}
    </p>
  );
}
