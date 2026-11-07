# Segundo Cerebro

Mi panel personal tipo app (PWA) para PC e iPhone: progreso del pago del apartamento, evolución laboral, skills, fitness y documentos personales por sección.

- **Web:** GitHub Pages (este repo). El código es público, **los datos no**.
- **Datos, inicio de sesión y documentos:** [Supabase](https://supabase.com) (plan gratis), protegidos con reglas por usuario (RLS) y un bucket privado.
- **Registro rápido desde el iPhone:** un Atajo de iOS que llama a una función de Supabase.

Mientras `js/config.js` esté vacío, la app funciona en **modo demo** con datos de ejemplo guardados solo en tu navegador.

## Estructura

```
index.html               App (una sola página)
css/app.css              Estilos (claro/oscuro automático)
js/config.js             ← aquí van tu URL y clave anon de Supabase
js/data.js               Lectura/escritura (Supabase o demo)
js/app.js                Vistas: Inicio, Apartamento, Trabajo, Skills, Fitness, Documentos
js/charts.js             Gráficas SVG sin librerías
sw.js, manifest.webmanifest, icons/   Para instalarla como app
supabase/schema.sql      Tablas, seguridad y bucket de documentos
supabase/functions/registrar/index.ts   Endpoint para el Atajo
supabase/migraciones/    Cambios opcionales de datos
```

## Puesta en marcha (≈15 minutos)

### 1. Crear el proyecto en Supabase
1. Entra en [supabase.com](https://supabase.com) → **New project** (plan Free). Guarda la contraseña de la base de datos.
2. Ve a **SQL Editor → New query**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**.

### 2. Crear tu usuario (y cerrar el registro a otros)
1. **Authentication → Users → Add user → Create new user**: tu correo y una contraseña. Marca *Auto Confirm User*.
2. **Authentication → Sign In / Providers**: desactiva **Allow new users to sign up**. Así nadie más puede crear cuenta.
3. Copia tu **User UID** (lo necesitas en el paso 4).

### 3. Conectar la web
1. **Project Settings → API** (o *Data API*): copia **Project URL** y la clave **anon / public**.
2. Pégalas en [`js/config.js`](js/config.js). La clave *anon* puede ser pública; **nunca** pongas la *service_role*.
3. En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**.
4. Abre `https://daivvdiz.github.io` e inicia sesión.

### 4. Función para el Atajo
1. **Edge Functions → Deploy a new function → Via Editor**. Nombre: `registrar`. Pega [`supabase/functions/registrar/index.ts`](supabase/functions/registrar/index.ts) y despliega.
2. En los ajustes de la función, desactiva **Verify JWT** (el Atajo usa su propio token).
3. **Edge Functions → Secrets**, añade:
   - `ATAJO_TOKEN`: una contraseña larga inventada (ej. generada con un gestor de contraseñas).
   - `OWNER_USER_ID`: tu User UID del paso 2.
4. Tu URL será `https://<tu-proyecto>.supabase.co/functions/v1/registrar`.

### 5. Instalar en el iPhone
Abre la web en **Safari → Compartir → Añadir a pantalla de inicio**. Se abre a pantalla completa como una app.

## Atajo de iOS para registrar

Ejemplo "Registrar fitness" con peso (en la app Atajos):

1. **Pedir entrada** (Texto): "¿Ejercicio?" → variable *Ejercicio*
2. **Pedir entrada** (Número): "¿Peso (kg)?" → *Peso*
3. **Pedir entrada** (Número): "¿Repeticiones?" → *Reps*
4. **Obtener contenido de URL**
   - URL: `https://<tu-proyecto>.supabase.co/functions/v1/registrar`
   - Método: **POST**
   - Encabezados: `Authorization` = `Bearer TU_ATAJO_TOKEN`
   - Cuerpo de la solicitud: **JSON**
     - `categoria` (Texto) = `fitness`
     - `titulo` (Texto) = *Ejercicio*
     - `valor` (Número) = *Peso*
     - `unidad` (Texto) = `kg`
     - `extra` (Diccionario) → `reps` (Número) = *Reps*, `series` (Número) = 4
5. **Mostrar notificación**: *Contenido de la URL*

Otros ejemplos de cuerpo JSON:

| Qué registras | JSON |
|---|---|
| Fitness por tiempo (hh:mm:ss) | `{"categoria":"fitness","titulo":"Running","valor":"00:32:15"}` |
| Pago del apartamento | `{"categoria":"apartamento","titulo":"Cuota mensual","valor":1500000}` |
| Nivel de una skill (1-10) | `{"categoria":"skills","titulo":"Python","valor":7}` |
| Hito laboral | `{"categoria":"trabajo","titulo":"Analista Senior","valor":5200000,"nota":"Ascenso"}` |

Campos opcionales: `fecha` (`AAAA-MM-DD`, por defecto hoy) y `nota`. Puedes usar categorías nuevas (ej. `lectura`) y ya quedan guardadas.

En **Fitness**, la unidad es `kg` (peso, 1 decimal) o tiempo: si `valor` lleva `:` (ej. `"00:32:15"`) se guarda como tiempo automáticamente. Se sigue aceptando `"gimnasio"` como categoría, y esos registros aparecen en Fitness.

Un único Atajo con **Elegir del menú** (Fitness / Apartamento / Skills / Trabajo) puede cubrir todo.

## Privacidad
- GitHub Pages es público: en este repo solo hay código, nunca datos ni documentos.
- Cada fila y cada archivo solo los puede leer tu usuario (políticas RLS en `schema.sql`).
- Los documentos se abren con enlaces firmados que caducan en 5 minutos.
