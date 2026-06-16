# splitwise-JP — Roadtrip Europa 2026

Nuestra versión de Splitwise: PWA mobile-first para 4 personas. React + Vite +
TypeScript + Tailwind en el cliente, Supabase (Postgres + Realtime) como
backend, deploy en Vercel.

## Setup

1. **Supabase**: crea un proyecto gratis en [supabase.com](https://supabase.com).
   En el *SQL Editor* ejecuta, en orden:
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_server_updated_at.sql`
   - `supabase/seed.sql` (edita los nombres de los 4 miembros si quieres)
   - `supabase/migrations/0003_auth_rls.sql` — **antes de ejecutarla, edita
     los correos placeholder** con los correos reales de los 4 miembros

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
