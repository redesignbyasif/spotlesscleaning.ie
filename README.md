# Spotless Cleaning — premium homepage redesign

A custom, mobile-first homepage for **[Spotless Cleaning](https://spotlesscleaning.ie/)** — a window, gutter,
carpet and floor cleaning company based in Drogheda, Co. Meath, trading since 2011.

This is a **design concept / homepage redesign**, not the live site. It is built as a plain static site so it
can be previewed directly from this repository with GitHub Pages (or any static host) and reports
`noindex, nofollow` so it never competes with the original site in search results.

---

## Live preview

| | |
|---|---|
| **Repository** | `redesignbyasif/spotlesscleaning.ie` |
| **Branch** | `arena/0009fe00-spotlesscleaning-ie` |
| **Entry point** | `index.html` (repository root) |
| **Deployment** | Branch is Pages-ready; enable *Settings → Pages* on this branch (or run the included `pages.yml` workflow) to publish it |
| **Stack** | HTML5 · CSS3 · vanilla JavaScript · self-hosted fonts · WebP images |
| **Build step** | None. No dependencies, no bundler, no backend. |

To preview locally:

```bash
./serve.sh            # http://localhost:8080
# or
python3 -m http.server 8080
```

---

## Design direction

The original site is a 2010-era table layout: inconsistent type, no visual hierarchy, and content that
never gets to the point on a phone. This redesign keeps everything that is genuinely the business's own —
the logo lockup, the purple/green palette, the tone of voice, the real job photography — and rebuilds the
experience around how a customer actually hires a cleaner.

- **Editorial, not template.** Fraunces (a soft, high-contrast serif) for headlines against Manrope for UI.
  Warm paper backgrounds instead of cold grey, so the purple and leaf-green feel intentional.
- **The bloom is the brand device.** The green flower that replaces the “O” in the original wordmark is
  reused as a bullet, a watermark, a favicon and the loading motif, which makes the page feel authored
  rather than assembled.
- **Proof over promises.** Numbers, named local clients and three real case notes (Townley Hall, HSQ Dublin,
  Bellingham Castle) do the persuading — all taken from the company's own published material.
- **Mobile-first.** Designed at 360 px first; every section is re-composed for small screens rather than
  shrunk. The hero, drawer, sticky header and floating contact button are all thumb-reachable.

### Brand values used

| Token | Value | Source |
|---|---|---|
| Purple | `#A3139F` | sampled from the original wordmark |
| Deep purple | `#6C0D6A` | darker tint of the same hue for text contrast |
| Leaf green | `#7C9860` | sampled from the bloom in the wordmark |
| Paper | `#FBF8F3` | neutral chosen to keep photography warm |
| Ink | `#1C111B` | near-black with a plum cast |

---

## Homepage sections

1. Sticky header with logo, primary nav and a tap-to-call pill
2. Signature hero (art-directed portrait crop, reach badge, dual CTA)
3. Trust strip (4,000+ customers · 90% returning · 50 ft reach · since 2011)
4. Business introduction with the founder's own quote
5. Six-service showcase with an emphasised window-cleaning feature card
6. Four-step process
7. Proof: statistics + three real case notes
8. Field gallery using the company's own job photos
9. Marquee of local client names taken from the original site
10. Service areas (Drogheda, Balbriggan, Navan, Dublin) with address card
11. FAQ accordion (seven genuine pre-booking questions)
12. Full-bleed closing CTA with phone, email and address
13. Footer with navigation, social profiles and payment methods
14. Floating quick-contact button (call / email / text)

---

## Project structure

```
.
├── index.html                 # the homepage (single page)
├── css/style.css              # design system + all styles
├── js/script.js               # nav, drawer, FAB, accordion, reveals
├── assets/
│   ├── logo/                  # SVG wordmark, white/mono variants, marks, favicon
│   ├── images/                # responsive WebP derivatives
│   ├── original/              # untouched source photography
│   ├── icons/                 # inline SVG sprite lives in index.html
│   └── fonts/                 # Fraunces + Manrope (SIL Open Font License)
├── serve.sh                   # optional local preview server
├── .github/workflows/pages.yml # optional publisher for a gh-pages preview
└── .nojekyll                  # keeps GitHub Pages from running Jekyll
```

---

## Content sources (no invented business information)

Everything factual comes from the company's own website and public profiles:

- Founding year (2011), 4,000+ customers, 90% returning customers, 50 ft pole reach, 45 ft gutter-vac reach
- Address (41 Knights Wood, Lagavooren, Drogheda, Co. Meath, A92 TPE8), phone (087 053 1782) and
  `info@spotlesscleaning.ie`
- Services and their descriptions, payment methods, areas covered, service intervals
- Client names taken from the logos published on the original site
- Case notes (Townley Hall, HSQ Dublin car park, Bellingham Castle) taken from the site's own project text

**No testimonials were invented.** The original site did not publish review quotes, so the redesign uses
the founder's own published statement as the pull-quote and points to the company's real social profiles.

### Imagery

- `assets/original/` holds the untouched job photography published by the business.
- `assets/images/` holds the responsive WebP derivatives (multiple widths and crops).
- Where the available photography was too small for a full-width hero, brand imagery was generated in the
  same documentary style. The technicians in those images wear the Spotless Cleaning logo on their workwear,
  as required by the brief.
- The generated images are **not** presented as real customer projects. The gallery labels them clearly and
  the site says so in the caption at the end of the gallery.

---

## Accessibility & performance

- Semantic landmarks, a single `h1`, logical heading order, skip link
- Keyboard-operable drawer with focus trap, `Escape` to close, focus returned to the trigger
- Accordion built on real buttons with `aria-expanded` / `aria-controls`
- Visible focus rings, `prefers-reduced-motion` support, ≥32 px tap targets
- Self-hosted variable fonts (no third-party requests), preloaded critical assets
- Responsive `srcset`/`sizes`; hero image is prioritised, everything else lazy-loads
- `noindex, nofollow` so this concept never competes with the original site

---

## QA

The homepage was tested in headless Chromium at seven viewports — **360, 390, 430, 768, 1024, 1280 and
1440 px** — before delivery. Every run returned zero issues:

| Check | Result |
|---|---|
| Horizontal overflow | none at any width (`scrollWidth === innerWidth`) |
| Broken images / missing `alt` | 0 of 20 images |
| Tap targets under 40 px | 0 |
| Console errors, failed requests | 0 |
| Mobile drawer | opens, closes, traps focus, `Escape`, returns focus, locks scroll |
| Floating contact button | in-viewport, hit-testable, opens and closes on outside click |
| FAQ accordion | opens/closes with correct `aria-expanded` |
| In-page anchors | all resolve, land below the fixed header |

Tested interactions by hand as well: sticky header, hover states, smooth scroll, keyboard tab order and the
service card focus styles.

## Fonts

Fraunces and Manrope are self-hosted under the SIL Open Font License; the licence texts are included in
`assets/fonts/`. The Montserrat outlines used inside the SVG logo are also OFL.

## Credits

Design and build: homepage redesign concept for Spotless Cleaning, Drogheda.
All business details, names and photography belong to Spotless Cleaning.
