export type UserRole = "member" | "admin";
export interface User { id: string; name: string; email: string; city: string; role: UserRole; createdAt: string; }
export type ApplicationType = "model" | "viewer" | "course" | "collaboration";
export type ApplicationStatus = "submitted" | "reviewing" | "accepted" | "rejected" | "withdrawn" | "waiting";
export interface Photo { id: string; url: string; name: string; size: number; type: string; }
export interface ApplicationHistoryEntry { status: ApplicationStatus; at: string; note: string; }
export interface Application {
  id: string; reference: string; userId: string; type: ApplicationType; title: string;
  targetId: string | null; modelId: string | null; status: ApplicationStatus;
  name: string; email: string; phone: string; city: string; height: number | null; age: number | null;
  measurements: string; description: string; projectType: string; projectDate: string;
  createdAt: string; updatedAt: string; adminNote: string; photos: Photo[]; history?: ApplicationHistoryEntry[];
}
export interface ApiError { error: string; fieldErrors?: Record<string, string>; }
export interface RegisterInput { name: string; email: string; password: string; city: string; consent: boolean; }
export interface LoginInput { email: string; password: string; }
export interface ProfileInput { name: string; city: string; }
export interface PasswordInput { currentPassword: string; newPassword: string; }
export interface ApplicationInput {
  type: ApplicationType; targetId: string | null; modelId: string | null;
  name: string; email: string; phone: string; city: string; height: number | null; age: number | null;
  measurements: string; description: string; projectType: string; projectDate: string;
  consent: boolean; idempotencyKey: string;
}
