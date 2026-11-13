# Vercel: “Couldn't find any pages or app directory”

## What this project is

This is a **Next.js App Router application using React and TypeScript**. Its backend uses Node.js and PostgreSQL through Drizzle. It is not a standalone HTML page, PHP project or WordPress theme.

The real homepage is `src/app/page.tsx`; the layout is `src/app/layout.tsx`. Next.js supports this `src/app` structure without creating a separate `pages` folder.

## What the screenshot error means

Vercel installed Next.js, but the build's selected directory did not contain the application folder. The screenshot alone does not identify which of these happened:

- `src/` or `src/app/` was omitted from the GitHub upload;
- folders were flattened during upload;
- Root Directory points to the wrong folder;
- a folder was renamed with different casing or excluded from deployment.

Yellow npm/deprecation warnings are not the fatal error shown in that screenshot. Creating an empty `pages`/`app` folder, adding `.gitkeep`, or replacing the homepage with a dummy page does not restore the real website.

## Exact repair steps

1. Open the GitHub repository and the exact branch connected to Vercel.
2. Confirm that both `src/app/page.tsx` and `src/app/layout.tsx` can be opened there and contain the real code. Local files in this builder do not automatically prove those files exist in your GitHub upload.
3. If missing, re-upload/export the full updated project, preserving folders. Include `src/`, `public/`, `scripts/`, `drizzle/`, package.json, package-lock.json, next.config.ts, tsconfig.json, postcss.config.mjs and vercel.json. Do not upload only a ZIP or just the top-level configuration files. Do not upload `.env`, node_modules, `.next`, artifacts or credentials.
4. Vercel → **Go to Project → Settings → Build and Deployment → Root Directory**:
   - If package.json and src are directly at the repository root, use the default repository root (leave the custom field empty).
   - If they are inside a real subfolder, choose that subfolder.
   - Do not select `src` or `src/app`. Do not enter the repository's name unless it is also an actual nested folder.
5. Framework Preset: **Next.js**.
6. Use Node.js **22.x**. Build/Install settings can come from the included vercel.json; turn off conflicting manual overrides. Keep Output Directory automatic for Next.js. Do not set it to `public`, `out`, `dist`, `src` or `src/app`.
7. Save settings, commit/push the complete source, then redeploy that latest commit. Clearing a build cache alone cannot recreate missing source files.

The new source preflight check lists missing files before the Next.js build. It does not modify your Vercel account's Root Directory or upload files to GitHub for you.

## Production database settings (separate from the folder error)

This is a full-stack site: fixing the folder error does not create a hosted database. In Vercel's **Production** environment, configure:

| Field | Value / purpose |
| --- | --- |
| DATABASE_URL | The connection string of your hosted PostgreSQL database. Never the local preview's localhost/127.0.0.1 address. Use the provider's required TLS settings. |
| HANSA_PUBLIC_SITE | `true` for the production website. |
| HANSA_OWNER_PASSWORD | Your own private 12–128 character editor password for the first production setup. It is not printed or committed to source. |
| DIRECT_DATABASE_URL | Optional direct/unpooled connection URL for migrations if your database provider requires it. It must connect to the same database as DATABASE_URL. |

A Vercel Marketplace PostgreSQL integration (for example Neon or Supabase) can supply hosted connection details. Confirm the application receives the exact `DATABASE_URL` variable, even if the integration exposes differently named variables. Enable Vercel's System Environment Variables so `VERCEL_ENV` identifies the production deployment.

The included `vercel.json` runs a production build helper. For a Production deployment, it checks source files and database settings, applies the recorded migrations, securely creates the first owner, verifies the runtime database, then builds Next.js. It preserves an existing owner password. It refuses to silently adopt an existing app database without migration history.

Preview builds must not migrate a shared production database. Use a separate initialized database for a Vercel Preview environment, or deploy the production branch for the first public launch. Keep production secrets scoped appropriately.

## After it deploys

- Open the actual Production URL in an incognito window. Do not assume a protected preview/deployment URL is publicly accessible.
- Visit `/studio` and use the editor password set for that production database.
- Test one JPG/PNG upload, Server verified confirmation and a reload.
- A new database does not automatically contain files or settings from this chat preview. Re-upload originals, restore/relink a content backup, or use an authorised full-database migration.
- Vercel plan, execution-duration, database/storage and bandwidth limits still apply. The app's 2 GB limit is not a hosting guarantee. Uploads use small parts and completed files stream, but large media still needs enough database capacity and transfer time. YouTube/Vimeo links or appropriate object storage are preferable for very large media.

Official references:
- https://vercel.com/docs/deployments/configure-a-build
- https://vercel.com/docs/environment-variables/system-environment-variables
- https://vercel.com/docs/functions/limitations

This configuration has not been applied to your Vercel/GitHub account by the assistant. Upload the updated project and change the account settings yourself, or have your authorised hosting helper do those one-time steps.
