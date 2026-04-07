// Local storage key for draft auto-save
const DRAFT_STORAGE_KEY = 'ticket-draft'

// Get workspace-specific storage key
export function getStorageKey(workspaceId: string | null) {
  return workspaceId ? `${DRAFT_STORAGE_KEY}-${workspaceId}` : DRAFT_STORAGE_KEY
}

// Load draft from localStorage
export function loadDraftFromStorage(workspaceId: string | null) {
  if (typeof window === 'undefined') return null
  try {
    const key = getStorageKey(workspaceId)
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

// Save draft to localStorage
export function saveDraftToStorage(workspaceId: string | null, data: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  try {
    const key = getStorageKey(workspaceId)
    localStorage.setItem(key, JSON.stringify({ ...data, savedAt: Date.now() }))
  } catch {
    // Ignore storage errors
  }
}

// Clear draft from localStorage
export function clearDraftFromStorage(workspaceId: string | null) {
  if (typeof window === 'undefined') return
  try {
    const key = getStorageKey(workspaceId)
    localStorage.removeItem(key)
  } catch {
    // Ignore storage errors
  }
}
