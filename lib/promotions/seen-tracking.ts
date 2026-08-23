function storageKey(userId: string) {
  return `gitfit:lastSeenPromotion:${userId}`;
}

export function getLastSeenPromotion(userId: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

export function setLastSeenPromotion(userId: string, timestamp = new Date().toISOString()) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), timestamp);
  } catch {
    // Private browsing or storage restrictions should not prevent FitBot from opening.
  }
}
