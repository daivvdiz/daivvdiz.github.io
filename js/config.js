// ============================================================
// Configuración de Supabase
// Supabase > Project Settings > API (o "Data API"):
//   - Project URL          -> SUPABASE_URL
//   - anon / public key    -> SUPABASE_ANON_KEY
// La clave "anon" está pensada para ir en el navegador: tus datos
// siguen protegidos por el inicio de sesión y las reglas RLS.
// NUNCA pongas aquí la "service_role" key.
//
// Mientras estén vacías, la app funciona en MODO DEMO con datos
// de ejemplo guardados solo en este navegador.
// ============================================================
export const SUPABASE_URL = "https://vvmcenpulpverfkiyliy.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_RuJpo6hzknn5cZP2z3S2LA_hs174hKY";

// Secciones de documentos (puedes añadir o quitar).
export const SECCIONES_DOCS = ["Universidad", "Personales", "Trabajo", "Salud", "Finanzas"];
