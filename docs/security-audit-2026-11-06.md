# MA3 Navigator security review — 2026-11-06

This is a source and dependency review of the repository, not a penetration test or a certification of a deployed service. The checked-out repo has no custom server/API; authentication, database and object storage are delegated to Supabase. Live Supabase project settings and hosting response headers must still be checked after deployment.

## Part 1 — requested security checklist

| # | Status | Finding / change |
|---|---|---|
| 1. Secrets | Already OK | Client uses only the Supabase URL and public anon key. No service-role key or common cloud/API credential pattern was found in tracked files or the 8 commits reachable from this checkout. Service-role keys are used only by local import scripts. |
| 2. Environment files | Fixed | `.gitignore` now ignores `.env*` while allowing the committed `.env.example`; the example documents public frontend values and warns against `VITE_*` secrets. |
| 3. Admin routes | Not applicable | There is no admin route or admin dashboard. Catalogue imports are trusted local scripts. A database trigger and insert policy now prevent client-side self-assignment of `profiles.role`, including `admin`. |
| 4. Authentication | Fixed | Supabase Auth owns OAuth/guest sessions; Google OAuth now explicitly uses PKCE, auto-refresh and `sessionStorage` so sessions end with the tab. Browser tokens remain readable by app JavaScript; HttpOnly cookies would require a server-side session/BFF. |
| 5. Access control / IDOR | Fixed | Reviewed migration RLS policies for owner-owned profile, basket, driver, request and submission data; public reads are limited to intended catalog/map content. Added a database-side role escalation block and made stop-demand counts require administrator-verified driver and vehicle records with current licence, insurance and roadworthiness dates. Deployed policies must match these migrations. |
| 6. Server-side input validation | Already OK | There is no custom API accepting arbitrary form submissions. Persisted inputs use Postgres checks, unique/foreign-key constraints, RLS and RPC route/stop/POI existence checks; PostgREST calls are parameterized. Browser-only demo forms are not trusted for real transactions. |
| 7. XSS / CSP | Fixed | Replaced the map marker's `innerHTML` with `textContent` and style properties. Added CSP, `object-src 'none'`, `base-uri 'self'`, and `frame-ancestors 'none'` in Netlify/Cloudflare Pages `_headers` and Vercel headers. Inline styles are allowed because the React UI uses them; inline scripts and `unsafe-eval` are not allowed. |
| 8. Rate limiting | Not applicable | There are no custom login/signup/reset endpoints. Supabase Auth supplies those endpoints. Configure its production rate limits and CAPTCHA/anti-abuse controls in the project dashboard; no app-side limit can replace server enforcement. |
| 9. API endpoints | Already OK | The app has no own API routes. Supabase table writes use RLS; mutating RPCs require authenticated users and validate referenced records. Production UI now shows generic backend failure messages instead of raw errors. |
| 10. CORS | Not applicable | This static app defines no CORS middleware. Supabase and the selected host control cross-origin behavior. Set exact production site and OAuth redirect URLs in Supabase; do not add wildcard OAuth redirects. |
| 11. Security headers | Fixed | Added HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and CSP rules for the documented static hosts. Confirm the actual deployment sends them. Replace the Supabase wildcard source in CSP with the project’s exact host before production. |
| 12. Debug mode / logs | Fixed | Build mode is production by default; runtime console diagnostics are now development-only. Error boundary and user notifications no longer display stack or backend error details. |
| 13. Dependencies | Fixed | `npm audit fix` plus major updates for Vite, its React plugin and MapLibre removed the reported 9 advisories (including one critical). Final `npm audit` reports 0 vulnerabilities. Production-only audit also reports 0. |
| 14. Unused packages | Already OK | Reviewed direct dependencies against source/config imports; each listed package is used by the app or build. None were removed. |
| 15. Exposed files / source maps | Already OK | Build output is `dist`; Vite does not emit source maps by default, and `.git`, `.env*`, `node_modules` and `dist` are not intended publish roots. Netlify/Vercel should publish only `dist`, never the repository root. |
| 16. Database / SQL injection | Fixed | Supabase queries use PostgREST filters and RPC parameters, not concatenated SQL. RLS and constraints are defined in migrations; the profile role escalation issue is closed in `20261106_security_profile_role.sql`. |
| 17. Password storage | Not applicable | The app has no password form or password database. Google OAuth and anonymous Supabase Auth are used; Supabase manages credentials and password hashing if password auth is enabled later. |
| 18. Git history | Already OK (scope-limited) | Scanned all 8 commits currently reachable locally for common GitHub, Google, AWS, Slack, private-key and Stripe secret patterns; none matched. This is not GitHub secret scanning and may miss unfamiliar formats. |
| 19. OWASP Top 10 | Fixed (source review) | Reviewed access control, auth, injection, insecure design, configuration, components, logging and SSRF-relevant paths. The critical app finding was client-editable role escalation; fixed at the database layer. A live test against production Supabase/hosting is still needed. |
| 20. Verification | Fixed | Ran full `npm audit` (0 vulnerabilities), production-only audit (0), and `npm run build` successfully. No end-to-end or live database security test was run; see manual checks below. |

### Scope limits to keep in mind

- The role guard migration has not been applied to a live Supabase project from this workspace. Apply it after the existing migrations, then attempt a direct authenticated `profiles.role='admin'` update and confirm the database rejects it.
- Hosting headers were checked in configuration files, not on a deployed domain. CSP's `*.supabase.co` entry is a setup placeholder: change both header configs to the exact project host and add any approved image/CDN hosts explicitly.
- Supabase Auth/CORS/redirect/rate-limit settings and OAuth provider secrets are managed outside the repository and were not visible to this audit.
- No anonymous penetration test, authenticated IDOR test matrix, SQL policy simulation, browser CSP report, or GitHub-hosted secret scanning result was available.
- No key was identified that should be rotated based on this scan. If GitHub secret scanning, provider logs or account owners identify any credential, revoke it at its issuer and replace it; deleting a file or commit is not enough.

## Part 2 — relevant UX/UI changes

| # | Status | Finding / change |
|---|---|---|
| 1. Color psychology | Already OK | The app uses red/amber/green semantic tokens; destructive map cancellation/stop actions use red and primary actions use the route/page accent. |
| 2. Long forms | Already OK | There are no production account/checkout forms. Onboarding is already split into three clear slides; driver readiness is a short checklist. |
| 3. Large dropdowns | Already OK | Route, stop, place, product and game discovery use searchable inputs. No country selector exists. |
| 4. Input formats | Already OK | Date/time controls use native date/time inputs where present; location and route inputs use examples/placeholders. No phone-based account form exists. |
| 5. Button text | Already OK | Primary actions use specific verbs such as “Share pickup”, “Start”, “Save” and “Stop location preview”. |
| 6. Spacing | Already OK | Related controls use compact gaps and larger card/section margins. No global spacing redesign was needed for this audit. |
| 7. Status/progress | Fixed | Production error screens/messages now show a clear next action without exposing internals. Onboarding's final action reads “Launch Ma3” and shows a short launch transition. |
| 8. Navigation labels | Already OK | Main navigation uses short labels: Ma3, Ndai, Drive, Fly, Home, Market, Explore and Mirth. |

## Manual production checklist

1. In Supabase SQL Editor, apply `20261106_security_profile_role.sql` after the existing migrations. Confirm the `profiles` role trigger and RLS policy exist, and that non-verified users cannot call the stop-demand RPC.
2. In Supabase Auth settings, set the exact deployed Site URL and OAuth callback/redirect allowlist. Remove preview and wildcard redirect URLs you do not use.
3. Set production Auth rate limits and CAPTCHA/anti-bot controls; enable only the identity providers required for launch.
4. Replace `*.supabase.co` in both CSP configs with your exact project host. Add only the specific approved asset hosts needed by your retailer/map content.
5. Deploy to Netlify/Cloudflare Pages or Vercel and inspect the actual response headers on `/` and a nested route. Confirm CSP allows maps, OAuth return flow, fonts and Supabase calls without console violations.
6. Configure `.env.local` locally and production environment variables in the host dashboard. `VITE_SUPABASE_URL` and the anon key are public client values; never set the service-role key as a `VITE_*` variable. Keep the service key only in a trusted admin/import environment.
7. Test guest and Google sign-in, page reload/session expiry, sign-out, and a second-user direct API attempt to read/edit another user's profile, basket, photo, waiting marker and vote. Test that an ordinary account cannot read stop-demand counts and an admin-verified matatu driver with current documents can.
8. In Supabase, attempt to update your own profile role to `admin`; it must fail. Check storage bucket privacy and per-user folder access from two accounts.
9. Enable GitHub secret scanning/push protection for the repository and review its Security tab. If any historical credential is flagged, rotate it at the service that issued it.
10. Confirm backups, MFA for Supabase/GitHub/hosting accounts, production domain HTTPS, error reporting without personal data, and a recovery owner.
