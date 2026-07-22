import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronRight,
  Dumbbell,
  Layers3,
  MapPin,
  Repeat2,
  Settings2,
  SlidersHorizontal,
  Target,
  UserRoundCog,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/manage")({
  head: () => ({
    meta: [
      { title: "Manage · Training Tracker" },
      {
        name: "description",
        content:
          "Manage the exercise library, training methods, programme templates, daily rotation, goals and locations.",
      },
    ],
  }),
  component: ManagePage,
});

type ManageLink = {
  title: string;
  description: string;
  to: "/library" | "/methods" | "/rotation" | "/goals" | "/locations" | "/programmes";
  icon: typeof BookOpen;
  accent: string;
};

type PlannedItem = {
  title: string;
  description: string;
  icon: typeof BookOpen;
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

const PLANNED: PlannedItem[] = [
  {
    title: "Preferences",
    description: "Units, week start, defaults and recommendation behaviour.",
    icon: SlidersHorizontal,
  },
  {
    title: "People & Access",
    description: "Managed people, app access and coaching relationships.",
    icon: UserRoundCog,
  },
];

function ManagePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="border-b border-border pb-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-amber-300">
          <Settings2 className="h-4 w-4" /> Training administration
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Manage</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Shape how your training system works. Everyday logging, planning and review stay in the
          main navigation.
        </p>
      </header>

      <section className="space-y-3" aria-labelledby="training-setup-heading">
        <div>
          <h2 id="training-setup-heading" className="text-lg font-semibold">
            Training setup
          </h2>
          <p className="text-sm text-muted-foreground">
            The libraries and rules used across Today, Plan and Log.
          </p>
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

      <section className="space-y-3" aria-labelledby="coming-next-heading">
        <div>
          <h2 id="coming-next-heading" className="text-lg font-semibold">
            Coming next
          </h2>
          <p className="text-sm text-muted-foreground">
            Reserved homes for the next administration features as they become useful.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {PLANNED.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.title}
                className="flex items-start gap-4 border-dashed p-4 opacity-70"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.title}</span>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      Planned
                    </Badge>
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
