export function extractHashtags(content: string | null | undefined): string[] {
  if (!content) return [];

  const matches = content.match(/#(\w+)/g);

  if (!matches) return [];

  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}
