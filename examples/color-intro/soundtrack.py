"""Synthesize a 30 s, 120 BPM soundtrack that hits the scene cuts (4, 9, 15, 21, 26 s).
Usage: python3 soundtrack.py out.wav   (needs numpy)"""
import sys, wave
import numpy as np

SR, DUR, BEAT = 44100, 30.0, 0.5
n = int(SR * DUR); t = np.arange(n) / SR
L = np.zeros(n); Rt = np.zeros(n)
rng = np.random.default_rng(3)

def add(sig, start, pan=0.0, gain=1.0):
    i = int(start * SR); sig = sig[: max(0, n - i)]
    L[i:i + len(sig)] += sig * gain * (1 - pan) ** .5
    Rt[i:i + len(sig)] += sig * gain * (1 + pan) ** .5

def env(d, a=.005, rel=None):
    m = int(d * SR); e = np.ones(m); k = int(a * SR)
    e[:k] = np.linspace(0, 1, k) if k else 1
    return e

def kick(g=1.0):
    d = .45; tt = np.arange(int(d * SR)) / SR
    f = 45 + 120 * np.exp(-tt * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7) * g

def hat(d=.06, g=.25):
    x = rng.standard_normal(int(d * SR)); x = np.diff(x, prepend=0)
    return x * np.exp(-np.arange(len(x)) / SR * 60) * g

def clap(g=.5):
    x = rng.standard_normal(int(.25 * SR)); tt = np.arange(len(x)) / SR
    e = np.exp(-tt * 18) + .6 * np.exp(-((tt - .012) * 400) ** 2) + .6 * np.exp(-((tt - .024) * 400) ** 2)
    return np.diff(x, prepend=0) * e * g

def impact(g=1.0, d=3.0):
    tt = np.arange(int(d * SR)) / SR
    sub = np.sin(2 * np.pi * np.cumsum(30 + 60 * np.exp(-tt * 4)) / SR) * np.exp(-tt * 1.3)
    nz = rng.standard_normal(len(tt)) * np.exp(-tt * 3) * .35
    return (sub + nz) * g

def riser(d, g=.35):
    tt = np.arange(int(d * SR)) / SR
    nz = rng.standard_normal(len(tt))
    # crude sweeping band: highpass-ish by differencing, amplitude up
    nz = np.diff(nz, prepend=0) * (tt / d) ** 2
    tone = np.sin(2 * np.pi * np.cumsum(200 + 1800 * (tt / d) ** 2) / SR) * (tt / d) ** 2 * .4
    return (nz * .6 + tone) * g

def saw(f, d, bright=6):
    tt = np.arange(int(d * SR)) / SR
    return sum(np.sin(2 * np.pi * f * k * tt) / k for k in range(1, bright + 1))

def pad(freqs, start, d, g=.08):
    tt = np.arange(int(d * SR)) / SR
    e = np.minimum(1, tt / .8) * np.minimum(1, (d - tt) / 1.0)
    for i, f in enumerate(freqs):
        for det in (-.004, .004):
            add(saw(f * (1 + det), d, 4) * e * g, start, pan=(-.5 if det < 0 else .5))

def pluck(f, g=.18, d=.3):
    tt = np.arange(int(d * SR)) / SR
    return saw(f, d, 5) * np.exp(-tt * 14) * g

# chord progression (A minor -> F -> C -> G), one chord per 2 s
A, F, C, G = [220, 261.6, 329.6], [174.6, 220, 261.6], [196*1.0, 261.6, 329.6], [196, 246.9, 293.7]
prog = [A, F, C, G]
bassroot = [55, 43.65, 65.4, 49]

# 0-4 ignition: rising drone into the burst at 1.0
tt = t[: int(4 * SR)]
drone = np.sin(2 * np.pi * 55 * tt) * np.minimum(1, tt / 1.0) * np.exp(-np.maximum(0, tt - 1) * .6) * .25
add(drone, 0)
add(riser(1.0, .25), 0)
add(impact(.9, 3.0), 1.0)
pad(A, 1.0, 3.2, .05)

# 4-9 prism: pad + soft kick, riser into 9
for s in range(4):
    pad(prog[s % 4], 4 + s * 1.25, 1.4, .05)
for b in np.arange(4, 9, BEAT):
    add(kick(.55), b)
add(riser(1.5, .35), 7.5)

# 9-15 galaxy: kick, offbeat hats, bass, arps
for b in np.arange(9, 15, BEAT):
    add(kick(.8), b)
    add(hat(), b + .25, pan=.3)
for i, b in enumerate(np.arange(9, 15, 2.0)):
    ch = prog[i % 4]
    pad(ch, b, 2.0, .045)
    for k in range(16):
        add(pluck(ch[k % 3] * (2 if k % 4 > 1 else 1)), b + k * .125, pan=(-.6 if k % 2 else .6))
    for k in range(4):
        add(saw(bassroot[i % 4], .45, 3) * np.exp(-np.arange(int(.45 * SR)) / SR * 5) * .22, b + k * .5)
add(riser(1.2, .4), 13.8)
add(impact(.7, 1.5), 14.4)

# 15-21 beats: four-on-the-floor + claps, 16th hats in the fast part
for b in np.arange(15, 21, BEAT):
    add(kick(1.0), b)
    add(saw(bassroot[int((b - 15) / 2) % 4] * 2, .22, 3) * np.exp(-np.arange(int(.22 * SR)) / SR * 10) * .25, b + .25)
for b in np.arange(15.5, 21, 1.0):
    add(clap(.45), b)
for b in np.arange(15, 18.5, .25):
    add(hat(.05, .2), b, pan=-.3)
for b in np.arange(18.5, 21, .125):
    add(hat(.04, .22), b, pan=.3 if int(b * 8) % 2 else -.3)
for i, b in enumerate(np.arange(15, 21, 2.0)):
    pad(prog[i % 4], b, 2.0, .05)
add(riser(1.5, .45), 19.5)

# 21-26 tunnel: full groove, fast arps up an octave
for b in np.arange(21, 26, BEAT):
    add(kick(1.0), b); add(hat(), b + .25)
for b in np.arange(21.5, 26, 1.0):
    add(clap(.4), b)
for i, b in enumerate(np.arange(21, 26, 2.0)):
    ch = prog[i % 4]
    pad(ch, b, min(2.0, 26 - b), .05)
    for k in range(int(min(2.0, 26 - b) / .125)):
        add(pluck(ch[k % 3] * 2 * (1.5 if k % 8 == 7 else 1), .14), b + k * .125, pan=np.sin(k))
add(riser(2.0, .5), 24.0)

# 26-30 title: big hit + sustained A major-ish pad
add(impact(1.2, 4.0), 26.0)
add(kick(1.2), 26.0)
pad([110, 220, 277.2, 329.6, 440], 26.0, 4.0, .05)
for k, f in enumerate([440, 554.4, 659.3, 880]):
    add(pluck(f, .15, .8), 26.2 + k * .16, pan=(k - 1.5) / 2)

# master: fade in/out, soft clip, normalize
fade = np.minimum(1, t / .05) * np.minimum(1, (DUR - t) / 1.0)
st = np.stack([L, Rt], 1) * fade[:, None]
st = np.tanh(st * 1.2)
st /= np.abs(st).max() / .9
pcm = (st * 32767).astype('<i2')
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok')
