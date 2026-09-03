export const ACTOR_STORAGE_KEY = "quizmaker.actorUserId";

export function storeActorUserId(userId: string): void {
  sessionStorage.setItem(ACTOR_STORAGE_KEY, userId);
}

export function clearActorUserId(): void {
  sessionStorage.removeItem(ACTOR_STORAGE_KEY);
}

export function readActorUserId(): string | null {
  return sessionStorage.getItem(ACTOR_STORAGE_KEY);
}
