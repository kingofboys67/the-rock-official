# About page image slots

`about.html` already points at these files. Drop a JPEG in with the exact name and it appears; no code change needed.

- Frame: 4:5 portrait. Supply 960 × 1200 px, with his face in the upper third (the frame crops with `object-fit: cover`, centred at 50% 30%).
- Until a file exists, its frame keeps its size: slots marked *fallback* show an existing licensed photo, the rest show a quiet placeholder.
- Use photos you have the rights to. If a photo needs attribution, add it to `media/about/credits.json` and put `data-credit="<key>"` on its `<img>`.

| File | Where it shows |
|---|---|
| `early-life-honolulu.jpg` | Early life chapter (fallback: 2002 press photo) |
| `football-miami.jpg` | Football chapter |
| `the-ring-training.jpg` | Wrestling header: training with his father |
| `1996-rocky-maivia.jpg` | Timeline 1996: Flex Kavana, then Rocky Maivia |
| `2003-hollywood-rock.jpg` | Timeline 2003: Hollywood Rock |
| `2004-wrestlemania-xx.jpg` | Timeline 2004: Leaving the ring |
| `2012-once-in-a-lifetime.jpg` | Timeline 2011–2013: Once in a lifetime |
| `2024-final-boss.jpg` | Timeline 2024: The Final Boss |
| `controversies.jpg` | Controversies chapter (fallback: 2018 interview photo) |
| `hollywood.jpg` | Hollywood photo grid (fallback: 2009 Tribeca photo) |
