# START HERE — agent continuity file (read fully before doing anything)

> Purpose: a fresh agent can pick up exactly where the last session left off.
> Always cross-read in this order: `PROJECT_SPEC.md` (source of truth) → `CLAUDE.md`
> (working rules) → `docs/PROGRESS.md` (phase state) → `docs/DECISIONS.md` (D-numbers) →
> this file (tactical state). For UI work also `docs/DESIGN.md`.

---

## 1. What the project is

Bilingual (Arabic default / English) static-export Next.js showcase site for an
Egyptian fire-alarm company. GitHub Pages hosting + Supabase free tier backend.
No prices, no cart, no stock counts. Security = Supabase RLS only (never UI hiding).
Static export only: no API routes, no middleware, no SSR. One conventional commit
per phase; finish phase → verify → document → commit → **stop and report, wait for
user approval before the next phase.**

**Commits so far (git log):**

```
210b24a feat: bilingual public site with filters, search and product pages (Phase 2)
e80c69e chore: move local supabase ports to 560xx (D-022 netsh range shift)
4a1f7e5 feat: add Supabase schema, RLS, seed and types (Phase 1)
baf85f9 feat: scaffold Phase 0 static export with ar/en i18n
```

Current status: **Phase 3 (Admin core) code complete and machine-verified, NOT yet
verified end-to-end against Supabase, NOT documented, NOT committed.** Everything
below in §4–§6 is the live state.

---

## 2. Environment & quirks (verified this machine, win32/PowerShell)

- Repo: `C:\Users\Yossef\Desktop\Reach website` (git identity: `yossef-ibrahimm`).
- Node 24 / npm 11; Next.js 16.3.8 (Turbopack), next-intl 4.14.8, Tailwind v4,
  zod 4.6.5, react-hook-form 7.89, @hookform/resolvers 5.9, @dnd-kit 6.3/10.0.
- Local Supabase ports are **560xx** (D-022): api 56021, db 56022, shadow 56020,
  studio 56023, inbucket 56024, pooler 56029. `.env.local` →
  `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:56021`. Legacy demo JWT keys still work.
- Docker Desktop: `%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe`.
  Stack was UP at last check (`/auth/v1/health` → 200, studio → 200). If down:
  `npx supabase start`.
- DB URL for psql: `postgresql://postgres:postgres@127.0.0.1:56022/postgres`.
  **psql options must come BEFORE the connection string**; PowerShell has no `<`
  redirect → use `Get-Content supabase\tests\rls_verify.sql -Raw | psql -v ON_ERROR_STOP=1 "<conn>"`.
- `npm run build` fetches Supabase data **at build time** (D-029) → stack must run.
- Commands: `npm run dev | build | serve | lint | typecheck | format | format:check`.
  `npm run serve` = static server on `out/` (scripts/serve.mjs, port 4173).
- **Secrets**: never commit service_role. Get it ONLY from `npx supabase status
  --output json` (fields `service_role_key` / `anon_key`) for local REST tests.
  Scanning `out/` after build must only ever find the anon key (`role=anon`).

---

## 3. Phase 0–2: done (see docs/PROGRESS.md for full log)

- **Phase 0** ✅ `baf85f9` — static export, TS strict, Tailwind v4 tokens,
  next-intl without middleware, 3 root layouts ((site)/[locale], (admin) AR RTL
  noindex, (redirect) `/`→`/ar/`), bilingual 404, fonts, basePath, lint/format.
- **Phase 1** ✅ `4a1f7e5` — 4 migrations (functions, 11-table schema, 29 RLS
  policies, storage buckets `product-images`/`catalogs`/`site-assets`), seed.sql
  (17 categories, 8 brands, 7 spec defs, 65 products), `supabase/tests/rls_verify.sql`
  DoD suite (last result: **ALL RLS CHECKS PASSED**), generated
  `src/lib/supabase/database.types.ts`.
- **Phase 2** ✅ `210b24a` (+`e80c69e` port move) — full public site: layout/header/
  footer/WhatsApp, Home, products explorer (MiniSearch + `normalizeArabic`, facet
  filters, URL state), product pages, About, Contact, 404. 143→ pages SSG.

---

## 4. Phase 3 (current): what was BUILT (all uncommitted)

`git status` right now shows exactly the Phase 3 delta:

```
 M package-lock.json / package.json          # +zod, react-hook-form, @hookform/resolvers, @dnd-kit
 D src/app/(admin)/admin/page.tsx            # old dashboard; replaced by (protected)/ structure
 M src/app/(admin)/layout.tsx                # +NextIntlClientProvider(getMessages) +ToastProvider,
                                             #   dropped the fixed max-w-3xl wrapper (container now
                                             #   comes from the (protected) layout)
 M src/messages/ar.json                      # + full `admin` namespace (meta, guard, login, header,
                                             #   dashboard, products, form, duplicates) + errors.load/retry
                                             #   + fields.imagesCover, fields.selectPlaceholder,
                                             #   fields.cancelPending, fields.revertRemove, toasts.partialCreated
?? src/app/(admin)/admin/(protected)/        # AdminGuard layout + dashboard + products pages
?? src/app/(admin)/admin/login/              # login page (outside guard)
?? src/features/admin/**                     # ALL admin feature code (see inventory)
?? src/lib/supabase/browser.ts               # lazy anon-only client + isAdminClaim()
```

### Route structure (spec §7: `?id=` query params, never dynamic segments)

```
(admin)/layout.tsx                        → NextIntlClientProvider (admin ns) + ToastProvider + noindex
(admin)/admin/login/page.tsx              → outside guard; LoginForm
(admin)/admin/(protected)/layout.tsx      → AdminGuard + AdminHeader + skip link (common.skipToContent)
(admin)/admin/(protected)/page.tsx        → dashboard: real DB counts (total/drafts/missingTranslations/
                                            missingImages) + shortcuts (client component, fetches in effect)
(admin)/admin/(protected)/products/page.tsx          → <ProductsList/>
(admin)/admin/(protected)/products/new/page.tsx      → <ProductForm mode="new"/>
(admin)/admin/(protected)/products/edit/page.tsx     → Suspense + <ProductEditEntry/> (reads ?id=)
```

### File inventory (`src/features/admin/`)

| File | Role |
|---|---|
| `auth/login-form.tsx` | RHF+zod, `z.email()`, role check after password sign-in, forbidden/invalid states |
| `auth/admin-guard.tsx` | session + `app_metadata.role==='admin'` → else `router.replace('/admin/login')`. UX only, RLS is the boundary |
| `auth/admin-header.tsx` | brand, nav, view-site (basePath-aware), logout |
| `ui/toast.tsx` | `ToastProvider` / `useToast()` (success/error), mounted in `(admin)/layout` |
| `media/image-compress.ts` | `compressToWebp` (1600px main / 480px thumb), `validatePdf` (≤10MB), `ImageProcessError` |
| `media/storage.ts` | `thumbPathFor` (`x.webp`→`x.thumb.webp`), `publicUrl`, `storagePathFromPublicUrl`, `fileNameFromUrl`, `removeObjects` (chunked best-effort), bucket consts |
| `products/types.ts` | `ProductFormValues` (availability = union!), `ImageItem` (existing/new union), `ExistingImageItem` (+`sort_order`), `CatalogField`, row types |
| `products/use-lookups.ts` | fetch categories/brands/series/specs once → `{state, reload}` |
| `products/product-schema.ts` | `slugify`, `SLUG_PATTERN`, `buildProductSchema(messages, specsByCategory)` — spec rules live in **stable `superRefine`** (resolver never rebuilt on category change), `specsToJson`, `specsToFormValues`, `selectOptionValues` (options jsonb = `[{value,label_ar,label_en}]`) |
| `products/product-form.tsx` | shared Add/Edit. Outer: load product+lookups (loading/error-retry/notFound) + `key={attempt}` remount after edit-save. Inner: AR/EN tabs (both panels mounted, `hidden`), basics (controlled selects; slug auto-follows `name_en` until manually edited via `slugTouched` ref), dynamic specs (`key={categoryId}`), ImagesField + 2 CatalogFields, publish section, save/cancel, beforeunload dirty guard, submit-time `isSlugTaken` check, save orchestration + toasts/redirects. Exports `ProductNotFoundBox` |
| `products/product-edit-entry.tsx` | client, `useSearchParams()` → UUID validation → `ProductForm mode="edit"` (page wraps in `<Suspense>` for static export) |
| `products/save-product.ts` | `toProductPayload`, `isSlugTaken(slug, currentId)`, `saveProduct(...)` = row → images → catalogs with `SlugConflictError` / `PartialSaveError(productId)`; `syncImages` (delete removed rows→storage, update reorder/alts only when changed, upload new WebP+thumb then insert), `syncCatalog` |
| `products/duplicate-product.ts` | `duplicateProduct(id, {suffixAr, suffixEn})` — free `-copy` slug, copies storage files independently, draft+unfeatured, name suffixes from `admin.duplicates` |
| `products/delete-product.ts` | row first, storage best-effort → returns `{ok, storageFailed}` |
| `products/images-field.tsx` | multi-select → compress → staged Blobs (nothing uploaded until Save), dnd-kit reorder with handle, cover badge (index 0), per-image AR/EN alt inputs, object-URL revocation, existing vs new badge, remove/revert |
| `products/catalog-field.tsx` | per-language staged PDF: current file (download), pending file, removed state, cancel/revert |
| `products/products-list.tsx` | table: search (`normalizeArabic` over name_ar/name_en/slug), filters (category/brand/status/availability + missingTranslations + missingImages + clear), bulk publish/unpublish with selection, row actions Edit(link)/Duplicate/Publish-toggle/Delete(inline confirm), availability badge, relative dates, loading/error-retry/empty states |
| `products/duplicate-...` etc | see above |

Key behaviors decided while building (⚠ **not yet in DECISIONS.md — log as D-040…D-0xx**):

1. Admin strings live ONLY in `src/messages/ar.json` under a new top-level `admin`
   namespace (admin is Arabic-only per D-018) — `en.json` untouched; next-intl falls
   back to `ar` for non-`[locale]` routes. Shared `availability`/`system` namespaces
   are reused for their option labels.
2. Slug uniqueness checked at submit time: sync zod `SLUG_PATTERN` + async
   `isSlugTaken` → `setError('slug')` + focus; race caught by `SlugConflictError`.
3. Slug auto-follows `name_en` (`slugify`) until admin edits slug manually.
4. Spec-field validation rides inside one stable schema via `superRefine` keyed on
   `value.category_id` (no resolver rebuild when category changes).
5. Images/PDFs staged as Blobs in component state; Storage upload happens only on
   successful row write; duplicate copies storage files independently (not linked).
6. Category change rebuilds `specs` keeping only keys present in the new category.
7. Save-new → toast + redirect to `.../products/edit/?id=<newId>`; `PartialSaveError`
   (row created, media failed) → still redirect + error toast.
8. Edit-save success → `bootstrap()` reload + `attempt++` remount to resync baseline.
9. Lint workaround for `react-hooks/set-state-in-effect`: effects call loaders through
   a **nested declaration**: `useEffect(() => { async function initialLoad(){ await load(); } void initialLoad(); }, [load])`
   (same idiom as AdminGuard — tested, keeps the rule quiet; the direct
   `void load()` form is flagged even when all setStates are after `await`).
10. Image limits: main 1600px / thumb 480px WebP ≤5MB; PDF ≤10MB (bucket policy caps).

---

## 5. Phase 3: VERIFIED so far (exact commands + results)

- `npm run typecheck` → **0 errors** (after fixing: Props union destructure,
  `useLookups` import, `initial?.product ?? null`, availability union vs
  `zodResolver`, `ExistingImageItem.sort_order`).
- `npm run lint` → **0 problems** (after removing sync `setState('loading')` at top
  of loaders — initial state already `loading` — and the nested-effect pattern above;
  removed unused `AlertTriangle`).
- `npx prettier --write src/...` applied.
- `npm run build` (stack up) → **147 static pages** incl. all 6 admin routes:
  `/admin`, `/admin/login`, `/admin/products`, `/admin/products/edit`,
  `/admin/products/new`, `/` + SSG site pages.
- Static serve (temp server `C:\Users\Yossef\AppData\Local\Temp\opencode\serve-out.js`
  on **port 4173 — STILL RUNNING, kill it when done**: `Get-CimInstance Win32_Process |
  Where CommandLine -match 'serve-out' | ForEach-Object { Stop-Process -Id $_.ProcessId }`):
  `/admin/`, `/admin/login/`, `/admin/products/`, `/admin/products/new/`,
  `/admin/products/edit/?id=x` → all **200, RTL, noindex, skip-link present**.
- Secret scan of `out/` → only one JWT, payload `role=anon`, no `service_role` literal.

**NOT yet verified (this is the immediate work):** real login + write flows over
REST with an admin JWT, anon denial re-check, storage upload through the app's
buckets, and a fresh `rls_verify.sql` run (see §6.1).

---

## 6. THE PLAN

### 6.1 Phase 3 — finish verification, docs, commit (do this first, in order)

1. **Stack check**: `Invoke-WebRequest http://127.0.0.1:56021/auth/v1/health` — if
   down, `npx supabase start` (Docker must be running).
2. **Create a local admin user** (once; keep for all future sessions). Get the
   service key: `npx supabase status --output json` → `service_role_key`
   (⚠ never write it to a tracked file). Then:
   - `POST http://127.0.0.1:56021/auth/v1/admin/users` headers
     `apikey: <anon>`, `Authorization: Bearer <service_role>` body
     `{"email":"admin@local.test","password":"<strong>","email_confirm":true}`.
   - Promote: `update auth.users set raw_app_meta_data = raw_app_meta_data ||
     '{"role":"admin"}'::jsonb where email='admin@local.test';`
     (psql, same conn string as above).
3. **REST-level end-to-end matrix** (PowerShell `Invoke-RestMethod`, keep all keys
   out of the repo):
   - Login: `POST /auth/v1/token?grant_type=password` + `apikey: <anon>` + email/
     password → access token whose JWT payload contains
     `app_metadata.role=admin`.
   - Admin **read** products (`GET /rest/v1/products?select=id&limit=1` + Bearer
     admin token) → 200.
   - Admin **write**: `POST /rest/v1/products` minimal row (unique slug
     `phase3-smoke-test`, both names, `category_id` from seed, `is_published:false`)
     → 201; then PATCH it → 204; DELETE → 204 (cleanup).
   - **Anon write denied**: same POST with only `apikey: <anon>` → 401/403; anon
     UPDATE/DELETE of a seeded product → 0 rows affected (`.select()` count 0).
   - **Storage**: admin token `POST /storage/v1/object/product-images/<smoke>.webp`
     (any bytes, `x-upsert:false`) → 200/201, then DELETE the object; anon upload
     to same bucket → 403/401. (Optional but recommended — the app's save pipeline
     depends on these policies.)
   - Non-admin authenticated user (create a second user without the role) → write
     attempt denied by RLS.
4. **RLS suite**: `Get-Content supabase\tests\rls_verify.sql -Raw | psql -v
   ON_ERROR_STOP=1 "postgresql://postgres:postgres@127.0.0.1:56022/postgres"` →
   must print `ALL RLS CHECKS PASSED`.
5. **Serve `out/` again** (use `npm run serve` or the temp server) and eyeball:
   - `/admin/login/` shows Arabic form, `dir=rtl`, title from `admin.meta.*`.
   - Guard behavior can only be really tested in a browser — if no browser tool is
     available, state that limitation in the phase report instead of claiming it.
6. **Docs** (before commit):
   - `docs/PROGRESS.md`: flip phase 3 checkbox, set "Current phase" line, add a
     `### 2026-10-02 — Phase 3: Admin core ✅` log entry with Built / Verified /
     Decisions / Open questions (mirror the style of previous entries).
   - `docs/DECISIONS.md`: append the Phase 3 decisions as D-040+ bullets (start
     numbering after the current last = **D-039**) covering at least the 10 points
     listed at the end of §4 above (admin-namespace-only-in-ar.json, slug checks,
     superRefine spec validation, staged blobs, duplicate copies, category-change
     specs rebuild, save redirect/PartialSaveError, attempt remount, lint pattern,
     image/PDF limits).
   - `README.md`: update `> Status:` line to Phase 3; add a short "Local admin user"
     subsection under Local development (the commands from step 2, without any keys).
7. **Final DoD sweep**: `npm run format:check` (or `npm run format`), `npm run
   lint`, `npm run typecheck`, `npm run build`, secret scan
   (`Select-String -Path out\**\*.js,*.html -Pattern 'service_role'` → nothing;
   JWTs found must decode to `role=anon`).
8. **Commit exactly one conventional commit**, e.g.
   `feat: admin login, dashboard and product management (Phase 3)` — stage only the
   Phase 3 delta (see §4 `git status`), never `.env.local`/keys. Then **stop and
   report** (what was built, how verified, decisions, open questions) and wait for
   the user's approval before Phase 4.

### 6.2 Phase 4 — Admin extras (next after approval)

Spec §7 routes: `/admin/categories/`, `/admin/brands/`, `/admin/series/`,
`/admin/specs/` (lookup CRUD: name_ar/name_en (+ slug/icon/sort_order where the
schema has them), activation toggles, delete blocked/fallback when products still
reference), `/admin/settings/` (contact numbers E.164 rendered `dir="ltr"`, social
links, site texts — all bilingual), `/admin/certificates/` and `/admin/projects/`
(trust content; public site already hides these sections while tables are empty).
Reuse Phase 3 building blocks: `ToastProvider`, `useLookups`, `AdminHeader`, zod +
RHF, `admin.*` namespace in `ar.json` only, RLS-only writes, inline confirm for
destructive actions. Same DoD sweep → docs → single commit → stop for approval.

### 6.3 Phase 5 — Deploy

Edge Function `trigger-deploy` (spec §8), `.github/workflows/deploy.yml` (static
export → GitHub Pages), admin "Publish changes" button (build webhook — it is the
only non-static-runtime piece), weekly cron + external keep-alive (free tiers),
deployment docs. Remember GitHub Secrets carry ANON key/site URL only — no
service_role anywhere.

### 6.4 Phase 6 — SEO & polish

Sitemap/robots/hreflang/JSON-LD/OG, accessibility pass, performance pass
(Lighthouse ≥ 90 mobile on Home + Product page), empty/error states, final README.
Then project is done.

---

## 7. Hard rules recap (violating these fails the phase)

- Static export only; no server runtime/API routes/middleware; TS strict, no `any`,
  zod validation, generated Supabase types (`database.types.ts` regenerate, never
  hand-edit, it's Prettier-ignored).
- Security = RLS. Never expose `service_role` or GitHub tokens (client, repo, docs).
- Admin edit pages use `?id=` + `<Suspense>` for `useSearchParams` (static export).
- Every user-facing string in AR **and** EN (admin area is the documented exception:
  Arabic-only, see decision list §4.1) — use CSS logical properties (`ms-*`, `pe-*`,
  `text-start`), never `left/right`; phones E.164 + `dir="ltr"`.
- No prices/cart/stock counts in public data.
- Precedence: `PROJECT_SPEC.md` > `CLAUDE.md` > `docs/DESIGN.md` > `design-reference/`.
  Flag conflicts, never silently deviate. Log every decision in `docs/DECISIONS.md`.
