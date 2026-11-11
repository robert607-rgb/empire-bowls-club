# Empire member workflow updates

Goal: Complete the supplied member/admin/public-page changes and publish through the existing GitHub/Cloudflare connection.

Keep the existing React/Workers/D1/R2 stack and all club data. Use authenticated member IDs for greetings, bookings, availability and selection notifications. Reuse existing ownership and scoped permissions; add metadata without replacing legacy rows.

- [x] Remove passcodes from global notices and clear notices on tab changes.
- [x] Add a separate volunteer login under main admin; reject users without current grants and enforce scopes on server requests.
- [x] Return the authenticated member identity and active selection alerts, expiring after the London match date.
- [x] Place all member tools behind tabs, booking first and initially open; prefill trusted booking name, preserve own cancellation; use directory contact rows.
- [x] Add manual fixtures using the existing import API and automatic rink reservation.
- [x] Persist sign-up time and Home/Away metadata; use one-button availability with trusted identity, unique entries and capacity enforcement.
- [x] Show gallery covers first, then album photos on selection, keeping the lightbox.
- [x] Unify original and added sponsors in one admin/public list, with confirmed deletion.
- [x] Add persistent champions/year editor; use it on About and Honours. Tidy About into one clear section at a time.
- [x] Test affected server flows with isolated SQLite data, run all regression tests and Cloudflare build, publish with branch lease, wait for deployment success and verify live assets. Record browser/device limitations honestly.


Validation: 60 automated tests pass, including isolated SQLite round trips for authenticated identity, selection alerts, manual fixtures/results, sign-up metadata/expiry, sponsor deletion, champions and volunteer grant rejection. Cloudflare production build passes. Live unauthenticated protected endpoints reject access; About has no address aside and /honours redirects with HTTP 308. Main release 9edead34 deployed successfully. Public browser review is in progress; private member/admin browser interaction and physical phones/tablets have not been tested. Standalone TypeScript checking is affected by the existing mixed Cloudflare/DOM ambient types; production build and focused hook lint passed.
