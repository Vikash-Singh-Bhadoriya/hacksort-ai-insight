import { useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export function DemoResetButton() {
  const { resetDemo } = useStore();
  const [open, setOpen] = useState(false);

  const handleReset = () => {
    resetDemo();
    setOpen(false);
    // Reload to re-hydrate from clean state
    window.location.href = "/";
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="px-0 text-muted-foreground/60 hover:text-muted-foreground gap-2 text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset demo
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset demonstration data?</AlertDialogTitle>
          <AlertDialogDescription>
            This will clear all evaluations, participant submissions, judge decisions and custom
            weight configurations, and restore the original seed data. Use this before a live
            demonstration to ensure a clean starting state.
            <br />
            <br />
            <strong className="text-foreground">This action cannot be undone.</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleReset}>Reset demo</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
