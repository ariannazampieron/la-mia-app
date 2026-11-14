"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Check, Loader2, Pencil } from "lucide-react";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

/** Amount saved as a user setting, edited in place with a pencil; refreshes the page on save. */
export function EditableAmount({
  value,
  field,
}: {
  value: number;
  field: "houseValue" | "investmentsValue" | "pensionFundBase";
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: Number(draft) || 0 }),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Impossibile salvare il valore");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <Input
          type="number"
          step="0.01"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          className="h-6 w-28 text-right font-mono text-xs"
        />
        <button onClick={handleSave} disabled={saving} aria-label="Salva">
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="text-success h-3.5 w-3.5" />
          )}
        </button>
      </span>
    );
  }

  return (
    <button
      className="flex items-center gap-1.5"
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
    >
      {currencyFormatter.format(value)}
      <Pencil className="h-3 w-3 opacity-50" />
    </button>
  );
}
