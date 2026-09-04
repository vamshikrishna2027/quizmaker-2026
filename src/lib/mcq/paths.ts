export { MCQS_PATH } from "@/lib/auth/paths";

export const MCQS_API_PATH = "/api/mcqs";
export const MCQS_NEW_PATH = "/mcqs/new";

export function mcqEditPath(id: string): string {
  return `/mcqs/${id}/edit`;
}

export function mcqPreviewPath(id: string): string {
  return `/mcqs/${id}/preview`;
}

export function mcqApiPath(id?: string): string {
  return id ? `${MCQS_API_PATH}/${id}` : MCQS_API_PATH;
}

export function mcqPreviewApiPath(id: string): string {
  return `${MCQS_API_PATH}/${id}/preview`;
}

export function mcqAttemptsApiPath(id: string): string {
  return `${MCQS_API_PATH}/${id}/attempts`;
}
