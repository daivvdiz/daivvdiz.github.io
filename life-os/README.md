# LIFE OS

Tu sistema operativo personal: diario, salud mental, metas, finanzas, carrera, físico, archivo de vida y analítica, conectados en una sola base de datos.

> "Tu vida es más que tu productividad."

- **Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · componentes estilo shadcn/ui · Recharts · React Hook Form + Zod · date-fns · Sonner · Lucide.
- **Backend:** el **mismo proyecto de Supabase** que usa Segundo Cerebro (Auth, Postgres con RLS, Storage).
- **Hosting:** Vercel (carpeta raíz `life-os/`). Segundo Cerebro sigue en GitHub Pages sin cambios.

## Puesta en marcha

### 1. Base de datos (una sola vez)
En **Supabase → SQL Editor → New query**, ejecuta en orden:

1. [`supabase/migrations/20261114000100_life_os_schema.sql`](../supabase/migrations/20261114000100_life_os_schema.sql): crea las tablas de LIFE OS con RLS y el bucket privado `life-os`.
2. [`supabase/migrations/20261114000200_import_segundo_cerebro.sql`](../supabase/migrations/20261114000200_import_segundo_cerebro.sql): crea el importador y la copia automática del Atajo.

Ninguna de las dos modifica ni borra `registros`, `ajustes` ni el bucket `documentos`. Se pueden ejecutar más de una vez.

### 2. Vercel
1. [vercel.com/signup](https://vercel.com/signup) → plan **Hobby** → **Continue with GitHub**.
2. **Add New… → Project → Import** `daivvdiz.github.io`.
3. **Root Directory → Edit → `life-os`**. Framework: Next.js (automático).
4. **Environment Variables** (los mismos valores de `js/config.js`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. **Deploy**.
6. En Supabase → **Authentication → URL Configuration**, agrega la URL de Vercel en *Site URL* y en *Redirect URLs*.

Nunca pongas la clave `service_role` en Vercel ni en el código: LIFE OS no la necesita.

### 3. Traer tus datos
Entra con el mismo correo y contraseña de Segundo Cerebro → **Ajustes → Importar desde Segundo Cerebro**. Verás una vista previa por categoría antes de copiar.

| Segundo Cerebro | LIFE OS |
| --- | --- |
| `apartamento` + total en `ajustes` | Pasivo "Apartamento" + cada pago como gasto (Vivienda) enlazado |
| `trabajo` con salario | Carrera · cargos y salarios |
| `trabajo` sin salario | Logros del día |
| `skills` | Skills + historial de niveles |
| `fitness` / `gimnasio` (kg) | Entrenamiento de fuerza del día + ejercicio con peso, series y reps |
| `fitness` (tiempo) | Entrenamiento con duración |
| Otras categorías | "Sin clasificar", para decidir después |
| Bucket `documentos` | Se queda donde está; se mostrará en Archivo de vida |

Cada copia guarda `legacy_registro_id`: repetir la importación no duplica nada. Lo que registres después con el **Atajo de iOS** se copia solo (trigger en `registros`); si la copia falla, el registro original se guarda igual.

## Desarrollo local
```bash
cd life-os
cp .env.example .env.local   # y completa los valores
npm install
npm run dev                  # http://localhost:3000
npm run typecheck && npm run build
```

## Estructura
```
app/(app)/<módulo>/     Páginas protegidas (sidebar + sesión verificada en servidor)
app/login               Inicio de sesión (registro público cerrado)
app/api/export          Exportación JSON de todos tus datos
components/ui           Primitivas de interfaz (botón, tarjeta, diálogo, confirmación…)
components/<módulo>     Componentes por módulo
lib/<módulo>            Consultas, Server Actions y esquemas Zod
lib/supabase            Clientes de Supabase (servidor, middleware)
middleware.ts           Redirige a /login si no hay sesión
```

## Estado por fases
- [x] Fase 0: respaldo JSON en Segundo Cerebro
- [x] Fase 1: base, diseño, login, sidebar, esquema completo con RLS, Resumen, Ajustes, importador
- [ ] Fase 2: calendario y entrada diaria (ánimo, energía, estrés, sueño, gratitud, recuerdo, logros)
- [ ] Fase 3: salud mental y archivo de vida (incluye Documentos)
- [ ] Fase 4: metas y hábitos
- [ ] Fase 5: finanzas y carrera
- [ ] Fase 6: físico
- [ ] Fase 7: analítica de vida
- [ ] Fase 8: pulido, accesibilidad, seguridad, CSV, pruebas, eliminación de cuenta

Los módulos de fases futuras muestran una página que lo indica, sin controles falsos.
