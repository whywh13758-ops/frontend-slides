#!/usr/bin/env python3
"""score.py — the whole soundtrack for crayon-60s, synthesised (no samples, no licences to track).

  python3 score.py            → score.wav (48 kHz stereo, 60 s)

Music and effects share one room (one convolution reverb) and follow the comp's timeline: a music box for the baby,
plucks while the crayon draws, a build under the water, a half-time sky, silence before the pop, a 120 bpm drop
through the eras, a watercolour breakdown, and one last hit for the spectrum.
"""
import numpy as np
from scipy import signal

SR = 48000
DUR = 60.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
music = np.zeros((N, 2)); fx = np.zeros((N, 2)); drums = np.zeros((N, 2))
BEAT = 0.5  # 120 bpm


def n2f(n):  # midi → Hz
    return 440.0 * 2 ** ((n - 69) / 12)


def tt(d):
    return np.arange(int(SR * d)) / SR


def put(buf, t0, x, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N or i + len(x) <= 0:
        return
    if i < 0:
        x = x[-i:]; i = 0
    x = x[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(x), 0] += x * gain * l * 1.414
    buf[i:i + len(x), 1] += x * gain * r * 1.414


def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR / 2 - 100) / (SR / 2), 'low'); return signal.lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high'); return signal.lfilter(b, a, x)


def bp(x, f0, f1, order=2):
    b, a = signal.butter(order, [f0 / (SR / 2), min(f1, SR / 2 - 100) / (SR / 2)], 'band'); return signal.lfilter(b, a, x)


def env(d, a=0.005, r=None, k=4.0):
    t = tt(d); e = np.minimum(1, t / max(a, 1e-4))
    return e * (np.exp(-k * t) if r is None else np.clip((d - t) / r, 0, 1))


def saw(f, d, detune=0.0):
    t = tt(d); ph = (f * (1 + detune)) * t + rng.random()
    return 2 * (ph % 1) - 1


# ───────────────────────── instruments ─────────────────────────
def musicbox(f, d=2.2):
    t = tt(d)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-6 * t) + 0.12 * np.sin(2 * np.pi * f * 5.43 * t) * np.exp(-9 * t)
    return x * env(d, 0.002, k=2.6)


def pluck(f, d=1.2, bright=3000):
    t = tt(d)
    x = sum(np.sin(2 * np.pi * f * h * t) / h ** 1.3 * np.exp(-(2.5 + h * 1.4) * t) for h in range(1, 7))
    return lp(x * env(d, 0.003, k=2.0), bright)


def epiano(f, d=3.0):
    t = tt(d)
    x = np.sin(2 * np.pi * f * t + 0.8 * np.sin(2 * np.pi * f * t) * np.exp(-3 * t))
    return x * env(d, 0.004, k=1.1)


def pad(notes, d, cut=1800, a=1.2, r=1.5):
    t = tt(d); x = np.zeros(len(t))
    for n in notes:
        for dt in (-0.006, 0.0, 0.007):
            x += saw(n2f(n), d, dt)
    x = lp(x / (3 * len(notes)), cut, 2)
    e = np.minimum(1, t / a) * np.clip((d - t) / r, 0, 1)
    return x * e


def supersaw(notes, d, cut=5000):
    t = tt(d); x = np.zeros(len(t))
    for n in notes:
        for dt in (-0.012, -0.005, 0.0, 0.005, 0.012):
            x += saw(n2f(n), d, dt)
    return lp(x / (5 * len(notes)), cut, 2)


def kick(d=0.45, f0=150, f1=44, punch=1.0):
    t = tt(d); f = f1 + (f0 - f1) * np.exp(-t * 28)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5)
    click = lp(rng.standard_normal(len(t)), 5000) * np.exp(-t * 300) * 0.3
    return np.tanh((x + click) * 1.6 * punch)


def snare(d=0.3):
    t = tt(d)
    n = bp(rng.standard_normal(len(t)), 1200, 9000) * np.exp(-t * 16)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    return 0.8 * n + 0.5 * tone


def clap(d=0.35):
    t = tt(d); n = bp(rng.standard_normal(len(t)), 900, 6000)
    e = sum(np.exp(-np.maximum(0, t - o) * 90) * (t >= o) for o in (0, 0.011, 0.022)) + 0.6 * np.exp(-np.maximum(0, t - 0.03) * 14) * (t >= 0.03)
    return n * e * 0.7


def hat(d=0.06, open_=False):
    t = tt(0.3 if open_ else d); return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * (12 if open_ else 70)) * 0.5


def tom(f=110, d=0.5):
    t = tt(d); fr = f * (1 + 0.6 * np.exp(-t * 20))
    return np.tanh(1.4 * np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 7))


def boom(d=3.0, f0=90, f1=32, crack=1.0):
    t = tt(d); f = f1 + (f0 - f1) * np.exp(-t * 5)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.3)
    cr = lp(rng.standard_normal(len(t)), 3500) * np.exp(-t * 9) * crack
    return np.tanh(1.3 * (sub + 0.6 * cr))


def crash(d=3.5):
    t = tt(d); return hp(rng.standard_normal(len(t)), 4500) * np.exp(-t * 1.4) * 0.45


def riser(d, f0=300, f1=6000):
    t = tt(d); x = rng.standard_normal(len(t)); out = np.zeros(len(t)); seg_ = int(SR * 0.05)
    for i in range(0, len(t), seg_):
        k = i / len(t); fc = f0 * (f1 / f0) ** k
        out[i:i + seg_] = bp(x[max(0, i - 2000):i + seg_], fc * 0.7, fc * 1.3)[-len(x[i:i + seg_]):]
    tone = saw(1, d) * 0
    ph = np.cumsum(110 * (8 ** (t / d))) / SR; tone = 0.25 * np.sin(2 * np.pi * ph)
    return (out * 1.2 + tone) * (t / d) ** 2


def reverse_swell(d):
    t = tt(d); return hp(rng.standard_normal(len(t)), 2500) * (t / d) ** 3 * 0.6


def whoosh(d, f0=400, f1=2500):
    t = tt(d); x = rng.standard_normal(len(t)); c = np.sqrt(f0 * f1)
    return bp(x, f0, f1) * np.sin(np.pi * t / d) ** 2


def bloop(f=520, d=0.5):
    t = tt(d); fr = f * (1 - 0.55 * (1 - np.exp(-t * 18)))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 7)


def scratch(d):  # crayon on paper
    t = tt(d); x = bp(rng.standard_normal(len(t)), 1800, 7000)
    am = 0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 9 * t + 3 * np.sin(2 * np.pi * 2.3 * t)))
    return x * am * np.minimum(1, t / 0.04) * np.clip((d - t) / 0.05, 0, 1) * 0.35


# ───────────────────────── chords ─────────────────────────
Bm, G, D, A = [47, 50, 54], [43, 47, 50], [50, 54, 57], [45, 49, 52]
PROG = [Bm, G, D, A]
MOTIF = [71, 74, 78, 76, 74, 71, 69, 71]  # music box, B minor

# 0–4.6 · the baby's world
for i, (t0, n) in enumerate(zip([0.7, 1.5, 2.3, 3.0, 3.5, 3.9], MOTIF)):
    put(music, t0, musicbox(n2f(n + 12)), 0.18, pan=(-0.3 + 0.12 * i))
put(music, 0.2, pad([59, 66], 4.6, cut=900, a=2.0, r=0.6), 0.05)
put(fx, 3.0, pluck(n2f(62), 2.0, 1500), 0.35)
put(fx, 3.0, boom(1.5, 70, 38, 0.1), 0.25)
put(fx, 4.0, reverse_swell(0.6), 0.35)
put(fx, 4.45, whoosh(0.5, 300, 3000), 0.3)

# 4.6–11 · drawing: plucks on eighths, a pad, the crayon itself
for k in range(int((10.0 - 4.6) / 0.25)):
    t0 = 4.6 + k * 0.25; ch = PROG[int((t0 - 4.6) // 2) % 4]
    n = ch[k % 3] + 24 + (12 if k % 8 == 7 else 0)
    put(music, t0, pluck(n2f(n), 0.9, 2600), 0.11 * (0.8 + 0.2 * (k % 2 == 0)), pan=0.35 * np.sin(k))
for i, t0 in enumerate([4.6, 6.6, 8.6]):
    put(music, t0, pad([c + 12 for c in PROG[i % 4]], 2.2, cut=1400, a=0.4, r=0.6), 0.10)
for a, b in [(5.5, 6.6), (6.62, 7.0), (7.15, 7.9), (8.25, 9.95)]:
    put(fx, a, scratch(b - a), 0.5, pan=0.2)
put(fx, 7.0, whoosh(0.35, 600, 4000), 0.25, pan=0.4)
put(fx, 7.95, whoosh(0.4, 500, 3500), 0.25, pan=-0.4)
put(fx, 9.95, riser(1.05, 300, 5000), 0.35)
put(fx, 10.9, whoosh(0.9, 150, 1500), 0.4)

# 11–22 · water: the pad breathes, drums build, ink drops bloom on the beat
for i, t0 in enumerate(np.arange(11.0, 22.0, 2.0)):
    put(music, t0, pad([c + 12 for c in PROG[i % 4]] + [PROG[i % 4][0] + 24], 2.3, cut=900 + 150 * i, a=0.6, r=0.6), 0.12)
for k in range(int((22.0 - 11.0) / 0.25)):
    t0 = 11.0 + k * 0.25; ch = PROG[int((t0 - 11.0) // 2) % 4]
    put(music, t0, pluck(n2f(ch[(k * 2) % 3] + 36), 0.6, 3500), 0.07, pan=0.5 * np.sin(k * 0.7))
for t0 in np.arange(14.0, 22.0, BEAT):
    g = 0.5 + 0.5 * (t0 >= 16)
    put(drums, t0, kick(punch=0.9), 0.55 * g)
    if t0 >= 16: put(drums, t0 + 0.25, hat(), 0.18, pan=0.3)
    if t0 >= 17 and int((t0 - 17) / BEAT) % 2 == 1: put(drums, t0, snare(), 0.3)
for t0 in np.arange(16.0, 22.0, 0.25):
    ch = PROG[int((t0 - 16) // 2) % 4]; put(music, t0, lp(saw(n2f(ch[0] - 12), 0.22), 700) * env(0.22, 0.004, k=6), 0.22)
for t0, pan in zip([15.0, 16.0, 17.0, 18.0, 19.0, 19.5], [-0.4, 0.3, -0.1, 0.5, -0.6, 0.1]):
    put(fx, t0 - 0.35, whoosh(0.35, 800, 5000), 0.12, pan)
    put(fx, t0, bloop(560 + 60 * pan), 0.35, pan); put(fx, t0, musicbox(n2f(83 + int(4 * pan))), 0.1, pan)
put(fx, 20.2, riser(1.8, 200, 7000), 0.55)
put(fx, 21.55, reverse_swell(0.45), 0.5)
put(fx, 22.0, boom(3.0, 95, 30), 0.85); put(fx, 22.0, crash(4.0), 0.5); put(drums, 22.0, kick(punch=1.3), 0.8)

# 22–30 · sky: half time, open chord, leaves; a riser, then silence before the pop
put(music, 22.0, pad([50, 57, 62, 64, 66, 69], 6.0, cut=2600, a=0.3, r=2.0), 0.16)
put(music, 26.0, pad([47, 54, 59, 62, 66], 3.4, cut=3000, a=1.0, r=0.6), 0.14)
for t0 in np.arange(22.0, 27.4, 2.0):
    put(drums, t0, kick(punch=0.8), 0.45); put(drums, t0 + 1.0, clap(), 0.22)
for k, t0 in enumerate(np.arange(22.5, 27.4, 0.5)):
    put(music, t0, musicbox(n2f(MOTIF[k % 8] + 12), 1.4), 0.07, pan=0.5 * np.sin(k))
for t0, pan in [(23.2, -0.6), (24.1, 0.4), (25.0, -0.2), (25.8, 0.6)]:
    put(fx, t0, whoosh(1.0, 1500, 8000) * 0.6, 0.12, pan)
put(fx, 27.4, riser(1.9, 150, 9000), 0.7)
roll = [27.4 + 1.9 * (1 - (1 - i / 32) ** 1.6) for i in range(32)]
for i, t0 in enumerate(roll):
    put(drums, t0, snare(0.15), 0.08 + 0.3 * i / 32)
# 29.3–30.0: silence

# 30–42 · the drop: 120 bpm, a stab and a tom on every era cut, a vortex, one more boom
put(fx, 30.0, boom(3.5, 110, 28), 1.0); put(fx, 30.0, crash(4.0), 0.55); put(drums, 30.0, clap(), 0.6)
put(music, 30.0, supersaw([62, 66, 69, 74], 0.9, 6000) * env(0.9, 0.003, k=3), 0.35)
for t0 in np.arange(30.0, 42.0, BEAT):
    put(drums, t0, kick(punch=1.2), 0.75)
    if int((t0 - 30) / BEAT) % 2 == 1: put(drums, t0, clap(), 0.4); put(drums, t0, snare(), 0.25)
for t0 in np.arange(30.0, 42.0, 0.125):
    put(drums, t0 + 0.0625 * 0, hat(), 0.11 + 0.06 * ((t0 * 8) % 2 == 1), pan=0.25)
for t0 in np.arange(30.0, 42.0, 0.25):
    ch = PROG[int((t0 - 30) // 2) % 4]; put(music, t0, np.tanh(2 * lp(saw(n2f(ch[0] - 12), 0.24), 900)) * env(0.24, 0.003, k=5), 0.3)
for i, t0 in enumerate(np.arange(30.0, 42.0, 2.0)):
    put(music, t0, pad([c + 12 for c in PROG[i % 4]] + [PROG[i % 4][1] + 24], 2.1, cut=3500, a=0.05, r=0.4), 0.12)
ERA_HITS = [31.5, 32.5, 33.5, 34.25, 35.0, 35.5, 36.0, 36.25, 36.5, 36.75, 37.0, 37.25, 37.5, 37.75]
for i, t0 in enumerate(ERA_HITS):
    ch = PROG[i % 4]
    put(music, t0, supersaw([c + 24 for c in ch], 0.3, 7000) * env(0.3, 0.002, k=9), 0.22, pan=0.3 * (-1) ** i)
    put(drums, t0, tom(90 + 12 * (i % 6)), 0.45, pan=0.4 * (-1) ** i)
    put(fx, t0, whoosh(0.25, 1000, 9000), 0.12, pan=0.5 * (-1) ** i)
put(fx, 38.0, boom(2.0, 100, 35), 0.7); put(fx, 38.0, crash(3.0), 0.4)
put(fx, 38.0, riser(2.0, 200, 8000), 0.45)
put(fx, 40.0, boom(2.5, 120, 30), 0.9); put(fx, 40.0, crash(3.0), 0.5)
put(music, 40.0, supersaw([59, 62, 66, 71], 1.2, 7000) * env(1.2, 0.003, k=2.5), 0.3)
put(fx, 40.3, riser(1.7, 150, 10000), 0.6)
put(fx, 41.4, reverse_swell(0.6), 0.6)
put(fx, 42.0, boom(4.0, 80, 26, 0.5), 0.9); put(fx, 42.0, crash(5.0), 0.35)

# 42–51.8 · watercolour: e-piano and the music box, remembered; no drums
for i, (t0, ch) in enumerate([(42.2, [62, 66, 69, 73]), (44.6, [59, 62, 66, 69]), (47.0, [55, 59, 62, 66]), (49.4, [57, 61, 64, 69])]):
    for j, n in enumerate(ch):
        put(music, t0 + j * 0.06, epiano(n2f(n), 3.5), 0.09, pan=-0.3 + 0.2 * j)
    put(music, t0, pad([ch[0] - 12, ch[2]], 2.6, cut=1000, a=0.8, r=1.2), 0.08)
for k, t0 in enumerate([43.1, 43.6, 44.1, 45.5, 46.0, 46.5, 47.9, 48.4, 48.9, 49.4]):
    put(music, t0, musicbox(n2f(MOTIF[k % 8] + 12), 2.0), 0.09, pan=0.4 * np.sin(k * 1.3))
put(fx, 45.4, scratch(4.0) * 0.6, 0.35, pan=0.1)

# 51.8–57 · light gathers, the prism, the spectrum
put(music, 51.8, pad([62, 69, 74, 78, 81], 3.0, cut=5000, a=2.8, r=0.2), 0.14)
put(fx, 52.4, riser(2.2, 400, 12000), 0.45)
put(fx, 53.7, whoosh(0.4, 2000, 12000), 0.25, pan=-0.2)
# 54.6–55.0: near silence
put(fx, 55.0, boom(4.0, 100, 28), 1.0); put(fx, 55.0, crash(5.0), 0.55); put(drums, 55.0, kick(punch=1.4), 0.85)
put(music, 55.0, supersaw([50, 57, 62, 66, 69, 74, 78], 3.5, 6500) * env(3.5, 0.003, k=0.9), 0.32)
put(music, 55.0, pad([38, 50], 4.5, cut=400, a=0.01, r=2.5), 0.3)

# 57–60 · the page: the music box, once more, then nothing
for i, (t0, n) in enumerate(zip([57.2, 57.7, 58.2, 58.9], [71, 74, 78, 83])):
    put(music, t0, musicbox(n2f(n + 12), 2.5), 0.14, pan=-0.2 + 0.15 * i)

# ───────────────────────── one room, a duck, the master ─────────────────────────
def ir(d=2.4, pre=0.012):
    t = tt(d); nL = rng.standard_normal(len(t)); nR = rng.standard_normal(len(t))
    e = np.exp(-t * 3.2); x = np.stack([lp(nL, 6000) * e, lp(nR, 6000) * e], 1)
    x[: int(pre * SR)] = 0; return x / np.sqrt((x ** 2).sum() / 2)


R = ir()
def verb(x, wet):
    return np.stack([signal.fftconvolve(x[:, c], R[:, c])[:N] for c in range(2)], 1) * wet

# duck the music under the hits
hits = [3.0, 22.0, 30.0, 38.0, 40.0, 42.0, 55.0]
duck = np.ones(N)
for h in hits:
    i = int(h * SR); t = tt(1.2); d = 1 - 0.6 * np.exp(-t * 4)
    duck[i:i + len(d)] = np.minimum(duck[i:i + len(d)], d[: N - i])
dry = music * duck[:, None] + fx + drums
mix = dry + verb(music, 0.22) + verb(fx, 0.18) + verb(drums, 0.08)
mix = hp(mix.T, 25).T
# gentle glue, then level
mix = np.tanh(mix * 1.4) / 1.4
rms = np.sqrt((mix ** 2).mean()); mix *= 10 ** (-17.5 / 20) / rms
peak = np.abs(mix).max(); ceil = 10 ** (-4.0 / 20)
if peak > ceil:
    mix = np.tanh(mix / ceil * 0.95) * ceil
fade = np.ones(N); fl = int(0.8 * SR); fade[-fl:] = np.linspace(1, 0, fl) ** 2
mix *= fade[:, None]
from scipy.io import wavfile
wavfile.write('score.wav', SR, (mix * 32767).astype(np.int16))
print('score.wav', f'peak {20*np.log10(np.abs(mix).max()):.1f} dBFS', f'rms {20*np.log10(np.sqrt((mix**2).mean())):.1f} dBFS')
