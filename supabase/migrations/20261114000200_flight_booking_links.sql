-- Optional link to the airline's OWN booking page for a flight route.
-- The app opens this link in a new tab; it never sells tickets or scrapes prices.
alter table public.flight_routes add column if not exists booking_url text
  check (booking_url is null or booking_url ~* '^https://');
