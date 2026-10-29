import type { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import type { MobilityDrill, MobilityRun } from "./mobility-practice";
import type { getLibraryClient } from "./supabase-log.browser";
import { startRecoveryClient } from "./supabase-recovery.browser";

// Keep existing callers and links compatible without touching the lifting draft.
export async function launchMobilityPractice(
  run: MobilityRun,
  _drills: MobilityDrill[],
  _library: Awaited<ReturnType<typeof getLibraryClient>>,
  navigate: ReturnType<typeof useNavigate>,
) {
  try {
    const session = await startRecoveryClient(run.id, "legacy", true);
    await navigate({ to: "/mobility", search: { session: session.id } });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not open the practice.");
  }
}
