export function exerciseCategories(exercise: {
  workoutType: string;
  additionalWorkoutTypes?: string[];
}): string[] {
  const categories = [exercise.workoutType, ...(exercise.additionalWorkoutTypes ?? [])];
  return categories
    .map((name) => name.trim())
    .filter(
      (name, index, all) =>
        Boolean(name) &&
        all.findIndex((other) => other.toLowerCase() === name.toLowerCase()) === index,
    );
}

export function exerciseMatchesCategory(
  exercise: Parameters<typeof exerciseCategories>[0],
  category: string,
) {
  return (
    !category ||
    exerciseCategories(exercise).some(
      (name) => name.toLowerCase() === category.trim().toLowerCase(),
    )
  );
}
