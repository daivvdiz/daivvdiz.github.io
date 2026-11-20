# LIFE OS

Tu sistema operativo personal: diario, salud mental, metas, finanzas, carrera, físico, archivo de vida y analítica, conectados en una sola base de datos.

> "Tu vida es más que tu productividad."

- **Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · componentes estilo shadcn/ui · Recharts · React Hook Form + Zod · date-fns · Sonner · Lucide.
- **Backend:** el **mismo proyecto de Supabase** que usa Segundo Cerebro (Auth, Postgres con RLS, Storage).
- **Hosting:** Vercel (carpeta raíz `life-os/`). Segundo Cerebro sigue en GitHub Pages sin cambios.
- **Idioma:** la interfaz está en inglés (textos fijos, fechas y números en formato en-US; dinero en COP). Lo que tú escribes o importaste (categorías, emociones, notas, nombres) se muestra tal cual, sin traducir.

## Puesta en marcha

### 1. Base de datos (una sola vez)
En **Supabase → SQL Editor → New query**, ejecuta en orden:

1. [`supabase/migrations/20261114000100_life_os_schema.sql`](../supabase/migrations/20261114000100_life_os_schema.sql): crea las tablas de LIFE OS con RLS y el bucket privado `life-os`.
2. [`supabase/migrations/20261114000200_import_segundo_cerebro.sql`](../supabase/migrations/20261114000200_import_segundo_cerebro.sql): crea el importador y la copia automática del Atajo.
3. [`supabase/migrations/20261116000100_study_exams.sql`](../supabase/migrations/20261116000100_study_exams.sql): crea la tabla de simulacros de estudio (sección Entrenamiento → Estudio).
4. [`supabase/migrations/20261117000100_recurring_events.sql`](../supabase/migrations/20261117000100_recurring_events.sql): agrega columnas a `calendar_events` para los eventos que se repiten (diario, semanal, mensual, anual o personalizado). Tus eventos actuales quedan sin repetición.
5. [`supabase/migrations/20261120000100_market.sql`](../supabase/migrations/20261120000100_market.sql): crea las tablas de **Market** (mercados, productos y precios) y las funciones que guardan un mercado completo y unen productos repetidos.

Ninguna modifica ni borra `registros`, `ajustes` ni el bucket `documentos`; la 4 solo agrega columnas y la 5 solo agrega tablas nuevas. Se pueden ejecutar más de una vez.

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
| Bucket `documentos` | Se queda donde está; se ve y se usa en Archivo de vida → Documentos |

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
- [x] Fase 2: calendario (mes, semana, día, filtros), eventos y entrada diaria (ánimo, energía, estrés, sueño, diario, gratitud, recuerdo, logros, etiquetas, conexiones, adjuntos)
- [x] Fase 3a: salud mental (tendencias, calendario de ánimo, sueño, distribución, promedios, relaciones exploratorias, emociones y factores de estrés, diario emocional, estrategias)
- [x] Fase 3b: archivo de vida (línea de tiempo con búsqueda, galería, categorías, capítulos, un día como hoy, balance de vida histórico y los Documentos de siempre)
- [x] Fase 4: metas (hitos, estados, avance, vínculos con diario, logros y eventos) y hábitos (frecuencias, registro semanal, cumplimiento sin rachas)
- [x] Fase 5a: finanzas (movimientos, categorías, presupuesto mensual, metas de ahorro, activos, deudas con el apartamento importado, patrimonio neto)
- [x] Market: mercados de la canasta familiar (productos, cantidad, precio unitario) y tabla de precios promedio, último precio y cambio por producto
- [x] Fase 5b: carrera (cargos y evolución salarial, aplicaciones con entrevistas, skills con historial de nivel, proyectos de portafolio, aprendizaje)
- [x] Fase 6: entrenamiento físico y de estudio (simulacros con puntaje, nivel, preguntas, correctas, incorrectas y tiempo; entrenamientos con ejercicios, progresión por ejercicio, medidas corporales, nutrición opcional, frecuencia, volumen, tipos de actividad y sueño)
- [x] Fase 7: analítica de vida (bienestar, físico, hábitos, metas, finanzas, carrera y actividad por periodo; comparaciones entre periodos y correlaciones exploratorias)
- [x] Interfaz traducida al inglés (solo textos fijos)
- [x] Eventos que se repiten en el calendario (solo este, este y los siguientes, o todos)
- [ ] Fase 8: pulido, accesibilidad, seguridad, CSV, pruebas, eliminación de cuenta

Los módulos de fases futuras muestran una página que lo indica, sin controles falsos.
