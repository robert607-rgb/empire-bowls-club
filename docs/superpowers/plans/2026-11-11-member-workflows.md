# Empire member workflow updates

Goal: Complete the supplied member/admin/public-page changes and publish through the existing GitHub/Cloudflare connection.

Keep the existing React/Workers/D1/R2 stack and all club data. Use authenticated member IDs for greetings, bookings, availability and selection notifications. Reuse existing ownership and scoped permissions; add metadata without replacing legacy rows.

- [ ] Remove passcodes from global notices and clear notices on tab changes.
- [ ] Add a separate volunteer login under main admin; reject users without current grants and enforce scopes on server requests.
- [ ] Return the authenticated member identity and active selection alerts, expiring after the London match date.
- [ ] Place all member tools behind tabs, booking first and initially open; prefill trusted booking name, preserve own cancellation; use directory contact rows.
- [ ] Add manual fixtures using the existing import API and automatic rink reservation.
- [ ] Persist sign-up time and Home/Away metadata; use one-button availability with trusted identity, unique entries and capacity enforcement.
- [ ] Show gallery covers first, then album photos on selection, keeping the lightbox.
- [ ] Unify original and added sponsors in one admin/public list, with confirmed deletion.
- [ ] Add persistent champions/year editor; use it on About and Honours. Tidy About into one clear section at a time.
- [ ] Test affected server flows with isolated SQLite data, run all regression tests and Cloudflare build, publish with branch lease, wait for deployment success and verify live assets. Record browser/device limitations honestly.
