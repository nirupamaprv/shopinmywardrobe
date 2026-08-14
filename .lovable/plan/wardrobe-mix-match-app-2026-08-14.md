# Wardrobe Mix & Match App

A personal styling app: photograph your tops and bottoms, get daily outfit suggestions in a polished Ann Taylor / White House Black Market editorial style, rate them, log what you actually wore, and let the app learn what you love and flag what you never touch.

## Backend (Lovable Cloud)

Photos and wear history must persist, so the app uses Lovable Cloud (database, image storage, and your private login) — no external accounts needed.

- Sign in with email/password so your closet is private to you.
- Photo upload from camera roll or camera, stored securely.

## Core sections

**1. Closet**
- Two sets: Tops (shirts/blouses/tops) and Bottoms (pants/jeans/skirts).
- Add a piece: photo, name, primary color (picked from a palette), optional pattern/neutral flag, season tag.
- Status per piece: Active, Seasonal, Special, Sell, Unloved.

**2. Today**
- 4–5 outfit matches generated daily.
- Rules applied: skip Seasonal/Special/Sell pieces; avoid colors worn in the past 3 days; favor pieces not worn recently; never re-surface a piece or pairing you disliked.
- Each match: Like, Dislike, and "I wore this" (with optional date).
- "Log what I actually wore" lets you build any pairing yourself, even outside the suggestions.

**3. Decide**
- Any piece unworn 45+ days lands here.
- Mark as Sell (ditch), Seasonal (keep but hidden from matches until you add it back — with an "Add back to rotation" button), or Special (occasion-only, only shown when you explicitly ask via a "Show special pieces" toggle).

**4. Unloved**
- Any piece disliked on 7+ different days with zero likes.
- Once a month a review prompt appears: checkbox list of Unloved pieces, all pre-checked, "Move selected to Sell" bulk action, uncheck to keep anything.

**5. Insights**
- What you actually wear vs. what sits idle: most-worn pieces, never-worn pieces, favorite color combinations, liked style patterns.
- A shopping view: "your real style" summary plus gaps, so you know what to buy and what to stop buying.

## How learning works

Each like/dislike/wear updates preference scores for colors, color pairings, and individual pieces. Matches are ranked by those scores, with a bonus for under-worn pieces and a penalty for anything recently worn or repeatedly disliked. It gets more personal the more you use it.

## Design

Editorial fashion catalog feel: soft ivory background, warm charcoal text, a muted accent, refined serif headings with clean sans body, generous whitespace, large photo-first outfit cards side by side (top over bottom). Mobile-first, since you'll be using it while getting dressed.

## Technical notes

- TanStack Start routes: `/` (Today), `/closet`, `/decide`, `/unloved`, `/insights`, `/auth`; app pages under the authenticated layout.
- Tables: `items` (photo path, category, color, pattern, status, dates), `outfits` (top/bottom pair, generated date), `ratings` (like/dislike + day), `wears` (item/outfit + date), `preferences` (derived color & pairing scores). RLS scoped to `auth.uid()`, plus grants.
- Daily match generation is a server function seeded by date so the same 4–5 looks persist through the day.
- Storage bucket for garment photos, owner-scoped.
