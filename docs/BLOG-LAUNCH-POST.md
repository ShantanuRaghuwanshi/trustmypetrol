# Your petrol pump has 4.2 stars. That tells you nothing about what's in the fuel.

*Introducing TrustMyPetrol — geo-verified, signal-based fuel-quality scores for Indian petrol pumps, now live across 8 metros.*

---

Every Indian driver has a pump they quietly avoid. The mileage dips after filling there. The meter wasn't zeroed. The attendant got defensive when you asked for the density check. You told your friends, maybe your mechanic — and that knowledge died in a WhatsApp group.

Meanwhile, that same pump sits on Google Maps with 4.2 stars, because the toilets are clean and the air machine works.

That gap — between what star ratings measure and what actually matters at a fuel pump — is why we built **TrustMyPetrol**.

## What it is

TrustMyPetrol is a crowd-sourced, OMC-neutral fuel-quality layer for India. You file a report at the pump, the app verifies you were actually there, and every pump gets a **trust score out of 100** computed from verified, recent, structured observations. Open the app with location on and it finds the pumps nearest you, sorted by distance, each with its score — so "where should I fill up right now?" finally has an evidence-based answer.

We started with a Pune pilot and now cover **2,300+ pumps across Delhi, Mumbai, Bengaluru, Chennai, Hyderabad, Kolkata, Ahmedabad, and Pune**.

## Why Google reviews can't do this job

Star ratings are a general-purpose sentiment tool being asked to do a forensic job. They fail at it in five specific ways:

| | Google reviews | TrustMyPetrol |
|---|---|---|
| **What's measured** | Ambient sentiment — staff, queues, toilets | A fixed vocabulary of 10 observable fuel signals |
| **Who can report** | Anyone, from anywhere, anytime | Verified strongest when you're within 150 m of the pump, with a live in-app photo |
| **Freshness** | A 1-star rant from 2019 counts forever | 90-day window with a 30-day half-life — scores reflect the pump *today* |
| **Gaming resistance** | Review-bombing and bought ratings work | One counted report per user per pump per week; no score at all below a minimum evidence threshold |
| **What happens next** | Nothing | One tap drafts a formal grievance for CPGRAMS or the IOCL/BPCL/HPCL portal, evidence attached |

## The moat, in four layers

**1. Structured signals, not rants.** There is no free-text star rating. A report selects from fixed, observable signals: *mileage drop, meter not zeroed, short-fuelling, density check refused, blend not labelled, water in fuel, overcharged, good experience.* This does three things at once: reports are comparable across every pump in India, the maths only ever counts observations (a deliberate defamation firewall — we publish signal counts, not accusations), and the dataset is machine-readable from day one. Google's reviews can't be retrofitted into this; the schema has to exist *before* the data arrives.

**2. Geo-verification as a first-class citizen.** Photos are captured live in-app; location and timestamp are recorded at the moment of capture; uploads must land within minutes; mock-location flags are detected. A geo-verified report carries **1.5× weight** in the score. A failed check doesn't censor the report — it publishes as unverified with lower weight. The result is a corpus of "this person was standing at this dispenser" evidence that simply cannot be scraped, imported, or faked in bulk.

**3. Score maths designed for an adversarial market.** Fuel quality is a *current state*, not a lifetime average — a pump that cleaned up its act three months ago shouldn't wear an old scar, and a pump that started short-fuelling last week shouldn't hide behind years of good reviews. So: recency decay with a 30-day half-life, a 90-day window, per-user dampening against brigading, trusted-reporter weighting, and — crucially — **no score at all** until a pump has enough weighted evidence. We'd rather show "not enough data" than a fake-precise number.

**4. The escalation pipeline.** A review is a dead end; a grievance is a process with a 30-day statutory resolution target. TrustMyPetrol turns your verified report into a ready-to-file complaint — pump name, dealer details, date, time, quantity, amount, observed signals, and a note that geo-tagged photographic evidence was captured within metres of the outlet. We prepare; the citizen files. No platform whose incentive is ad revenue on the business listing will ever build this.

## Why the data compounds

Every verified report makes the dataset harder to replicate. And because of recency decay, the moat isn't a static pile of reviews — it's a **flow**. A copycat can't scrape five years of stale reviews and catch up; the only way to have today's scores is to have had people at the pumps this month. Fresh, verified, structured, India-specific ground truth is the whole product.

## Why now

The E20 rollout — and the arrival of E25, E27, E100 and unblended premium options at the same forecourt — has made "what am I actually putting in my tank?" a mainstream anxiety. Blend labelling on dispensers is a statutory requirement; *"blend not labelled"* is one of our signals. TrustMyPetrol is also **OMC-neutral**: we track IOCL, BPCL, HPCL, Shell, Nayara, and Jio-bp outlets identically, and blend availability (E20/E25+, E100, XP100, CNG) is queryable per pump.

## Try it

Open the map, allow location, and see the nearest pumps ranked by distance — with trust scores where the community has earned them. Had an issue at a pump? File a report from the forecourt; it takes under a minute, and it's the version of your complaint that actually counts.

**One driver's bad tank is an anecdote. Five hundred geo-verified signals are a dataset. That's the difference.**

---

*TrustMyPetrol is live across 8 Indian metros. Pump locations © OpenStreetMap contributors. Scores summarise community-reported observations over the last 90 days; they are not laboratory fuel analyses.*

---

## Social snippets

**LinkedIn / long-form:**

> Your petrol pump has 4.2 stars on Google. The toilets are clean. But was the meter zeroed? Was the E20 labelling on the dispenser? Did your mileage drop after the last tank?
>
> Star ratings can't answer that — so we built TrustMyPetrol: geo-verified, structured fuel-quality reports across 2,300+ pumps in 8 Indian metros. Reports only count strongly when filed *at the pump*. Scores decay in 30 days, so they reflect the pump today, not 2019. And every verified report converts into a ready-to-file CPGRAMS/OMC grievance.
>
> Reviews vent. Verified signals fix. 🔗 [link]

**X / short:**

> Google reviews rate the pump's toilets. TrustMyPetrol rates what's in the fuel — geo-verified reports, 30-day recency decay, one-tap CPGRAMS escalation. 2,300+ pumps, 8 metros. Find the nearest trustworthy pump: [link]
