# crayon-60s · 一支蜡笔画出世界

60 s colour film, no voice-over, no subtitles. Built with the `onetake` skill (`.claude/skills/onetake`).

- `comp.html` — the whole film: one canvas, every frame a pure function of time (`?play`, `?t=12.3&hud`)
- `motion.js` — onetake's move library (copied)
- `score.py` — the soundtrack, fully synthesised → `score.wav`

```bash
python3 score.py
python3 ../../.claude/skills/onetake/scripts/render.py comp.html --out draft.mp4 --sfx score.wav        # 1080p30 draft
python3 ../../.claude/skills/onetake/scripts/render.py comp.html --out film.mp4 --final --sfx score.wav # 4K60
```

| t | beat | style |
|---|---|---|
| 0–4.6 | a baby's black-and-white mobile comes into focus; one red dot | high-contrast 2D |
| 4.6–11 | a child's hand draws a balloon, a sun, a blue line; dive into the line | crayon on paper |
| 11–22 | the line is water; ink drops bloom on the beat; a wave rides up | fluid |
| 22–30 | sky; leaves blow through and age green → gold → red; the balloon is real | painterly + 3D balloon |
| 30–42 | the balloon bursts into paint; each hit is another style: 50s halftone, watercolour, 80s neon, leaves, 90s flat, Y2K glossy 3D, pastel now… → one rainbow vortex | mixed |
| 42–52 | watercolour blooms; an older hand draws with the same crayon, worn short | watercolour |
| 52–57 | the line gathers into light → prism → spectrum | light |
| 57–60 | the spectrum is a crayon rainbow on the child's page | crayon |
