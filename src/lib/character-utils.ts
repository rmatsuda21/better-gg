interface CharacterNode {
  id?: string | null
  name?: string | null
}

export function buildCharacterMap(
  characters: Array<CharacterNode | null> | null | undefined,
): Map<number, string> {
  const map = new Map<number, string>()
  if (!characters) return map
  for (const c of characters) {
    if (c?.id && c.name) {
      map.set(Number(c.id), c.name)
    }
  }
  return map
}
