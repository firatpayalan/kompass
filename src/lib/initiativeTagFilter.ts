export function initiativeMatchesTagFilter(
  initiative: { tags: Array<{ id: number }> },
  selectedTagIds: number[],
): boolean {
  if (selectedTagIds.length === 0) {
    return true;
  }
  const owned = new Set(initiative.tags.map((tag) => tag.id));
  return selectedTagIds.every((id) => owned.has(id));
}
