import { useCallback, useEffect, useState } from "react";

import { workoutFavoritesKey } from "@/lib/workout-local-state";

function readFavorites(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      : [];
  } catch {
    return [];
  }
}

export function useFavoriteExercises() {
  const [favoriteExercises, setFavoriteExercises] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const storageKey = workoutFavoritesKey();
    setFavoriteExercises(readFavorites(window.localStorage.getItem(storageKey)));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(workoutFavoritesKey(), JSON.stringify(favoriteExercises));
  }, [favoriteExercises, loaded]);

  const toggleFavoriteExercise = useCallback((exerciseName: string) => {
    const normalized = exerciseName.trim().toLowerCase();
    if (!normalized) return;
    setFavoriteExercises((current) =>
      current.some((item) => item.toLowerCase() === normalized)
        ? current.filter((item) => item.toLowerCase() !== normalized)
        : [...current, exerciseName],
    );
  }, []);

  return { favoriteExercises, toggleFavoriteExercise };
}
