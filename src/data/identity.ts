const STORAGE_KEY = 'roadtrip.currentMemberId'

export function getCurrentMemberId(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setCurrentMemberId(memberId: string): void {
  localStorage.setItem(STORAGE_KEY, memberId)
}

export function clearCurrentMemberId(): void {
  localStorage.removeItem(STORAGE_KEY)
}
