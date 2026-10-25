import { useQuery } from "@tanstack/react-query";
import { listTrainingRestDaysClient } from "@/lib/supabase-rest-days.browser";

export function useRestDays() {
  return useQuery({
    queryKey: ["training-rest-days"],
    queryFn: listTrainingRestDaysClient,
    staleTime: 30_000,
  });
}
