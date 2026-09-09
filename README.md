# Non Event Cinemas

A deliberately over-serious home cinema website for movie nights with friends.

## What works

- Upcoming screening programme
- Name/initial-only sign-in
- RSVP: going / maybe / can't make it
- Film recommendation board
- Upvote recommendations
- 1–5 star ratings for past screenings
- Responsive mobile layout
- Real poster URLs supported
- Zero AI-generated artwork

## Open it now

Open `index.html` in a browser.

With no database credentials it runs in **demo mode** using browser localStorage. That means you can try every interaction immediately, but each device has its own private data.

## Make it shared for your friends

### 1. Create a free Supabase project
Go to Supabase and make a project.

### 2. Create the database
Open **SQL Editor** in Supabase and run the full contents of `supabase-schema.sql`.

### 3. Add your public project credentials
In Supabase go to **Project Settings → API** and copy:
- Project URL
- anon/public key

Paste them into `config.js`:

```js
window.NON_EVENT_CONFIG = {
  SUPABASE_URL: "https://YOURPROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_ANON_KEY"
};
```

The anon key is designed to be used in browser apps. Do not put the Supabase service-role key here.

### 4. Add actual screenings
For the first version, the simplest admin workflow is:
**Supabase → Table Editor → screenings**

Add/edit rows there. Set `is_past` to `true` after a movie night so it moves into the rating archive.

## Posters

No generated images are used anywhere.

Each screening has a `poster_url` field. Paste a URL for existing film artwork that you have the right to display/use. If the field is blank, the site uses a purely typographic title card instead of fabricated artwork.

Recommendations also accept an optional poster URL.

## Deploy before buying a domain

### Vercel
1. Create a GitHub repository and upload this folder.
2. Import the repository into Vercel.
3. Framework preset: **Other**.
4. Deploy.
5. Vercel gives you a free temporary `*.vercel.app` URL.

You can connect a custom domain later without changing the website.

### Netlify
You can also drag this folder directly into Netlify Drop for a quick temporary URL.

## A note on the intentionally lightweight login

A name/initial is stored in the browser. This is not security; it is just identity for a trusted friend group.

The included Supabase RLS policies intentionally allow public read/write access for RSVPs, recommendations and ratings because there is no real authentication. Do not use this setup for sensitive or private data.

If the site later needs actual accounts, admin controls, invite-only access or deletion/moderation, upgrade it to Supabase Auth.


## Automatic film posters

The site automatically tries to find **existing film artwork**. It uses OMDb when a key is configured, then falls back to Wikipedia's public API with no key required.

An OMDb key is optional but improves poster matching. If you want one, put it in `config.js`:

```js
window.NON_EVENT_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  OMDB_API_KEY: "YOUR_OMDB_KEY"
};
```

When a screening or recommendation does not already have a `poster_url`, the site looks up the title (and year where available), caches the result in the browser, and uses the returned real poster. If no poster is found, it falls back to the typographic Non Event card.

No AI-generated artwork is used.

## Stats page

Open `stats.html` for:
- Top 3 attendees and attendance rate
- Total completed screenings
- Total watch time
- Highest-rated film
- Best curator — highest average rating across the films they curated
- Biggest crowd
- A ranked list of every film watched


### Curators

Each screening can have a `curator` value (for example `KJ`, `MG`, or `BT`). The Stats page's **Best curator** record averages the audience rating of each film curated by that person. Add/edit the curator in Supabase's `screenings` table.


### Broken poster protection

Poster URLs are validated before they are used. If a source blocks hotlinking, times out, or returns a broken image, Non Event Cinemas automatically falls back to the typographic film card instead of showing a broken-image icon.

For the most reliable long-term setup, store poster files yourself (for example in Supabase Storage) rather than relying permanently on third-party hotlinked image URLs.


## Admin page

Open `admin.html`.

It lets you:
- confirm a recommended film for the next screening
- change the screening date/time
- set runtime/year/curator/poster
- mark a screening as watched
- create the next default screening date

The default cadence is every second Thursday starting **1 October 2026**. Press **Create next fortnightly date** to add the next date (+14 days).

Voting closes automatically **48 hours before the next screening**. The public recommendation form and vote buttons stop accepting votes after that cutoff.

### Important security note

The current project still uses intentionally lightweight public Supabase access because your friends do not have real accounts. That means `admin.html` is an admin interface for convenience, not a secure private backend. Before publishing the site widely, the next upgrade should be proper Supabase Auth/admin-only write permissions.


## Recommendation rounds

Recommendations now persist across screenings.

At each screening:
1. Voting closes automatically 48 hours before the screening.
2. In `admin.html`, confirm one recommendation as the film.
3. The selected film is removed from the recommendation pool.
4. All remaining recommendations carry forward to the next round.
5. Their vote totals reset to zero.
6. Per-user votes are cleared so everyone can vote again in the next round.

This prevents old votes from permanently dominating while preserving good suggestions that were not selected.


## Cancelling or changing dates

The admin page now supports fully manual scheduling.

- You can set the next screening to **any date and time**.
- The fortnightly Thursday schedule is only a convenience button.
- Use **Cancel screening** to cancel a date without deleting it.
- Cancelled screenings remain visible in Admin and can be reinstated later.
- Cancelled screenings do not appear on the public upcoming programme.
- Cancelled screenings are ignored when choosing the next voting cutoff or confirming a film.


## Public deployment security

Before publishing:
1. Run the latest `supabase-schema.sql`.
2. In Supabase Authentication, create one admin user with your email and a strong password.
3. The public site still uses initials for RSVPs/ratings/recommendations.
4. `admin.html` now requires a real Supabase authenticated session.
5. Anonymous visitors can read screenings but cannot create/update/delete them.

## Vercel

This folder is ready for Vercel. `vercel.json` enables clean URLs.


## Visual theme

The live-ready build uses a late-1990s Australian entertainment-site inspired visual style:
navy/teal gradients, cream backgrounds, beveled controls, monospaced labels and period-style system typography.
It does not use AI-generated artwork.


## Latest skin

This build uses an early-2000s web aesthetic:
- silver/blue glossy gradients
- rounded portal-style panels
- Tahoma/Verdana/Trebuchet system fonts
- an Ulverston Hoad hero image shown as a proper visible card
- a cleaned transparent version of the host line-drawing logo


## Removing the old demo past films

This build no longer seeds fake past films.

If your existing Supabase project still shows the old demo archive entries, remove them from:
- Supabase → Table Editor → `screenings`
- delete the rows where `is_past = true`

After that, the homepage will show the **Coming Soon** placeholder until you mark a real screening as watched.


## First screening placeholder

The first screening is intentionally shown as **You decide** until a film is selected.
The public card shows the date and links directly to the recommendation poll.

Older Supabase projects that still contain the original demo row
`The Nice Guys` on 1 October 2026 are automatically treated as undecided by the public site.
Once you replace that title in Admin with the real selected film, the normal poster/RSVP card appears.
