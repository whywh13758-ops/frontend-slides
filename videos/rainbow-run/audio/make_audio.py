"""Synthesise the soundtrack for the v4 promo: UI sound effects + a 120 BPM placeholder groove.

Every cue comes from audio/cues.json (exported from the timeline by audio/dump.cjs), so the
sound stays locked to the picture. The groove is original and royalty-free; swap it for a
licensed track (e.g. 《此生不换》) later — the drop lands on the volume-max moment at MUSIC.drop.

Usage: python3 audio/make_audio.py audio/cues.json out/soundtrack.wav
"""
import json
import sys
import wave

import numpy as np

SR = 44100
rng = np.random.default_rng(7)


# ----------------------------------------------------------------- helpers
def tt(dur):
    return np.arange(int(dur * SR)) / SR


def fft_filter(x, lo=None, hi=None, order=2.0):
    """Zero-phase band shaping in the frequency domain (fine for short buffers)."""
    n = len(x)
    if n < 8:
        return x
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    g = np.ones_like(f)
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    return np.fft.irfft(X * g, n)


def env_ad(n, a, d, curve=6.0):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), np.exp(-(t - a) * curve / max(d, 1e-4)))
    return e


def saw(freq, t, detune=0.0):
    f = freq * (2 ** (detune / 1200))
    return 2 * ((t * f + rng.random()) % 1.0) - 1


def note_hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


class Bus:
    def __init__(self, dur):
        self.L = np.zeros(int(dur * SR) + SR)
        self.R = np.zeros_like(self.L)

    def add(self, t, sig, gain=1.0, pan=0.0):
        i = int(t * SR)
        if i < 0:
            sig = sig[-i:]
            i = 0
        j = min(len(self.L), i + len(sig))
        if j <= i:
            return
        s = sig[: j - i] * gain
        self.L[i:j] += s * np.sqrt(0.5 * (1 - pan))
        self.R[i:j] += s * np.sqrt(0.5 * (1 + pan))


def reverb(L, R, secs=1.6, mix=0.18, damp=5000):
    n = int(secs * SR)
    t = np.arange(n) / SR
    out = []
    for ch, seed in ((L, 1), (R, 2)):
        ir = np.random.default_rng(seed).standard_normal(n) * np.exp(-t * 6.0 / secs)
        ir = fft_filter(ir, hi=damp)
        ir[: int(0.012 * SR)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        size = 1 << int(np.ceil(np.log2(len(ch) + n)))
        wet = np.fft.irfft(np.fft.rfft(ch, size) * np.fft.rfft(ir, size), size)[: len(ch)]
        out.append(ch + wet * mix)
    return out


# ------------------------------------------------------------------- SFX
def sfx_click(g=1.0):
    t = tt(0.06)
    s = np.sin(2 * np.pi * 2300 * t) * np.exp(-t * 160) * 0.5
    s += fft_filter(rng.standard_normal(len(t)), lo=1500, hi=9000) * np.exp(-t * 420) * 0.6
    s += np.sin(2 * np.pi * 180 * t) * np.exp(-t * 90) * 0.25
    return s * g


def sfx_key():
    t = tt(0.07)
    f = rng.uniform(1700, 2600)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 200) * 0.35
    s += fft_filter(rng.standard_normal(len(t)), lo=2000, hi=8000) * np.exp(-t * 350) * 0.55
    s += np.sin(2 * np.pi * 140 * t) * np.exp(-t * 120) * 0.2
    return s


def sfx_tick(g=1.0):
    t = tt(0.05)
    return (np.sin(2 * np.pi * 3200 * t) * np.exp(-t * 260) * 0.35 + np.sin(2 * np.pi * 1600 * t) * np.exp(-t * 200) * 0.15) * g


def sfx_whoosh(dur=0.6, direction=1):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    lo_band = fft_filter(noise, lo=150, hi=900)
    hi_band = fft_filter(noise, lo=1200, hi=6000)
    p = t / dur
    sweep = p if direction > 0 else 1 - p
    s = lo_band * (1 - sweep) + hi_band * sweep * 0.7
    shape = np.sin(np.pi * np.clip(p, 0, 1)) ** 1.6
    tone = np.sin(2 * np.pi * np.cumsum(200 + 500 * (sweep if direction > 0 else 1 - sweep)) / SR) * 0.08
    return (s * 0.55 + tone) * shape


def sfx_pop(p=1.0, g=1.0):
    t = tt(0.16)
    f = (900 * p) * np.exp(-t * 22) + 260 * p
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 28)
    s += fft_filter(rng.standard_normal(len(t)), lo=2000) * np.exp(-t * 300) * 0.15
    return s * 0.6 * g


def bell(freq, dur=1.4, bright=1.0):
    t = tt(dur)
    s = np.sin(2 * np.pi * freq * t) * np.exp(-t * 3.2)
    s += np.sin(2 * np.pi * freq * 2.0 * t) * np.exp(-t * 5) * 0.35 * bright
    s += np.sin(2 * np.pi * freq * 3.01 * t) * np.exp(-t * 8) * 0.18 * bright
    s += np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t * 14) * 0.08 * bright
    att = np.minimum(1, t / 0.003)
    return s * att


def sfx_ding():
    a = bell(note_hz(88), 1.2) * 0.5
    b = bell(note_hz(95), 1.2) * 0.25
    return a + b


def sfx_chime():
    out = np.zeros(int(1.4 * SR))
    for k, (m, d) in enumerate(((84, 0.0), (91, 0.09))):
        b = bell(note_hz(m), 1.2) * 0.45
        i = int(d * SR)
        out[i:i + len(b)] += b[: len(out) - i]
    return out


def sfx_riser(dur=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    f = 180 * 2 ** (p * 2.6)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * 0.12
    noise = fft_filter(rng.standard_normal(n), lo=800, hi=9000)
    s = (tone + noise * 0.35 * p) * p ** 1.8
    s[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
    return s


def sfx_boom():
    t = tt(2.6)
    f = 46 + 90 * np.exp(-t * 9)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6) * 1.0
    hit = fft_filter(rng.standard_normal(len(t)), hi=2500) * np.exp(-t * 18) * 0.7
    crash = fft_filter(rng.standard_normal(len(t)), lo=4500) * np.exp(-t * 1.9) * 0.35
    sparkle = np.zeros_like(t)
    for _ in range(18):
        b = bell(rng.uniform(1800, 4200), 0.9, 0.6) * rng.uniform(0.05, 0.12)
        i = int(rng.uniform(0.02, 1.2) * SR)
        sparkle[i:i + len(b)] += b[: len(t) - i]
    return sub + hit + crash + sparkle


def sfx_thump(p=1.0, g=1.0):
    t = tt(0.35)
    f = (70 * p) + 120 * np.exp(-t * 40)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)
    s += fft_filter(rng.standard_normal(len(t)), hi=3000) * np.exp(-t * 60) * 0.3
    return s * 0.7 * g


def sfx_swipe():
    s = sfx_whoosh(0.42, 1) * 0.9
    t = tt(0.42)
    s += fft_filter(rng.standard_normal(len(t)), lo=3000, hi=10000) * np.exp(-((t - 0.12) / 0.07) ** 2) * 0.25
    return s


def sfx_heart():
    s = sfx_pop(1.25, 1.2)
    b = bell(note_hz(96), 0.9) * 0.25
    out = np.zeros(max(len(s), len(b) + 2000))
    out[: len(s)] += s
    out[1500:1500 + len(b)] += b
    return out


def sfx_sparkle(n=14, spread=1.0):
    out = np.zeros(int((spread + 1.0) * SR))
    for _ in range(n):
        b = bell(rng.uniform(2000, 5200), 0.8, 0.5) * rng.uniform(0.05, 0.13)
        i = int(rng.uniform(0, spread) * SR)
        out[i:i + len(b)] += b[: len(out) - i]
    return out


def sfx_success():
    out = np.zeros(int(2.4 * SR))
    for m, d in ((76, 0.0), (79, 0.07), (84, 0.14), (88, 0.21)):
        b = bell(note_hz(m), 2.0) * 0.32
        i = int(d * SR)
        out[i:i + len(b)] += b[: len(out) - i]
    out[: int(1.4 * SR)] += sfx_sparkle(12, 0.6)[: int(1.4 * SR)] * 0.8
    return out


def sfx_appear():
    s = sfx_whoosh(0.5, 1) * 0.5
    b = bell(note_hz(84), 0.8) * 0.12
    out = np.zeros(int(0.9 * SR))
    out[: len(s)] += s
    out[int(0.2 * SR):int(0.2 * SR) + len(b)] += b[: len(out) - int(0.2 * SR)]
    return out


# ------------------------------------------------------------------ music
def kick():
    t = tt(0.45)
    f = 48 + 120 * np.exp(-t * 30)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5)
    s += fft_filter(rng.standard_normal(len(t)), lo=1000) * np.exp(-t * 400) * 0.25
    return s * 0.95


def clap():
    t = tt(0.3)
    n = fft_filter(rng.standard_normal(len(t)), lo=900, hi=4200)
    e = np.zeros_like(t)
    for d in (0.0, 0.011, 0.022):
        e += np.where(t >= d, np.exp(-(t - d) * 60), 0) * 0.6
    e += np.where(t >= 0.03, np.exp(-(t - 0.03) * 14), 0)
    return n * e * 0.45


def hat(open_=False):
    d = 0.22 if open_ else 0.05
    t = tt(d + 0.05)
    s = fft_filter(rng.standard_normal(len(t)), lo=7000) * np.exp(-t * (14 if open_ else 80))
    return s * (0.22 if open_ else 0.18)


def supersaw(freq, dur, cutoff, voices=(-9, 0, 9), a=0.01, d=0.25, sustain=None):
    t = tt(dur)
    s = sum(saw(freq, t, dt) for dt in voices) / len(voices)
    s = fft_filter(s, hi=cutoff, order=1.5)
    if sustain is None:
        e = env_ad(len(t), a, d, 5.0)
    else:
        e = np.minimum(1, t / a) * (sustain + (1 - sustain) * np.exp(-t * 4))
        rel = int(0.08 * SR)
        e[-rel:] *= np.linspace(1, 0, rel)
    return s * e


def bass_note(freq, dur):
    t = tt(dur)
    s = fft_filter(saw(freq, t), hi=520, order=2) * 0.7 + np.sin(2 * np.pi * freq * t) * 0.6
    e = np.minimum(1, t / 0.006) * (0.65 + 0.35 * np.exp(-t * 10))
    rel = min(len(t), int(0.04 * SR))
    e[-rel:] *= np.linspace(1, 0, rel)
    return s * e


def pluck(freq, dur=0.35):
    t = tt(dur)
    s = np.sign(np.sin(2 * np.pi * freq * t)) * 0.5 + np.sin(2 * np.pi * freq * 2 * t) * 0.25
    s = fft_filter(s, hi=3800)
    return s * np.exp(-t * 9) * np.minimum(1, t / 0.003)


CHORDS = [  # C – G – Am – F  (bright I–V–vi–IV)
    (48, [60, 64, 67, 72]),
    (43, [59, 62, 67, 71]),
    (45, [60, 64, 69, 72]),
    (41, [60, 65, 69, 72]),
]
MELODY = [  # (beat offset within 2 bars, midi, length in beats)
    (0.0, 79, 0.5), (0.5, 76, 0.5), (1.0, 79, 0.5), (1.5, 81, 0.5), (2.0, 79, 1.0), (3.0, 76, 0.5), (3.5, 74, 0.5),
    (4.0, 76, 0.5), (4.5, 74, 0.5), (5.0, 72, 0.5), (5.5, 74, 0.5), (6.0, 76, 1.5), (7.5, 79, 0.5),
]


def build_music(bus, M, dur):
    beat = 60 / M['bpm']
    bar = beat * 4
    drop = M['drop']
    play = M['play']
    t_break0, t_redrop = M['starEnd'], drop + bar * round((M['album'] - drop) / bar + 0.25)
    end_pill, cta = M['endPill'], M['cta']
    party0, party1 = M['party']
    frz0, frz1 = M['frozen']

    def bar_of(t):
        return int(np.floor((t - drop) / bar + 1e-6))

    def chord(t):
        return CHORDS[bar_of(t) % 4]

    kicks = []
    # grid of 16ths from the first beat after play to the end
    k0 = int(np.ceil((play - drop) / (beat / 2)))
    k1 = int(np.floor((dur - drop) / (beat / 2)))
    for k in range(k0, k1):
        t = drop + k * beat / 2
        on_beat = k % 2 == 0
        in_intro = t < drop
        in_break = t_break0 <= t < t_redrop
        outro = t >= end_pill
        if t >= cta + 0.05:
            break
        full = not in_intro and not in_break and not outro
        root, notes = chord(t)
        # drums
        if full and on_beat:
            bus['drums'].add(t, kick(), 1.0)
            kicks.append(t)
            if (k // 2) % 2 == 1:
                bus['drums'].add(t, clap(), 0.9, 0.05)
        if (full or in_intro or outro) and not on_beat:
            bus['drums'].add(t, hat(open_=full and (k // 2) % 2 == 1), 0.8 if full else 0.45, 0.25)
        if full and on_beat:
            bus['drums'].add(t, hat(), 0.35, -0.25)
        # break: snare roll build into the re-drop
        if in_break and t >= t_redrop - bar:
            frac = (t - (t_redrop - bar)) / bar
            bus['drums'].add(t, clap(), 0.25 + 0.6 * frac, 0.0)
            if frac > 0.5:
                bus['drums'].add(t + beat / 4, clap(), 0.2 + 0.6 * frac, 0.0)
        # bass: 8ths on the root, pumping
        if full:
            f = note_hz(root - 12 + (12 if (k % 4) == 2 else 0) * 0)
            gain = 1.15 if party0 <= t < party1 else 0.9
            bus['bass'].add(t, bass_note(note_hz(root - 12) if k % 2 == 0 else note_hz(root), beat / 2 * 0.95), gain)
        # chord stabs on off-beats, pad in intro / break / outro
        cutoff = 4200 if full else (1400 if in_intro else 2200)
        if full and not on_beat:
            for m in notes:
                bus['chords'].add(t, supersaw(note_hz(m), 0.3, cutoff, d=0.22), 0.13, rng.uniform(-0.4, 0.4))
        if (k % 8 == 0) and (in_intro or in_break or outro or t < drop + 0.01):
            for m in notes:
                bus['pad'].add(t, supersaw(note_hz(m - 12), bar * 1.02, cutoff * 0.7, voices=(-12, -4, 4, 12), a=0.25, sustain=0.75), 0.11, rng.uniform(-0.6, 0.6))
        # lead: melody over 2-bar loop in the drops
        if full:
            pos = ((t - drop) / beat) % 8
            for off, m, ln in MELODY:
                if abs(pos - off) < 1e-3:
                    pl = pluck(note_hz(m), beat * ln + 0.2)
                    bus['lead'].add(t, pl, 0.22, 0.15)
                    bus['lead'].add(t + beat * 0.75, pl, 0.08, -0.4)   # dotted-8th echo
                    bus['lead'].add(t + beat * 1.5, pl, 0.04, 0.4)
        # intro arpeggio
        if in_intro and t >= play:
            m = notes[(k // 1) % len(notes)] + 12
            bus['lead'].add(t, pluck(note_hz(m), 0.3), 0.12, 0.3 * (1 if k % 2 else -1))
        # frozen section: twinkling bells
        if frz0 <= t < frz1 and on_beat and rng.random() < 0.7:
            bus['lead'].add(t, bell(note_hz(rng.choice([84, 86, 88, 91, 93, 96])), 1.2), 0.08, rng.uniform(-0.6, 0.6))
    # final chord on the CTA
    root, notes = CHORDS[0]
    for m in notes + [84]:
        bus['pad'].add(cta, supersaw(note_hz(m), 4.5, 3400, voices=(-14, -5, 5, 14), a=0.01, sustain=0.25), 0.09, rng.uniform(-0.5, 0.5))
    bus['bass'].add(cta, bass_note(note_hz(36), 3.0), 1.0)
    bus['drums'].add(cta, kick(), 1.0)
    bus['drums'].add(cta, fft_filter(rng.standard_normal(int(3 * SR)), lo=4000) * np.exp(-tt(3) * 1.6) * 0.3, 1.0)
    kicks.append(cta)
    return kicks


def main(cues_path, out_path):
    cues = json.load(open(cues_path))
    dur = cues['duration']
    M = cues['music']
    n = int(dur * SR)

    # ---- music
    buses = {k: Bus(dur) for k in ('drums', 'bass', 'chords', 'pad', 'lead')}
    kicks = build_music(buses, M, dur)
    t = np.arange(len(buses['drums'].L)) / SR
    duck = np.ones_like(t)
    for k in kicks:
        i = int(k * SR)
        seg = np.arange(min(len(t) - i, int(0.35 * SR))) / SR
        duck[i:i + len(seg)] = np.minimum(duck[i:i + len(seg)], 1 - 0.55 * np.exp(-seg * 9))
    mus_L = buses['drums'].L * 1.0 + (buses['bass'].L + buses['chords'].L) * duck + buses['pad'].L * (0.6 + 0.4 * duck) + buses['lead'].L
    mus_R = buses['drums'].R * 1.0 + (buses['bass'].R + buses['chords'].R) * duck + buses['pad'].R * (0.6 + 0.4 * duck) + buses['lead'].R
    mus_L, mus_R = reverb(mus_L, mus_R, 1.4, 0.16)
    # player volume automation: starts at play, follows the volume drag, lands on the drop
    v0, v1, a, b = M['vol']
    p = np.clip((t - v0) / (v1 - v0), 0, 1)
    ease = np.where(p < 0.5, 2 * p * p, 1 - (-2 * p + 2) ** 2 / 2)
    vol = (a + (b - a) * ease) / 100
    gate = np.clip((t - M['play']) / 0.04, 0, 1)
    fade = np.clip((dur - 0.05 - t) / 2.5, 0, 1)
    mg = vol ** 1.4 * gate * fade
    mus_L *= mg
    mus_R *= mg

    # ---- sfx
    fxb = Bus(dur)
    mk = {
        'click': lambda e: sfx_click(e.get('g', 1.0)),
        'key': lambda e: sfx_key() * e.get('g', 1.0),
        'tick': lambda e: sfx_tick(e.get('g', 1.0)),
        'whoosh': lambda e: sfx_whoosh(e.get('dur', 0.6), e.get('dir', 1)) * e.get('g', 1.0),
        'pop': lambda e: sfx_pop(e.get('p', 1.0), e.get('g', 1.0)),
        'ding': lambda e: sfx_ding(),
        'chime': lambda e: sfx_chime() * e.get('g', 1.0),
        'riser': lambda e: sfx_riser(e.get('dur', 1.0)),
        'boom': lambda e: sfx_boom(),
        'thump': lambda e: sfx_thump(e.get('p', 1.0), e.get('g', 1.0)),
        'swipe': lambda e: sfx_swipe(),
        'heart': lambda e: sfx_heart(),
        'sparkle': lambda e: sfx_sparkle(),
        'success': lambda e: sfx_success(),
        'appear': lambda e: sfx_appear(),
        'type': lambda e: sum_keys(),
        'spin': lambda e: spin_ticks(e.get('dur', 0.5)),
    }

    def sum_keys():
        out = np.zeros(int(0.5 * SR))
        for i in range(9):
            k = sfx_key() * 0.5
            j = int(i * 0.035 * SR)
            out[j:j + len(k)] += k[: len(out) - j]
        return out

    def spin_ticks(d):
        out = np.zeros(int((d + 0.1) * SR))
        for i in range(int(d / 0.09)):
            k = sfx_tick(0.35)
            j = int(i * 0.09 * SR)
            out[j:j + len(k)] += k[: len(out) - j]
        return out

    for e in cues['sfx']:
        sig = mk[e['type']](e)
        pan = {'swipe': -0.2, 'whoosh': 0.0}.get(e['type'], rng.uniform(-0.15, 0.15))
        fxb.add(e['t'], sig, 0.8, pan)
    fx_L, fx_R = reverb(fxb.L, fxb.R, 1.1, 0.12, 7000)

    L = (mus_L * 0.9 + fx_L * 1.0)[:n]
    R = (mus_R * 0.9 + fx_R * 1.0)[:n]
    # gentle bus compression / limiting
    peak = max(np.max(np.abs(L)), np.max(np.abs(R)), 1e-6)
    L, R = L / peak * 1.4, R / peak * 1.4
    L, R = np.tanh(L) / np.tanh(1.4) * 0.9, np.tanh(R) / np.tanh(1.4) * 0.9
    data = (np.stack([L, R], 1) * 32767).astype(np.int16)
    with wave.open(out_path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f'wrote {out_path}: {dur:.2f}s, {len(cues["sfx"])} sfx cues')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
