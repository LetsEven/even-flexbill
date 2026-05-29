const CACHE_PREFIX = "even_validation_";

function getCacheKey(
  restaurantId: number,
  branchNumber: number,
  tableNumber: number,
  service?: string,
): string {
  const base = `${CACHE_PREFIX}${restaurantId}_${branchNumber}_${tableNumber}`;
  return service ? `${base}_${service}` : base;
}

export function getValidationFromCache(
  restaurantId: number,
  branchNumber: number,
  tableNumber: number,
  service?: string,
): { valid: boolean; error?: string } | null {
  if (typeof window === "undefined") return null;

  try {
    const key = getCacheKey(restaurantId, branchNumber, tableNumber, service);
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

export function setValidationCache(
  restaurantId: number,
  branchNumber: number,
  tableNumber: number,
  result: { valid: boolean; error?: string },
  service?: string,
): void {
  if (typeof window === "undefined") return;

  try {
    const key = getCacheKey(restaurantId, branchNumber, tableNumber, service);
    sessionStorage.setItem(key, JSON.stringify(result));
  } catch {
    // sessionStorage might be unavailable (private mode, full storage)
  }
}

export function invalidateValidationCache(
  restaurantId: number,
  branchNumber: number,
  tableNumber: number,
  service?: string,
): void {
  if (typeof window === "undefined") return;

  try {
    const key = getCacheKey(restaurantId, branchNumber, tableNumber, service);
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function clearAllValidationCache(): void {
  if (typeof window === "undefined") return;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // ignore
  }
}
