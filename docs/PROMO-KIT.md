# TrustMyPetrol — Promo Kit

Platform-specific drafts, ready to adapt and post. Replace `[link]` with the
production URL and `[Play Store link]` once live. Post these **yourself** —
Team-BHP and Reddit actively remove content that smells automated, and your
authentic voice as the builder is the asset.

**Week-one plan:** Team-BHP thread + r/pune + r/CarsIndia, all pointing at
Pune (the data-richest city). Measure geo-verified reports per Pune pump, not
downloads. Expand city-by-city once the Pune map looks alive.

---

## 1. Team-BHP forum thread

**Section:** The Indian Car Scene (or Modifications & Accessories → apps, per
mod guidance — read the self-promo rules and consider messaging a mod first).

**Title:** I built a geo-verified fuel-quality tracker for Indian pumps — scores from structured reports, not star ratings

**Body:**

> Long-time lurker, first project share. Like many here I've had the
> mileage-drop-after-that-one-pump experience, and the E20/E25/E27 rollout has
> made "what's actually in my tank" a weekly conversation. Google reviews are
> useless for this — a pump rates 4.2 stars because the loo is clean.
>
> So I built **TrustMyPetrol**. The design choices BHPians will care about:
>
> - **No star ratings.** Reports pick from fixed, observable signals: mileage
>   drop, meter not zeroed, short-fuelling, density check refused, blend not
>   labelled, water in fuel, overcharged, good experience. Comparable across
>   every pump, and no defamatory free-text scoring.
> - **Geo-verification.** Photos are captured live in-app; location and
>   timestamp recorded at capture. A report filed within 150 m of the pump
>   carries 1.5× weight. Mock-location apps are detected.
> - **Scores decay.** 90-day window, 30-day half-life. A pump that cleaned up
>   isn't punished forever; one that started short-fuelling last week can't
>   hide behind old goodwill. Below a minimum evidence threshold we show
>   "not enough data" instead of a fake-precise number.
> - **Anti-brigading.** One counted report per user per pump per week.
> - **Escalation.** A verified report converts into a ready-to-file CPGRAMS /
>   IOCL / BPCL / HPCL grievance with the evidence details pre-drafted.
>
> Currently 2,300+ pumps across 8 metros (locations from OpenStreetMap),
> deepest data in Pune. OMC-neutral — IOCL/BPCL/HPCL/Shell/Nayara/Jio-bp all
> tracked identically.
>
> Would genuinely value this forum's scrutiny: which signals are missing?
> Is the density-check-refused signal worded right? Web: [link]

---

## 2. Reddit — r/CarsIndia (crosspost-adapt for r/IndianBikes)

**Title:** Google reviews rate the pump's toilets. I built something that rates what's in the fuel.

**Body:**

> Every "mileage suddenly dropped" thread here has the same reply: "change
> your pump." But which one? So I built TrustMyPetrol — pumps get a 0–100
> trust score computed from structured, geo-verified reports instead of star
> ratings.
>
> How it's different from just reviewing on Google:
>
> - Reports are filed **at the pump** — live photo, GPS + timestamp at
>   capture, verified within 150 m. Verified reports count 1.5×.
> - Fixed signal vocabulary (mileage drop, meter not zeroed, short-fuelling,
>   density check refused, blend not labelled…) — no rants, just counts.
> - Scores use only the **last 90 days** with a 30-day half-life, so they
>   reflect the pump *now*.
> - One counted report per user per pump per week — review-bombing doesn't
>   work.
> - One tap drafts a formal CPGRAMS/OMC grievance from your report.
>
> 2,300+ pumps across 8 metros, E20/E25+/E100/XP100/CNG availability per
> pump. It's early — scores only appear where the community has filed enough
> reports, so I'd rather 100 people in one city than 10,000 spread thin.
> Roast the scoring maths if you like, it's all open: [link]

**r/pune variant title:** Pune folks — I built a fuel-quality map for the
city's petrol pumps (geo-verified reports, not star ratings). The pilot
started here, so Pune has the deepest data.

---

## 3. X / Twitter thread

> 1/ Your petrol pump has 4.2 stars on Google.
> The toilets are clean. The air machine works.
> Nobody can tell you if the meter was zeroed or whether your mileage will
> drop after this tank.
> So I built the thing star ratings can't be: [link]
>
> 2/ TrustMyPetrol scores pumps 0–100 from *structured* reports — a fixed
> vocabulary of observable signals: mileage drop, meter not zeroed,
> short-fuelling, density check refused, blend not labelled, water in fuel.
> No rants. Just counts.
>
> 3/ The trust layer: reports are filed AT the pump. Live in-app photo, GPS +
> timestamp at capture, verified within 150 m, mock-GPS detection. Verified
> reports weigh 1.5×. You can't review-bomb from your couch.
>
> 4/ Scores decay with a 30-day half-life. Fuel quality is a current state,
> not a lifetime average. A pump that cleaned up sheds its past; one that
> started short-fuelling last week can't hide behind 2019's stars.
>
> 5/ And the part no review site will ever build: one tap turns your verified
> report into a ready-to-file CPGRAMS / IOCL / BPCL / HPCL grievance —
> 30-day statutory resolution target. Reviews vent. Grievances get answered.
>
> 6/ 2,300+ pumps, 8 metros, E20/E25/E100/XP100/CNG availability per pump,
> OMC-neutral. Open the map, allow location, see the nearest pumps ranked by
> distance with their scores. Filling up shouldn't be a gamble. [link]

Post during E20/mileage discourse spikes; quote-tweet relevant complaints
with the map link rather than cold-posting.

---

## 4. Creator outreach (YouTube/Instagram pump-scam & mileage channels)

**Subject:** Your density-check video + a way for viewers to act on it

> Hi [name],
>
> Your video on [specific video — quantity fraud / density check / E20
> mileage] answered the question every comment section asks: "how do I catch
> it?" I built the follow-up: **what to do when you catch it.**
>
> TrustMyPetrol is a free, OMC-neutral app where a viewer files a
> geo-verified report from the forecourt (live photo, GPS-verified within
> 150 m), the pump's public trust score updates, and the app drafts a formal
> CPGRAMS/OMC grievance for them. 2,300+ pumps across 8 metros.
>
> No money involved — I'd just like to offer it as the call-to-action for
> your next fuel video, and I can share aggregate signal data from [city]
> (which pumps get flagged for what) if that's useful material.
>
> 2-minute demo: [link]

Target: channels doing petrol-pump-scam exposés, density/5-litre-check
demos, and E20 mileage tests. Mid-size (50k–500k) creators reply more and
their audiences act more.

---

## 5. Show HN (Hacker News)

**Title:** Show HN: Geo-verified fuel-quality scores for Indian petrol pumps

**Body:**

> India is rolling out E20+ ethanol blends and fuel-quality complaints
> (short-fuelling, adulteration, unlabelled blends) are common, but the only
> public signal is Google star ratings — which measure the toilets, not the
> fuel.
>
> TrustMyPetrol scores pumps from structured reports instead: a fixed
> vocabulary of 10 observable signals, geo-verification (live photo, GPS at
> capture, within 150 m, mock-location detection; verified = 1.5× weight),
> 30-day half-life recency decay, per-user dampening against brigading, and
> a minimum-evidence threshold below which we show "no data" rather than a
> number. Verified reports convert into pre-drafted grievances for the
> government portal (CPGRAMS), which has a 30-day statutory response target.
>
> Stack: Next.js + Expo monorepo, shared TypeScript scoring engine, Supabase
> (Postgres + PostGIS + RLS), pump inventory from OpenStreetMap (2,300+
> pumps, 8 metros). The same pure scoring function backs the SQL view, the
> unit tests, and client-side previews.
>
> The interesting design constraint was defamation: the score maths only
> ever sees counts of observable signals, never free-text accusations.
> Happy to answer questions on that or the anti-gaming maths.

---

## 6. Product Hunt

**Tagline:** Fuel-quality scores for petrol pumps — geo-verified, not star-rated

**Description:**

> Google reviews tell you a petrol pump has clean toilets. TrustMyPetrol
> tells you if the meter was zeroed. Drivers file reports at the pump —
> live photo, GPS-verified — picking from fixed signals like mileage drop,
> short-fuelling, or blend not labelled. Pumps get a 0–100 trust score that
> decays over 30 days, so it reflects the pump today. One tap turns a report
> into a formal government grievance. 2,300+ pumps across 8 Indian metros.

**First comment (maker):** lead with the E20 rollout context and the
"scores are a flow, not a stockpile" moat argument from the blog post.

---

## 7. WhatsApp / Telegram forward (driver & RWA groups)

> ⛽ *Mileage dropped after a refill? Meter looked off?*
> Free app that shows a *trust score* for every petrol pump near you —
> computed from geo-verified reports by other drivers, not Google stars.
> Check your regular pump: [link]
> Had an issue? File a report from the pump in under a minute — it also
> drafts the official CPGRAMS complaint for you. Works for
> IOCL/BPCL/HPCL/Shell/Nayara/Jio-bp.

Fleet/cab-driver groups first: they refuel daily and generate the most
geo-verified reports per user.

---

## Launch checklist (owner actions)

- [ ] Set `NEXT_PUBLIC_SITE_URL` on the production deployment (sitemap, OG
      tags and JSON-LD all derive absolute URLs from it)
- [ ] Submit `sitemap.xml` in Google Search Console + verify domain
- [ ] Publish the blog post (docs/BLOG-LAUNCH-POST.md) on the site or
      Medium/dev.to, link it from every platform post
- [ ] Team-BHP thread (read self-promo rules / message a mod first)
- [ ] r/pune + r/CarsIndia (stagger by a few days; don't cross-post same day)
- [ ] X thread; then quote-tweet E20/mileage complaints with the map link
- [ ] 5–10 creator outreach emails (personalise the [specific video] line)
- [ ] Show HN + Product Hunt once the first city's map has visible scores
- [ ] Track: geo-verified reports per Pune pump per week — the only number
      that matters early
