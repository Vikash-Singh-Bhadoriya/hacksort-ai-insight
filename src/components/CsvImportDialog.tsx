import { useRef, useState } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { validateAndParseCSV, rowToSubmission, REQUIRED_COLUMNS, OPTIONAL_COLUMNS } from "@/lib/csv-import";
import type { CsvRow, ParsedCsvResult } from "@/lib/csv-import";

type Step = "pick" | "preview" | "done";

const PREVIEW_LIMIT = 3;

export function CsvImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { addSubmission } = useStore();

  const [step, setStep] = useState<Step>("pick");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedCsvResult | null>(null);
  /** Per-row conversion errors keyed by row index into parsed.rows */
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  // Reset all local state whenever the dialog opens/closes
  function handleOpenChange(v: boolean) {
    if (!v) {
      setStep("pick");
      setFileName("");
      setParsed(null);
      setRowErrors({});
      setImporting(false);
    }
    onOpenChange(v);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Only .csv files are supported.");
      e.target.value = "";
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== "string") return;

      const result = validateAndParseCSV(text);

      // Pre-validate each row so we can show conversion errors in preview
      const errs: Record<number, string> = {};
      const ts = Date.now();
      result.rows.forEach((row, i) => {
        try {
          rowToSubmission(row, i, ts);
        } catch (err) {
          errs[i] = err instanceof Error ? err.message : String(err);
        }
      });

      setParsed(result);
      setRowErrors(errs);
      setStep("preview");
    };
    reader.readAsText(file);
  }

  function handleImport() {
    if (!parsed) return;
    setImporting(true);

    const ts = Date.now();
    let imported = 0;
    const conversionErrors: string[] = [];

    parsed.rows.forEach((row, i) => {
      if (rowErrors[i]) return; // skip rows with known conversion errors
      try {
        const sub = rowToSubmission(row, i, ts);
        addSubmission(sub);
        imported++;
      } catch (err) {
        conversionErrors.push(
          `Row ${i + 2}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });

    setImporting(false);

    if (imported > 0) {
      toast.success(
        `${imported} submission${imported === 1 ? "" : "s"} imported successfully.`,
        { description: "They are now visible in the Submissions list." },
      );
    }
    if (conversionErrors.length > 0) {
      toast.error(`${conversionErrors.length} row${conversionErrors.length === 1 ? "" : "s"} could not be imported.`, {
        description: conversionErrors.slice(0, 3).join(" | "),
      });
    }

    handleOpenChange(false);
  }

  // Rows that are importable (no conversion error)
  const validCount = parsed
    ? parsed.rows.filter((_, i) => !rowErrors[i]).length
    : 0;

  const hasAnyError =
    (parsed?.errors.length ?? 0) > 0 || Object.keys(rowErrors).length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Import submissions from CSV</DialogTitle>
          <DialogDescription>
            Upload a <code>.csv</code> file with columns:{" "}
            {REQUIRED_COLUMNS.map((c) => (
              <Badge key={c} variant="secondary" className="mr-1 font-mono text-xs">
                {c}
              </Badge>
            ))}
            <span className="text-muted-foreground"> (required) and </span>
            {OPTIONAL_COLUMNS.map((c) => (
              <Badge key={c} variant="outline" className="mr-1 font-mono text-xs border-border/60">
                {c}
              </Badge>
            ))}
            <span className="text-muted-foreground"> (optional).</span>
          </DialogDescription>
        </DialogHeader>

        {/* Step 1 — File pick */}
        {step === "pick" && (
          <div className="mt-2">
            <label
              htmlFor="csv-file-input"
              className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border/60 p-10 transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Click to choose a CSV file</span>
              <span className="text-xs text-muted-foreground">Only .csv format is accepted</span>
            </label>
            <input
              id="csv-file-input"
              ref={fileRef}
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* Step 2 — Preview */}
        {step === "preview" && parsed && (
          <div className="mt-2 space-y-4">
            {/* File summary */}
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/20 px-4 py-3">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {parsed.rows.length} data row{parsed.rows.length !== 1 ? "s" : ""} detected
                  {validCount !== parsed.rows.length && (
                    <> &mdash; <span className="text-success">{validCount} importable</span></>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => {
                  setStep("pick");
                  setParsed(null);
                  setRowErrors({});
                  setFileName("");
                  if (fileRef.current) fileRef.current.value = "";
                }}
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Parse-level errors (e.g. missing columns) */}
            {parsed.errors.length > 0 && (
              <div className="space-y-1.5 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  File errors
                </div>
                <ul className="space-y-1 pl-6 text-xs text-destructive/90">
                  {parsed.errors.map((e, i) => (
                    <li key={i} className="list-disc">{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Row-level conversion errors */}
            {Object.keys(rowErrors).length > 0 && (
              <div className="space-y-1.5 rounded-xl border border-warning/40 bg-warning/10 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-warning">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Row errors — these rows will be skipped
                </div>
                <ul className="space-y-1 pl-6 text-xs text-warning/90">
                  {Object.entries(rowErrors).map(([i, msg]) => (
                    <li key={i} className="list-disc">Row {Number(i) + 2}: {msg}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sample rows preview */}
            {parsed.rows.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Preview (first {Math.min(PREVIEW_LIMIT, parsed.rows.length)} row{parsed.rows.length !== 1 ? "s" : ""})
                </p>
                <div className="space-y-2">
                  {parsed.rows.slice(0, PREVIEW_LIMIT).map((row: CsvRow, i) => {
                    const hasError = !!rowErrors[i];
                    return (
                      <div
                        key={i}
                        className={`rounded-lg border px-4 py-3 text-xs ${
                          hasError
                            ? "border-warning/30 bg-warning/5"
                            : "border-border/50 bg-secondary/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-medium">{row["name"] || "(no name)"}</span>
                            <span className="text-muted-foreground"> &middot; {row["team"] || "(no team)"}</span>
                            <span className="text-muted-foreground"> &middot; {row["category"] || "(no category)"}</span>
                          </div>
                          {hasError ? (
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-warning mt-0.5" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success mt-0.5" />
                          )}
                        </div>
                        {row["problem"] && (
                          <p className="mt-1 line-clamp-1 text-muted-foreground">{row["problem"]}</p>
                        )}
                        {hasError && (
                          <p className="mt-1 text-warning/80">{rowErrors[i]}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No importable rows */}
            {parsed.rows.length > 0 && validCount === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                No rows can be imported. Fix the errors above and try again.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="mt-2">
          {step === "pick" && (
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || importing}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import {validCount > 0 ? `${validCount} submission${validCount === 1 ? "" : "s"}` : ""}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
