# splitwise-JP — Roadtrip Europa 2026

Nuestra versión de Splitwise: PWA mobile-first para 4 personas. React + Vite +
TypeScript + Tailwind en el cliente, Supabase (Postgres + Realtime) como
backend, deploy en Vercel.

## Sitio publicado

- Aplicación: https://splitwise-jp.vercel.app/
- Proyecto de Vercel: https://vercel.com/pawis-dev/splitwise-jp
- El despliegue inicial se publicó como archivos estáticos compilados con
  `npm run build`, incluyendo `vercel.json`. No está conectado a GitHub:
  los cambios del repositorio no se publican automáticamente.
- Para actualizar este despliegue, compila con las variables de Supabase
  configuradas y publica el contenido de `dist/` junto con `vercel.json`
  en el mismo proyecto de Vercel.
- En Supabase, configura la URL del sitio y la URL de redirección de Auth
  como `https://splitwise-jp.vercel.app` para los enlaces mágicos.
  Verificado en el panel de Supabase: Site URL y Redirect URLs incluyen
  `https://splitwise-jp.vercel.app/`.

## Setup

### Acceso con Google

La versión pública usa Google como acceso principal. Google Cloud tiene el
proyecto `roadtrip-europa-2026`, cliente web y audiencia en producción.
Las credenciales están guardadas en Supabase y el panel muestra Google habilitado.
La actualización se publicó en Vercel el 3 de septiembre de 2026.

**Proveedor verificado:** `/auth/v1/settings` devuelve `external.google: true`
y `/auth/v1/authorize` redirige a `accounts.google.com` (HTTP 302).
El botón de la app publicada abre correctamente el selector de cuentas de Google.
La configuración de retorno apunta a Vercel. Queda por confirmar el acceso
completo de un integrante desde su celular.

1. Crear un proyecto de Google Cloud para Roadtrip Europa 2026 y configurar
   Google Auth Platform con los permisos básicos `openid`, `email` y `profile`.
2. Crear un cliente OAuth de tipo aplicación web. Origen autorizado:
   `https://splitwise-jp.vercel.app`. URI de redirección autorizada:
   `https://rzcclkrbdqbefecfldbs.supabase.co/auth/v1/callback`.
3. En Supabase → Authentication → Sign In / Providers → Google, guardar
   el Client ID y Client Secret y habilitar el proveedor. El secreto va solo
   en Supabase: nunca en Vite, Git ni los archivos publicados.
4. Conservar `https://splitwise-jp.vercel.app/` en Site URL y Redirect URLs.
   Los correos de Google deben coincidir con los miembros existentes; RLS
   continúa limitando el acceso al grupo.
5. Publicar el nuevo build en el proyecto existente de Vercel y verificar
   un inicio de sesión completo desde el celular.

1. **Supabase**: crea un proyecto gratis en [supabase.com](https://supabase.com).
   En el *SQL Editor* ejecuta, en orden:
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_server_updated_at.sql`
   - `supabase/seed.sql` (edita los nombres de los 4 miembros si quieres)
   - `supabase/migrations/0003_auth_rls.sql` — **antes de ejecutarla, edita
     los correos placeholder** con los correos reales de los 4 miembros
   - `supabase/migrations/0004_expense_details.sql`
   - `supabase/migrations/0005_huf_and_explicit_base.sql`
   - `supabase/migrations/0006_switch_group_to_mxn.sql` — convierte el historial de prueba confirmado a MXN con la tasa de referencia del 3 de septiembre de 2026.

   (O con la CLI: `supabase link --project-ref <ref> && supabase db push`.)

2. **Auth (magic links)**: en el dashboard, *Authentication → Sign In /
   Providers*, habilita **Email** (sin contraseña basta el enlace mágico). En
   *Authentication → URL Configuration* pon como *Site URL* tu dominio de
   Vercel y agrega `http://localhost:5173` a *Redirect URLs* para desarrollo.
   Solo los correos listados en `members` pueden usar la app (RLS).

3. **Variables de entorno**: copia `.env.example` a `.env.local` y pon la URL
   del proyecto y la *anon key* (Settings → API).

4. **Desarrollo local**:

   ```sh
   npm install
   npm run dev
   ```

5. **Deploy en Vercel**: importa el repo en [vercel.com](https://vercel.com)
   (framework: Vite, sin config extra — `vercel.json` ya trae el rewrite de
   SPA) y define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en
   *Project Settings → Environment Variables*.

## Comandos

| Comando             | Qué hace                        |
| ------------------- | ------------------------------- |
| `npm run dev`       | servidor de desarrollo          |
| `npm test`          | tests unitarios (Vitest)        |
| `npm run build`     | typecheck + build de producción |
| `npm run typecheck` | solo typecheck                  |

Las reglas de dinero, soft deletes y la arquitectura están documentadas en
[`CLAUDE.md`](./CLAUDE.md).

## Funciones principales

- Gastos iguales, por subconjunto o con montos exactos, en múltiples monedas.
- Pagos totales o parciales entre integrantes.
- Categorías, búsqueda, filtros y exportación CSV.
- Detalle del reparto y comprobantes fotográficos disponibles sin conexión.
- Autoría y bitácora de cambios por movimiento.

## Monedas y conversión a MXN

El grupo nuevo usa MXN para balances, totales y pagos entre integrantes. Se
pueden capturar gastos en MXN, EUR, CZK, CHF, HUF y USD. El formulario consulta
[Frankfurter v1 (BCE)](https://frankfurter.dev/v1/) con la moneda base del grupo,
conserva la tasa al guardar y permite editarla. La tasa de referencia puede
diferir de la del banco: para tarjetas se puede registrar directamente el cargo
en MXN. Si no hay conexión, usa la tasa guardada; si tampoco existe, requiere
una tasa manual y nunca inventa una.

Para un grupo existente, no basta con editar `groups.base_currency`: las tasas
congeladas y los pagos anteriores están denominados en EUR. La migración 0006
es transaccional e idempotente: convierte el historial de prueba confirmado
(incluso borrado) con 1 EUR = 19.7593 MXN, referencia del 2026-09-03. Conserva
los importes y repartos en moneda original; actualiza las tasas congeladas a
MXN y convierte los pagos anteriores a centavos mexicanos. Los gastos cuya
moneda original ya es MXN usan tasa 1. No usar esa tasa para migrar un historial
real sin antes acordar la fecha/tasa y revisar los cargos del banco. Sincronicen los cuatro dispositivos antes del cambio.
Las columnas `base_currency` de gastos/pagos impiden que una versión antigua
suba importes en EUR como si fueran MXN. Las cachés de tipos de cambio se separan
por moneda base. Hasta migrar el grupo, el cliente sigue calculando en EUR.

Si un dispositivo tiene cambios pendientes de antes de esa migración, el motor
los convierte una sola vez con la misma tasa 19.7593 (solo para este grupo),
conserva sus identificadores/repartos y reintenta enviarlos. La conversión de la
cola y la actualización de la base local son atómicas. Un error del servidor
se muestra en la banda de sincronización en lugar de quedar oculto.
