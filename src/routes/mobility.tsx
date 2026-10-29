import { createFileRoute } from "@tanstack/react-router";
import { RecoveryArea } from "@/components/recovery-area";
export const Route = createFileRoute("/mobility")({
  validateSearch: (search: Record<string, unknown>): { session?: string } =>
    typeof search.session === "string" && /^[a-f0-9-]{36}$/i.test(search.session)
      ? { session: search.session }
      : {},
  head: () => ({ meta: [{ title: "Mobility & Recovery · Train & Track" }] }),
  component: MobilityPage,
});
function MobilityPage() {
  const { session } = Route.useSearch();
  return <RecoveryArea requestedSessionId={session} />;
}
