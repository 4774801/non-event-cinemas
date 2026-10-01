REAL FIRST FILM / STATS FIX

1. Run cleanup-demo-history.sql ONCE in Supabase > SQL Editor.
   It preserves the screening whose title contains "El Dorado" and deletes all
   OTHER rows currently marked as past. The old schema seeded three fake past
   films, which is why Stats showed 4 films.

2. Replace these files in GitHub:
   - app.js
   - index.html
   - stats.js
   - stats.html
   - chaos2000.css

You do not need to replace admin files for this fix.

CHANGES
- Road to El Dorado will be the only Past Film.
- Main page no longer has the old launch-date archive filter.
- Attendance leaderboard shows EVERY attendee, not just three.
- Equal attendance counts share the same rank.
- Adds:
  * Total ratings
  * Community average
  * Most loyal attendee(s)
  * Easiest to please (highest personal average)
  * Hardest to please (lowest personal average)
  * Most prolific rater
  * Most divisive film
  * Existing screenings/watch time/best film/best curator/biggest crowd remain.
- Stats page no longer says there are no completed screenings.
