import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function MovementPicker({
  value,
  exercises,
  availableExerciseNames,
  selectedLocationName,
  favoriteNames,
  recentNames,
  onChange,
}: {
  value: string;
  exercises: { name: string; workoutType: string; equipment?: string; quickLog?: boolean }[];
  availableExerciseNames: Set<string>;
  selectedLocationName?: string;
  favoriteNames: string[];
  recentNames: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const favoriteSet = new Set(favoriteNames.map((name) => name.toLowerCase()));
  const recentSet = new Set(recentNames.map((name) => name.toLowerCase()));
  const normalizedQuery = query.trim().toLowerCase();
  const nameMatches = (exercise: (typeof exercises)[number]) =>
    !normalizedQuery || exercise.name.toLowerCase().includes(normalizedQuery);
  const availableExercises = exercises.filter(
    (exercise) => availableExerciseNames.has(exercise.name.toLowerCase()) && nameMatches(exercise),
  );
  const unavailableExercises = normalizedQuery
    ? exercises.filter(
        (exercise) =>
          !availableExerciseNames.has(exercise.name.toLowerCase()) && nameMatches(exercise),
      )
    : [];
  const quickExercises = availableExercises.filter((exercise) => exercise.quickLog);
  const quickSet = new Set(quickExercises.map((exercise) => exercise.name.toLowerCase()));
  const favoriteExercises = availableExercises.filter(
    (exercise) =>
      favoriteSet.has(exercise.name.toLowerCase()) && !quickSet.has(exercise.name.toLowerCase()),
  );
  const recentExercises = availableExercises.filter(
    (exercise) =>
      recentSet.has(exercise.name.toLowerCase()) &&
      !favoriteSet.has(exercise.name.toLowerCase()) &&
      !quickSet.has(exercise.name.toLowerCase()),
  );
  const otherExercises = availableExercises.filter(
    (exercise) =>
      !favoriteSet.has(exercise.name.toLowerCase()) &&
      !recentSet.has(exercise.name.toLowerCase()) &&
      !quickSet.has(exercise.name.toLowerCase()),
  );
  const groups = [
    { label: "Quick logging", exercises: quickExercises },
    { label: "Favourites", exercises: favoriteExercises },
    { label: "Recent", exercises: recentExercises },
    { label: "All movements", exercises: otherExercises },
    {
      label: selectedLocationName
        ? `Not available at ${selectedLocationName}`
        : "Not available at this location",
      exercises: unavailableExercises,
      unavailable: true,
    },
  ].filter((group) => group.exercises.length > 0);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={value ? "truncate" : "truncate text-muted-foreground"}>
            {value || "Search movements"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,420px)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search movement name..."
          />
          <CommandList>
            <CommandEmpty>No movement name matches.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.exercises.map((exercise) => (
                  <CommandItem
                    key={exercise.name}
                    value={exercise.name}
                    disabled={group.unavailable}
                    onSelect={() => {
                      onChange(exercise.name);
                      setOpen(false);
                    }}
                  >
                    <Check className={value === exercise.name ? "opacity-100" : "opacity-0"} />
                    <span className="min-w-0 flex-1 truncate">{exercise.name}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {group.unavailable ? "Equipment not assigned" : exercise.workoutType}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
