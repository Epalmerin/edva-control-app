# Meal reminders

Administrators configure each active promoter at `/admin/meal-reminders`, also linked from Employees. Schedules start disabled. Time, ISO weekdays (Monday=1), timezone and pause state are independent of existing work schedules. The initial unsaved form suggests the employee's break time, work timezone and non-rest days; saving is explicit.

Promoters expand **Avisos de comida** above their pages, authorize notifications on each device, and can send a test or deactivate that device. iOS/iPadOS 16.4+ requires opening the Home Screen web app. Android uses a browser supporting Web Push. Activation is never requested automatically. Logout unsubscribes the current browser subscription.

The manifest and square icons permit Home Screen installation. `/meal-sw.js` only handles push and notification clicks; it does not cache application pages, credentials or attendance data. Clicking a notification opens `/promoter/attendance`; it never records attendance automatically.

## Scheduling and delivery

Supabase Cron runs `private.tick_meal_reminders()` every minute. It invokes the `meal-reminders` edge function only when eligible subscriptions exist. A candidate must be an active promoter, have an enabled schedule/subscription, match the local weekday and scheduled time (within a 10-minute catch-up window), have an ENTRY on that local calendar date, and have no BREAK_OUT, BREAK_IN or EXIT on that date. Eligibility is checked again immediately before sending.

An atomic unique claim per employee, local date and endpoint prevents overlapping jobs from sending the same reminder twice. Each claim receives at most one send attempt; ambiguous network failures are not automatically retried, avoiding duplicate notifications. Failed or abandoned attempts appear in the administrator's seven-day count. Provider 404/410 responses disable obsolete subscriptions. Fifty claims per invocation and eight concurrent requests bound execution time. The provider TTL is 60 seconds so disconnected phones do not receive hours-old meal alerts. Device connectivity, permissions, browser support and Do Not Disturb still affect display.

The administrator sees registered device counts and the last provider-accepted send, not proof of delivery or reading. A manual test is limited to one per endpoint per minute and does not consume that day's meal claim.

## Security and deployment

The additive schema and scheduler references are `docs/database/meal-reminders.sql` and `docs/database/meal-reminder-runtime.sql`. Settings use RLS: active ADMIN writes, active PROMOTOR reads only their own. Push endpoints and encryption keys are readable/writable only by their active owner. Administrators receive aggregate device status, never endpoints or keys. Internal delivery/test tables allow only the service role. The public status RPC uses SECURITY INVOKER; its private helper validates the active ADMIN role before aggregating.

`supabase/functions/meal-reminders/index.js` pins Supabase JS 2.106.0 and web-push 3.6.7. Runtime keys and the scheduler token are generated once and held in Supabase Vault, never source code or NEXT_PUBLIC variables. The edge gateway JWT check is disabled because each route implements authentication: dispatch/health use a constant-time scheduler-secret check; public-key/test verify the caller's Auth token and active PROMOTOR profile. Test requests can target only the caller's registered endpoint. CORS permits only the production app origins. Outbound destinations are limited to known HTTPS push providers, without credentials, custom ports or redirects.

Deploy the schema, scheduler and edge function before the frontend. `private.tick_meal_reminders(true)` performs an authenticated live signing/encryption health check without sending a notification. Read its request result in `net._http_response`. Do not print Vault contents or subscriptions while diagnosing.

## Verification

- `node --test scripts/test-meal-push.cjs`: endpoint restrictions, cron authentication, provider response handling and worker boundaries.
- `PGLITE_MODULE=/path/to/@electric-sql/pglite node scripts/test-meal-reminders.mjs`: isolated PostgreSQL fixtures for RLS, timezone/day boundaries, attendance suppression, catch-up expiry, daily claim dedupe, manual-test throttling and admin aggregates. Uses an external test installation; no test dependency is added to the production bundle.
- TypeScript and the Vercel preview build must pass before promotion.
- Final device acceptance: configure a promoter, activate notifications on their phone, and press **Enviar prueba**. Do not subscribe or send test messages to real promoters without their own activation.
