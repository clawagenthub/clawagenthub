export function getSourceBadgeColor(source: string): string {
  switch (source) {
    case 'custom': return 'bg-blue-100 text-blue-800'
    case 'skillsmp': return 'bg-purple-100 text-purple-800'
    case 'imported': return 'bg-green-100 text-green-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

export function parseTags(tagsJson: string | null): string[] {
  if (!tagsJson) return []
  try {
    return JSON.parse(tagsJson)
  } catch {
    return []
  }
}