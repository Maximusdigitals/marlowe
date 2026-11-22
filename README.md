# Marlowe — Private Cinema

A private-cinema hire site that does not stay a private-cinema hire site. Scroll down. Sound on.

Live: https://maximusdigitals.github.io/marlowe/

Plain HTML, CSS and JS, with no trackers and no external requests. The audio is generated live with Web Audio. The images are original AI-generated artwork, graded and grained. Marlowe is fictional.

## Type
- **Le Murmure** by Jérémy Landes / Velvetyne: display. SIL Open Font License 1.1 (fonts/LeMurmure-LICENSE.txt)
- **Newsreader** by Production Type: text. SIL Open Font License 1.1 (fonts/Newsreader-OFL.txt)
- **Compagnon** by Juliette Duhé, Léa Pradine, Valentin Papon, Chloé Lozano and Sébastien Riollier / Velvetyne: labels and tickets. SIL Open Font License 1.1 (fonts/Compagnon-LICENSE.txt)

Contains a jump scare and horror imagery. There are no flashes faster than 3 per second, and the site respects prefers-reduced-motion.

made by [@voidhl](https://x.com/voidhl)

## X in-app browser notes (v3)
- Audio unlocks inside the entry tap: `navigator.audioSession.type = 'playback'` (iOS 17+, ignores the silent switch), `AudioContext.resume()`, a 1-sample silent buffer, and on older iOS a silent looping `<audio playsinline>`. Resumes after iOS "interrupted"/suspended states on the next touch, focus or pageshow; a "Tap for sound" pill appears if it stays suspended.
- Safe-area insets, `dvh`/`lvh` with `vh` fallbacks, `overscroll-behavior` to stop pull-to-refresh, touch scroll locked by hand during the scare (WebKit ignores `overflow:hidden` for touch).
- Scare trigger fires from an IntersectionObserver *and* a scroll-position check, so a momentum fling can't skip it. Scare images are decoded ahead of time.
- Colours are computed in JS (no `color-mix()` dependency); grain/blend modes are cheaper on Android and low-memory devices; JPEG twins for every WebP.
- Links open in the same view inside webviews; share uses `x.com/intent/post`.
