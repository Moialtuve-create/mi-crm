/**
 * PUNTO DE INTEGRACIÓN — proveedor de autenticación (Linear MOI-80 / MOI-55).
 *
 * El diseño exige aislar el auth tras esta interfaz para poder sustituir el
 * mock del MVP por Convex Auth / Supabase / API propia sin tocar las pantallas.
 * En el prototipo la sesión se persiste en localStorage ("vibecrm_session").
 */

export type Rol = "propietaria" | "comercial";

export interface UsuarioSesion {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

export interface Session {
  user: UsuarioSesion;
}

export interface AuthProvider {
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;
  updateProfile(datos: { nombre: string; email: string }): Promise<UsuarioSesion>;
  changePassword(actual: string, nueva: string): Promise<void>;
}

export const ROL_LABELS: Record<Rol, string> = {
  propietaria: "Dueña",
  comercial: "Atiende y vende",
};
