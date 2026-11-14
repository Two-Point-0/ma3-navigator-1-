# Fly: free and legal ways to get flight and SGR information

Plain summary. Always check each service's current terms.

| Need | Option | Cost | Notes |
|---|---|---|---|
| Flight timetables and prices | Amadeus for Developers (Self-Service) | Free test tier, paid for production | Needs sign-up and keys. Do the calls from a Supabase Edge Function, never from the browser. |
| Live aircraft positions | OpenSky Network | Free for light use | Positions only, not prices or bookings. |
| Airline schedules | AviationStack | Small free tier | Free tier is limited and sometimes delayed. |
| Booking | Deep links to the airline or Google Flights | Free | This is what the app does. The app sells nothing. |
| SGR (Madaraka Express) | No public booking API | Free | Show the timetable you have sourced and open the official Kenya Railways booking page. Do not scrape or log in on behalf of users. |

Recommendation: keep the current approach (your own `flight_routes` and `sgr_*` tables plus deep links). Add Amadeus later only if you want live prices, behind an Edge Function with a cache so you never exceed free limits.
