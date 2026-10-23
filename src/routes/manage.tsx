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

import { APP_BUILD_LABEL } from "@/lib/build-info";
import { Card } from "@/components/ui/card";
import { BLOCK_HEIGHT_OPTIONS } from "@/lib/position-measurements";
import { downloadPersonalData } from "@/lib/supabase-export.browser";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/manage")({
  head: () => ({
    meta: [
      { title: "Settings · Train & Track" },
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
    | "/plan"
    | "/library"
    | "/methods"
    | "/rotation"
    | "/goals"
    | "/locations"
    | "/programmes"
    | "/data-quality";
  icon: typeof BookOpen;
};

const TRAINING_SETUP: ManageLink[] = [
  {
    title: "My programme",
    description: "See your current plan, progress and next session.",
    to: "/plan",
    icon: Dumbbell,
  },
  {
    title: "Programme library",
    description: "Browse other plans or start a different programme.",
    to: "/programmes",
    icon: Layers3,
  },
];

const OPTIONAL_FEATURES: ManageLink[] = [
  {
    title: "Goals",
    description: "Track a goal alongside your programme when it is useful.",
    to: "/goals",
    icon: Target,
  },
  {
    title: "Daily Rotation",
    description: "Choose small practices to remind yourself about on Today.",
    to: "/rotation",
    icon: Repeat2,
  },
];

const ADVANCED_SETTINGS: ManageLink[] = [
  {
    title: "Training Locations",
    description: "Manage training places and the equipment available at each one.",
    to: "/locations",
    icon: MapPin,
  },
  {
    title: "Exercise Library",
    description: "Movements, tracking types, availability and training locations.",
    to: "/library",
    icon: BookOpen,
  },
  {
    title: "Training Methods",
    description: "Control system and custom methods used while planning and logging.",
    to: "/methods",
    icon: Layers3,
  },
  {
    title: "Data Quality",
    description: "Review historical ambiguity, provenance and calculation safety.",
    to: "/data-quality",
    icon: DatabaseZap,
  },
];

function SettingsPage() {
  const [exporting, setExporting] = useState<"json" | "csv" | null>(null);
  const exportData = async (format: "json" | "csv") => {
    setExporting(format);
    try {
      await downloadPersonalData(format);
      toast.success(format === "json" ? "Profile backup downloaded" : "CSV export downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The export could not be created.");
    } finally {
      setExporting(null);
    }
  };
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="border-b border-border pb-5">
        <h1 className="page-title">Settings</h1>
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
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/50 text-muted-foreground">
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

      <details className="rounded-xl border border-border bg-card/40 p-4">
        <summary className="cursor-pointer text-base font-semibold">Optional extras</summary>
        <p className="mt-2 text-sm text-muted-foreground">
          Keep these available without making them part of every workout.
        </p>
        <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          {OPTIONAL_FEATURES.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className="group rounded-xl focus:outline-none">
                <Card className="flex h-full items-start gap-4 p-4 transition-colors group-hover:border-foreground/25 group-hover:bg-accent/35">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/50 text-muted-foreground">
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
      </details>

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

      <details className="rounded-xl border border-border bg-card/40 p-4">
        <summary className="cursor-pointer text-base font-semibold">Advanced settings</summary>
        <p className="mt-2 text-sm text-muted-foreground">
          Movement definitions, training methods and data checks used by the planner and logger.
        </p>
        <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          {ADVANCED_SETTINGS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className="group rounded-xl focus:outline-none">
                <Card className="flex h-full items-start gap-4 p-4 transition-colors group-hover:border-foreground/25 group-hover:bg-accent/35">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/50 text-muted-foreground">
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
      </details>
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
          <p className="w-full text-xs text-muted-foreground">
            JSON includes your programme targets, coaching, mobility setup, training history and
            their catalogue references. CSV contains session rows for analysis. Sign-in, access
            permissions and unsynced device work are separate.
          </p>
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
            disabled={Boolean(exporting)}
            onClick={() => void exportData("json")}
          >
            {exporting === "json" ? "Preparing…" : "Download profile backup (JSON)"}
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
      <p className="text-xs text-muted-foreground">Build {APP_BUILD_LABEL}</p>
    </div>
  );
}
