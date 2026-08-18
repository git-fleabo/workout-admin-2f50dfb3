import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronRight,
  Dumbbell,
  DatabaseZap,
  Layers3,
  MapPin,
  Repeat2,
  Ruler,
  Target,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { BLOCK_HEIGHT_OPTIONS } from "@/lib/position-measurements";
import { downloadPersonalData } from "@/lib/supabase-export.browser";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/manage")({
  head: () => ({
    meta: [
      { title: "Settings · Training Tracker" },
      {
        name: "description",
        content:
          "Configure the exercise library, training methods, programme templates, daily rotation, goals and locations.",
      },
    ],
  }),
  component: SettingsPage,
});

type ManageLink = {
  title: string;
  description: string;
  to:
    | "/library"
    | "/methods"
    | "/rotation"
    | "/goals"
    | "/locations"
    | "/programmes"
    | "/data-quality";
  icon: typeof BookOpen;
  accent: string;
};

const TRAINING_SETUP: ManageLink[] = [
  {
    title: "Exercise Library",
    description: "Movements, tracking types, availability and training locations.",
    to: "/library",
    icon: BookOpen,
    accent: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  },
  {
    title: "Training Methods",
    description: "Control system and custom methods used while planning and logging.",
    to: "/methods",
    icon: Layers3,
    accent: "text-indigo-300 bg-indigo-400/10 border-indigo-400/20",
  },
  {
    title: "Daily Rotation",
    description: "Choose the small practices that can rotate onto the Today screen.",
    to: "/rotation",
    icon: Repeat2,
    accent: "text-violet-300 bg-violet-400/10 border-violet-400/20",
  },
  {
    title: "Goals",
    description: "Create, update and track your active training goals.",
    to: "/goals",
    icon: Target,
    accent: "text-amber-300 bg-amber-400/10 border-amber-400/20",
  },
  {
    title: "Training Locations",
    description: "Manage training places and the equipment available at each one.",
    to: "/locations",
    icon: MapPin,
    accent: "text-sky-300 bg-sky-400/10 border-sky-400/20",
  },
  {
    title: "Programme Templates",
    description: "Review reusable strength blocks, weekly structure and prescriptions.",
    to: "/programmes",
    icon: Dumbbell,
    accent: "text-fuchsia-300 bg-fuchsia-400/10 border-fuchsia-400/20",
  },
];

const MAINTENANCE: ManageLink[] = [
  {
    title: "Data Quality",
    description: "Review historical ambiguity, provenance and calculation safety.",
    to: "/data-quality",
    icon: DatabaseZap,
    accent: "text-cyan-300 bg-cyan-400/10 border-cyan-400/20",
  },
];

function SettingsPage() {
  const [exporting, setExporting] = useState<"json" | "csv" | null>(null);
  const exportData = async (format: "json" | "csv") => {
    setExporting(format);
    try {
      await downloadPersonalData(format);
      toast.success(format === "json" ? "JSON export downloaded" : "CSV export downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The export could not be created.");
    } finally {
      setExporting(null);
    }
  };
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="border-b border-border pb-5">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      </header>

      <section className="space-y-3" aria-labelledby="training-setup-heading">
        <div>
          <h2 id="training-setup-heading" className="text-lg font-semibold">
            Training setup
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {TRAINING_SETUP.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className="group rounded-xl focus:outline-none">
                <Card className="flex h-full items-start gap-4 p-4 transition-colors group-hover:border-foreground/25 group-hover:bg-accent/35 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${item.accent}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{item.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                  <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="measurement-guides-heading">
        <div>
          <h2 id="measurement-guides-heading" className="text-lg font-semibold">
            Measurement guides
          </h2>
          <p className="text-sm text-muted-foreground">
            Personal equipment references used by selected exercises in the logger.
          </p>
        </div>
        <details className="overflow-hidden rounded-xl border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-start gap-4 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-300">
              <Ruler className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-medium">Foam & cork block heights</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Stack from bottom to top. FB = foam block · CB = cork block.
              </p>
            </div>
          </summary>
          <div className="grid sm:grid-cols-2">
            {BLOCK_HEIGHT_OPTIONS.map((option, index) => (
              <div
                key={`${option.heightCm}-${option.setup}`}
                className={`grid grid-cols-[4.5rem_1fr] gap-3 px-4 py-2.5 text-sm ${
                  index < BLOCK_HEIGHT_OPTIONS.length - 2 ? "border-b border-border/60" : ""
                } ${index % 2 === 0 ? "sm:border-r" : ""}`}
              >
                <span className="font-mono font-medium text-amber-200">{option.heightCm} cm</span>
                <span className="text-muted-foreground">{option.setup}</span>
              </div>
            ))}
          </div>
        </details>
      </section>

      <section className="space-y-3" aria-labelledby="maintenance-heading">
        <h2 id="maintenance-heading" className="text-lg font-semibold">
          Maintenance
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {MAINTENANCE.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className="group rounded-xl focus:outline-none">
                <Card className="flex h-full items-start gap-4 p-4 transition-colors group-hover:border-foreground/25 group-hover:bg-accent/35">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${item.accent}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{item.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                  <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="space-y-3" aria-labelledby="data-export-heading">
        <div>
          <h2 id="data-export-heading" className="text-lg font-semibold">
            Your data
          </h2>
          <p className="text-sm text-muted-foreground">
            Download a local copy of the data attached to this training profile.
          </p>
        </div>
        <Card className="flex flex-wrap items-center gap-3 p-4">
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
            disabled={Boolean(exporting)}
            onClick={() => void exportData("json")}
          >
            {exporting === "json" ? "Preparing…" : "Download my data (JSON)"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
            disabled={Boolean(exporting)}
            onClick={() => void exportData("csv")}
          >
            {exporting === "csv" ? "Preparing…" : "Download sessions (CSV)"}
          </button>
        </Card>
      </section>
    </div>
  );
}
