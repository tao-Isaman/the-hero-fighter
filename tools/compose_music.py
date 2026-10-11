"""Compose and render the fight music (original, synthesized, no samples).

usage: python3 tools/compose_music.py      (needs numpy and ffmpeg; writes web/assets/fightmusic/*.mp3)

Each track is a Thai-flavoured chiptune loop: a pentatonic melody on a reedy "pi" lead and a
"ranat" (xylophone) voice, "khong wong" gong-circle ostinato, ching/chap cymbals, klong/taphon
drums and a pulsing bass. Tracks loop seamlessly: the reverb tail is wrapped to the start.
"""
import subprocess
from pathlib import Path

import numpy as np

SR = 44100
OUT = Path(__file__).resolve().parent.parent / "web" / "assets" / "fightmusic"
rng = np.random.default_rng(7)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ---------- instruments: each returns a mono numpy array ----------
def env_exp(n, k, attack=0.002):
    t = np.arange(n) / SR
    a = np.minimum(1, t / attack) if attack > 0 else 1
    return a * np.exp(-k * t)


def partials(f, dur, parts, attack=0.002):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for ratio, amp, k in parts:
        if f * ratio > SR / 2 - 500:
            continue
        out += amp * np.sin(2 * np.pi * f * ratio * t + rng.uniform(0, 6.28)) * env_exp(n, k, attack)
    return out


def ranat(f, dur):
    # hard mallet on a wooden bar: strong fundamental, inharmonic overtones, quick decay
    x = partials(f, max(dur, 0.5), [(1, 1.0, 7), (3.93, 0.32, 16), (9.1, 0.08, 40), (2.0, 0.08, 10)])
    click = rng.uniform(-1, 1, int(0.006 * SR)) * np.linspace(0.25, 0, int(0.006 * SR))
    x[: len(click)] += click
    return x


def khong(f, dur=0.9):
    # small tuned gongs: bell-like partials with a long ring
    return partials(f, dur, [(1, 1.0, 4.5), (2.0, 0.22, 7), (2.76, 0.3, 9), (5.4, 0.08, 18)], attack=0.003)


def gong(f, dur=3.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    bend = 1 + 0.015 * np.exp(-t * 6)        # the big gong's pitch sags as it blooms
    out = np.zeros(n)
    for ratio, amp, k in [(1, 1.0, 1.0), (1.48, 0.5, 1.6), (2.03, 0.4, 2.2), (2.74, 0.25, 3.0), (3.9, 0.12, 4)]:
        ph = 2 * np.pi * np.cumsum(f * ratio * bend) / SR
        out += amp * np.sin(ph) * env_exp(n, k, 0.02)
    return out


def lead(f, dur, vib=0.006, bright=9):
    # reedy "pi" lead: band-limited saw with delayed vibrato and a short swell
    n = int((dur + 0.06) * SR)
    t = np.arange(n) / SR
    vdepth = vib * np.clip((t - 0.12) / 0.15, 0, 1)
    fr = f * (1 + vdepth * np.sin(2 * np.pi * 5.6 * t))
    ph = 2 * np.pi * np.cumsum(fr) / SR
    x = np.zeros(n)
    for h in range(1, bright + 1):
        if f * h > SR / 2 - 1000:
            break
        x += np.sin(h * ph) / h * (0.85 if h % 2 == 0 else 1.0)
    a = np.clip(t / 0.018, 0, 1) * np.clip((dur + 0.06 - t) / 0.06, 0, 1)
    return x * a * 0.5


def bass(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * f * t
    x = np.sin(ph) + 0.33 * np.sin(3 * ph) + 0.18 * np.sin(5 * ph) + 0.1 * np.sin(2 * ph)
    return x * env_exp(n, 3.5, 0.004) * np.clip((dur - t) / 0.02, 0, 1)


def kick():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 9, 0.001) * 1.2


def slap():
    # taphon / klong slap: pitched skin plus a noise crack
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    f = 190 + 120 * np.exp(-t * 40)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 16)
    crack = bandnoise(n, 1500, 5000) * env_exp(n, 30)
    return body * 0.7 + crack * 0.6


def bandnoise(n, lo, hi):
    spec = np.fft.rfft(rng.uniform(-1, 1, n))
    fr = np.fft.rfftfreq(n, 1 / SR)
    spec[(fr < lo) | (fr > hi)] = 0
    x = np.fft.irfft(spec, n)
    return x / (np.abs(x).max() + 1e-9)


def ching(open_=True):
    # small cymbals: "ching" rings open, "chap" is pressed closed
    dur = 0.7 if open_ else 0.08
    n = int(dur * SR)
    k = 5 if open_ else 45
    x = partials(1, dur, [], 0)
    t = np.arange(n) / SR
    for fq, a in [(5180, 0.5), (7330, 0.35), (9020, 0.25), (6110, 0.3)]:
        x += a * np.sin(2 * np.pi * fq * t) * env_exp(n, k * 1.2)
    x += bandnoise(n, 6000, 14000) * env_exp(n, k * 2) * 0.6
    return x * 0.35


DRUMS = {"K": (kick, 0.9), "S": (slap, 0.55), "o": (lambda: ching(True), 0.5), "x": (lambda: ching(False), 0.45)}


# ---------- composing ----------
class Song:
    def __init__(self, bpm, root, scale, bars):
        self.step = 60 / bpm / 4                          # one 16th note in seconds
        self.root, self.scale = root, scale
        self.bar_len = 16 * self.step
        n = int((bars * self.bar_len + 4) * SR)
        self.bus = {k: np.zeros(n) for k in ("lead", "ranat", "khong", "bass", "drums", "fx")}
        self.bars = bars

    def note(self, deg, octave=0):
        o, d = divmod(deg, len(self.scale))
        return mtof(self.root + 12 * (o + octave) + self.scale[d])

    def put(self, bus, x, t, gain):
        i = int(t * SR)
        x = x[: max(0, len(self.bus[bus]) - i)]
        self.bus[bus][i : i + len(x)] += x * gain

    def at(self, bar, step):
        return bar * self.bar_len + step * self.step

    # melody: list of (length in 16ths, degree or None) starting at bar
    def melody(self, bar, phrase, voice="lead", octave=0, gain=0.5, kro=True):
        s = 0
        for ln, deg in phrase:
            if deg is not None:
                t, f, d = self.at(bar, s), self.note(deg, octave), ln * self.step
                if voice == "lead":
                    self.put("lead", lead(f, d * 0.92), t, gain)
                else:
                    # ranat "kro": long notes are played as fast repeated strokes
                    reps = max(1, ln // 2) if kro and ln >= 4 else 1
                    for r in range(reps):
                        self.put("ranat", ranat(f, 0.5), t + r * 2 * self.step, gain * (1 if r == 0 else 0.6))
            s += ln

    def drums(self, bar, pattern, gain=1.0):
        for i, ch in enumerate(pattern.replace(" ", "")):
            if ch in DRUMS:
                fn, g = DRUMS[ch]
                self.put("drums", fn(), self.at(bar, i), g * gain * rng.uniform(0.9, 1.05))

    def bassline(self, bar, chord, pattern=((0, 0, 2), (3, 0, 2), (6, 5, 2), (8, 0, 2), (11, 0, 2), (14, 5, 2)), gain=0.55):
        for step, off, ln in pattern:
            self.put("bass", bass(self.note(chord + off, -2), ln * self.step * 0.95), self.at(bar, step), gain)

    def khongs(self, bar, chord, figure, gain=0.22, every=2):
        for i, off in enumerate(figure):
            if off is not None:
                self.put("khong", khong(self.note(chord + off, 1)), self.at(bar, i * every), gain)

    def gong(self, bar, gain=0.5):
        self.put("fx", gong(self.note(0, -2)), self.at(bar, 0), gain)

    def run(self, bar, degs, voice="ranat", octave=1, gain=0.4):
        self.melody(bar, [(1, d) for d in degs], voice, octave, gain, kro=False)

    def render(self, name, title):
        mix = (self.bus["lead"] * 0.9 + self.bus["ranat"] * 0.8 + self.bus["khong"] + self.bus["bass"]
               + self.bus["drums"] * 0.8 + self.bus["fx"] * 0.7)
        # a small room: exponentially decaying noise as the impulse response (FFT convolution)
        ir_n = int(1.1 * SR)
        ir = rng.uniform(-1, 1, ir_n) * np.exp(-np.arange(ir_n) / SR * 5.5)
        ir /= np.sqrt((ir ** 2).sum())
        wet_src = self.bus["lead"] * 0.9 + self.bus["ranat"] * 0.8 + self.bus["khong"] + self.bus["fx"] * 0.7
        size = 1 << int(np.ceil(np.log2(len(wet_src) + ir_n)))
        wet = np.fft.irfft(np.fft.rfft(wet_src, size) * np.fft.rfft(ir, size), size)[: len(mix)]
        mix = mix + wet * 0.22
        # seamless loop: fold everything past the last bar back onto the start
        loop_n = int(self.bars * self.bar_len * SR)
        tail = mix[loop_n:]
        mix = mix[:loop_n].copy()
        mix[: len(tail)] += tail
        # gentle saturation and level
        mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.6) / np.tanh(1.6) * 0.89
        pcm = (mix * 32767).astype("<i2").tobytes()
        OUT.mkdir(parents=True, exist_ok=True)
        dst = OUT / f"{name}.mp3"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-",
                        "-metadata", f"title={title}", "-metadata", "artist=mFighter",
                        "-c:a", "libmp3lame", "-b:a", "112k", str(dst)], input=pcm, check=True)
        print(f"{dst.relative_to(OUT.parent.parent.parent)}: {loop_n / SR:.1f}s")


# ---------- track 1: ศึกกลางทุ่ง (field brawl) — A minor pentatonic, driving ----------
def track1():
    s = Song(152, 57, [0, 3, 5, 7, 10], 44)
    A1 = [(2, 5), (2, 5), (4, 7), (2, 6), (2, 5), (4, 4),
          (2, 3), (2, 4), (4, 5), (8, 4),
          (2, 5), (2, 5), (4, 7), (2, 8), (2, 7), (2, 6), (2, 7),
          (4, 5), (4, 4), (8, 5)]
    A2 = A1[:-3] + [(2, 4), (2, 3), (4, 2), (8, 0)]
    B1 = [(4, 8), (4, 7), (2, 8), (2, 9), (4, 7),
          (6, 6), (2, 5), (8, 7),
          (4, 5), (4, 6), (2, 7), (2, 6), (4, 5),
          (6, 4), (2, 3), (8, 4)]
    B2 = B1[:-3] + [(4, 3), (4, 2), (8, 0)]
    progA, progB = [0, 4, 2, 0], [2, 1, 0, 3]
    groove = "K-x-oSK-x-K-oS-x"
    groove2 = "K-x-oSK-K-x-oSxS"
    fig = [0, 2, 1, 3, 0, 2, 4, 3]
    bar = 0
    # intro: drums and gongs build up
    s.gong(0)
    for b in range(4):
        s.drums(b, "K-------o-------" if b < 2 else "K-x-o-K-x-K-o-xS")
        s.khongs(b, 0, fig)
    bar = 4
    for sec, (mel, prog, voice) in enumerate([(A1, progA, "lead"), (A2, progA, "lead"), (B1, progB, "ranat"), (B2, progB, "ranat"),
                                              (A1, progA, "both"), (A2, progA, "both")]):
        for i in range(4):
            s.bassline(bar + i, prog[i])
            s.drums(bar + i, groove if i < 3 else groove2)
            s.khongs(bar + i, prog[i], fig, gain=0.16)
        if voice in ("lead", "both"):
            s.melody(bar, mel, "lead", 0, 0.42)
        if voice in ("ranat", "both"):
            s.melody(bar, mel, "ranat", 1 if voice == "both" else 0, 0.45)
        if sec in (0, 4):
            s.gong(bar, 0.4)
        bar += 4
    # break: ranat runs over the gongs, then a fill back to the top
    up = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 7, 6, 5, 4, 3]
    for i in range(4):
        s.drums(bar + i, "o-------o-------" if i < 3 else "K-K-S-K-SSKSSSSS")
        s.run(bar + i, [d + (i % 2) for d in up], gain=0.38)
        s.bassline(bar + i, [0, 2, 1, 3][i], ((0, 0, 8), (8, 0, 8)))
    bar += 4
    for i in range(4):
        s.drums(bar + i, groove)
        s.bassline(bar + i, progA[i])
        s.khongs(bar + i, progA[i], fig)
    s.melody(bar, [(4, 5), (4, 7), (8, 8), (4, 7), (4, 5), (8, 4), (4, 5), (4, 7), (8, 9), (8, 7), (8, 5)], "ranat", 0, 0.42)
    s.render("fight1", "ศึกกลางทุ่ง")


# ---------- track 2: เงาในซอย (back-alley shadows) — dark pentatonic, heavy half-time ----------
def track2():
    s = Song(128, 52, [0, 1, 5, 7, 10], 40)
    A1 = [(4, 5), (2, 6), (2, 5), (8, 3),
          (4, 4), (2, 3), (2, 2), (8, 3),
          (4, 5), (2, 6), (2, 7), (4, 8), (4, 7),
          (6, 6), (2, 5), (8, 5)]
    A2 = A1[:-3] + [(4, 3), (4, 1), (8, 0)]
    B1 = [(2, 8), (2, 8), (4, 9), (4, 8), (4, 6),
          (8, 7), (8, 5),
          (2, 6), (2, 6), (4, 7), (4, 6), (4, 3),
          (12, 4), (4, None)]
    B2 = B1[:-2] + [(4, 3), (4, 1), (8, 0)]
    progA, progB = [0, 0, 3, 1], [2, 3, 1, 0]
    groove = "K-----x-S--K-x--"
    groove2 = "K-----x-S--K-SxS"
    fig = [0, None, 3, 2, 0, None, 4, 3]
    s.gong(0, 0.6)
    for b in range(4):
        s.drums(b, "K-------x-------" if b < 3 else "K-----x-S--KSSSS")
        s.khongs(b, 0, fig, gain=0.26)
    bar = 4
    for sec, (mel, prog, voice) in enumerate([(A1, progA, "lead"), (A2, progA, "lead"), (B1, progB, "ranat"), (B2, progB, "both"),
                                              (A1, progA, "both"), (A2, progA, "lead")]):
        for i in range(4):
            s.bassline(bar + i, prog[i], ((0, 0, 3), (3, 0, 3), (6, 0, 2), (10, 0, 2), (12, 5, 2), (14, 0, 2)), 0.62)
            s.drums(bar + i, groove if i < 3 else groove2)
            s.khongs(bar + i, prog[i], fig, gain=0.2)
        if voice in ("lead", "both"):
            s.melody(bar, mel, "lead", -1 if voice == "lead" else 0, 0.46)
        if voice in ("ranat", "both"):
            s.melody(bar, mel, "ranat", 0, 0.45)
        if sec % 2 == 0:
            s.gong(bar, 0.45)
        bar += 4
    s.render("fight2", "เงาในซอย")


# ---------- track 3: พยัคฆ์คำราม (roar of the tiger) — D major pentatonic, fast and bright ----------
def track3():
    s = Song(164, 62, [0, 2, 4, 7, 9], 44)
    A1 = [(2, 5), (2, 6), (2, 7), (2, 8), (4, 7), (4, 5),
          (2, 6), (2, 7), (4, 6), (8, 4),
          (2, 5), (2, 6), (2, 7), (2, 8), (4, 9), (2, 8), (2, 7),
          (4, 8), (4, 6), (8, 7)]
    A2 = A1[:-3] + [(4, 6), (4, 4), (8, 5)]
    B1 = [(6, 9), (2, 8), (4, 7), (4, 8),
          (4, 7), (4, 6), (8, 5),
          (6, 7), (2, 6), (4, 5), (4, 6),
          (4, 4), (4, 3), (8, 4)]
    B2 = B1[:-3] + [(4, 6), (4, 7), (8, 5)]
    progA, progB = [0, 3, 4, 0], [3, 2, 1, 4]
    groove = "K-xSx-K-xSK-x-Sx"
    groove2 = "K-xSx-K-xSK-SSSS"
    fig = [0, 2, 4, 2, 5, 4, 2, 4]
    s.gong(0, 0.5)
    for b in range(4):
        s.drums(b, "K-o-K-o-K-o-K-o-" if b < 3 else "K-K-S-K-SSKSSSSS")
        s.run(b, [0, 2, 4, 2, 5, 4, 2, 4, 1, 3, 5, 3, 6, 5, 3, 5][:: 1 if b % 2 == 0 else -1], gain=0.3)
    bar = 4
    for sec, (mel, prog, voice) in enumerate([(A1, progA, "lead"), (A2, progA, "both"), (B1, progB, "ranat"), (B2, progB, "both"),
                                              (A1, progA, "both"), (A2, progA, "both")]):
        for i in range(4):
            s.bassline(bar + i, prog[i])
            s.drums(bar + i, groove if i < 3 else groove2)
            s.khongs(bar + i, prog[i], fig, gain=0.15, every=2)
        if voice in ("lead", "both"):
            s.melody(bar, mel, "lead", 0, 0.4)
        if voice in ("ranat", "both"):
            s.melody(bar, mel, "ranat", 1 if voice == "both" else 0, 0.42)
        if sec in (0, 2, 4):
            s.gong(bar, 0.4)
        bar += 4
    for i in range(4):
        s.drums(bar + i, "K---o---K---o---" if i < 3 else "K-K-S-K-SSKSSSSS")
        s.run(bar + i, [(d + i) for d in [0, 1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1]], gain=0.36)
        s.bassline(bar + i, [0, 3, 4, 3][i], ((0, 0, 4), (4, 5, 4), (8, 0, 4), (12, 5, 4)))
    s.render("fight3", "พยัคฆ์คำราม")


if __name__ == "__main__":
    track1()
    track2()
    track3()
