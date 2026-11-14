"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Manually tracked date of the last bank statement import, shown next to the import button. */
export function LastImportDate() {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const date = body?.lastStatementImportDate ?? "";
        setValue(date);
        setSaved(date);
      })
      .catch(() => {});
  }, []);

  async function save() {
    if (value === saved) return;
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastStatementImportDate: value || null }),
      });
      if (!res.ok) throw new Error();
      setSaved(value);
      toast.success("Data ultimo import salvata");
    } catch {
      toast.error("Impossibile salvare la data dell'ultimo import");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Label
        htmlFor="last-import-date"
        className="text-muted-foreground text-xs whitespace-nowrap"
      >
        Ultimo import
      </Label>
      <Input
        id="last-import-date"
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        className="h-9 w-40"
      />
    </div>
  );
}
