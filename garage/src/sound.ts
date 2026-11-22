// Every sound on the site is synthesised here with the Web Audio API: nothing to download.
// Browsers only allow audio after the visitor has clicked or tapped something, so the
// context is created by the first click that wants a sound (unlock), never on load.
import { useStore } from './store'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null

export function unlock() {
  try {
    if (!ctx) {
      const c = new AudioContext()
      const m = c.createGain()
      m.gain.value = useStore.getState().sound ? 1 : 0
      m.connect(c.destination)
      useStore.subscribe((s) => m.gain.setTargetAtTime(s.sound ? 1 : 0, c.currentTime, 0.05))
      ctx = c
      master = m
    }
    void ctx.resume()
  } catch {
    ctx = null
  }
  return ctx
}

// Sounds that run continuously (engines, rain) only start once a click has unlocked audio.
export const audioReady = () => ctx !== null && ctx.state === 'running'

function noise(c: AudioContext) {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const d = noiseBuffer.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const src = c.createBufferSource()
  src.buffer = noiseBuffer
  src.loop = true
  return src
}

const smooth = (p: AudioParam, v: number, c: AudioContext, t = 0.04) => p.setTargetAtTime(v, c.currentTime, t)

// A four-cylinder engine. The firing frequency (two pulses per revolution) drives a sawtooth
// with a sub-octave and a harmonic, soft-clipped and low-passed; the low-pass opens with the
// throttle. Intake roar is band-passed noise; `burble` adds the uneven beat of a flat-four;
// `hiss` is tyres on a wet road.
export class Engine {
  private c: AudioContext
  private oscs: OscillatorNode[] = []
  private main: OscillatorNode
  private sub: OscillatorNode
  private harm: OscillatorNode
  private pulse: OscillatorNode
  private beat: OscillatorNode
  private beatDepth: GainNode
  private filter: BiquadFilterNode
  private roar: BiquadFilterNode
  private roarGain: GainNode
  private hissGain: GainNode
  private out: GainNode
  private pan: StereoPannerNode
  private srcs: AudioBufferSourceNode[] = []

  constructor(c: AudioContext, dest: AudioNode) {
    this.c = c
    const osc = (type: OscillatorType) => {
      const o = c.createOscillator()
      o.type = type
      this.oscs.push(o)
      return o
    }
    this.main = osc('sawtooth')
    this.sub = osc('square')
    this.harm = osc('sawtooth')
    this.pulse = osc('sine')
    this.beat = osc('sine')

    const mix = c.createGain()
    const subGain = c.createGain()
    subGain.gain.value = 0.35
    const harmGain = c.createGain()
    harmGain.gain.value = 0.22
    this.main.connect(mix)
    this.sub.connect(subGain).connect(mix)
    this.harm.connect(harmGain).connect(mix)

    const shaper = c.createWaveShaper()
    const curve = new Float32Array(1024)
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / 1023) * 2 - 1) * 2.6)
    shaper.curve = curve
    this.filter = c.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.Q.value = 2

    // amplitude pulses: one per firing, plus the flat-four's beat
    const body = c.createGain()
    body.gain.value = 0.6
    const pulseDepth = c.createGain()
    pulseDepth.gain.value = 0.35
    this.pulse.connect(pulseDepth).connect(body.gain)
    this.beatDepth = c.createGain()
    this.beatDepth.gain.value = 0
    this.beat.connect(this.beatDepth).connect(body.gain)

    this.out = c.createGain()
    this.out.gain.value = 0
    this.pan = c.createStereoPanner()
    mix.connect(shaper).connect(this.filter).connect(body).connect(this.out)
    this.out.connect(this.pan).connect(dest)

    const n1 = noise(c)
    this.roar = c.createBiquadFilter()
    this.roar.type = 'bandpass'
    this.roar.Q.value = 1.1
    this.roarGain = c.createGain()
    this.roarGain.gain.value = 0
    n1.connect(this.roar).connect(this.roarGain).connect(this.out)
    const n2 = noise(c)
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1400
    this.hissGain = c.createGain()
    this.hissGain.gain.value = 0
    n2.connect(hp).connect(this.hissGain).connect(this.pan)
    this.srcs.push(n1, n2)

    for (const o of this.oscs) o.start()
    for (const s of this.srcs) s.start()
  }

  // rpm; throttle, level, burble and tyre hiss 0..1; pan -1..1
  set(rpm: number, throttle: number, level: number, pan = 0, burble = 0, hiss = 0) {
    const c = this.c
    const f = Math.max(4, (rpm / 60) * 2)
    smooth(this.main.frequency, f, c)
    smooth(this.sub.frequency, f / 2, c)
    smooth(this.harm.frequency, f * 2, c)
    smooth(this.pulse.frequency, f, c)
    smooth(this.beat.frequency, f / 4, c)
    smooth(this.beatDepth.gain, burble * 0.45, c, 0.1)
    smooth(this.filter.frequency, 160 + f * 3.5 + throttle * 2200, c)
    smooth(this.roar.frequency, 300 + f * 5, c)
    smooth(this.roarGain.gain, level * throttle * 0.5, c)
    smooth(this.out.gain, rpm > 50 ? level * (0.28 + 0.2 * throttle + (rpm / 7000) * 0.2) : 0, c, 0.06)
    smooth(this.hissGain.gain, hiss * 0.18, c, 0.06)
    smooth(this.pan.pan, Math.max(-1, Math.min(1, pan)), c, 0.05)
  }

  stop() {
    const c = this.c
    this.out.gain.setTargetAtTime(0, c.currentTime, 0.08)
    this.hissGain.gain.setTargetAtTime(0, c.currentTime, 0.08)
    const end = c.currentTime + 0.6
    for (const o of this.oscs) o.stop(end)
    for (const s of this.srcs) s.stop(end)
  }
}

// An engine voice, once a click has unlocked audio; null before that.
export function makeEngine() {
  return audioReady() && ctx && master ? new Engine(ctx, master) : null
}

// The starter motor turning the engine over before it catches.
export function starter(seconds: number) {
  const c = unlock()
  if (!c || !master) return
  const now = c.currentTime
  const whine = c.createOscillator()
  whine.type = 'square'
  whine.frequency.setValueAtTime(110, now)
  whine.frequency.linearRampToValueAtTime(150, now + seconds)
  const n = noise(c)
  const band = c.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 900
  const chug = c.createGain()
  chug.gain.value = 0.5
  const lfo = c.createOscillator()
  lfo.type = 'square'
  lfo.frequency.value = 7.5
  const lfoDepth = c.createGain()
  lfoDepth.gain.value = 0.45
  lfo.connect(lfoDepth).connect(chug.gain)
  const out = c.createGain()
  out.gain.setValueAtTime(0, now)
  out.gain.linearRampToValueAtTime(0.16, now + 0.05)
  out.gain.setValueAtTime(0.16, now + seconds - 0.08)
  out.gain.linearRampToValueAtTime(0, now + seconds)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1400
  whine.connect(lp).connect(chug)
  n.connect(band).connect(chug)
  chug.connect(out).connect(master)
  for (const s of [whine, lfo, n]) {
    s.start(now)
    s.stop(now + seconds + 0.05)
  }
}

// Rain on the street, heard through the open door.
let rainGain: GainNode | null = null
export function rain(level: number) {
  if (!audioReady() || !ctx || !master) return
  if (!rainGain) {
    const n = noise(ctx)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 500
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 5200
    rainGain = ctx.createGain()
    rainGain.gain.value = 0
    n.connect(hp).connect(lp).connect(rainGain).connect(master)
    n.start()
  }
  smooth(rainGain.gain, level * 0.09, ctx, 0.2)
}

// The roller shutter: motor hum, the slats rattling over the drum, and a clunk at the end.
export function rattle(seconds: number) {
  const c = unlock()
  if (!c || !master) return
  const now = c.currentTime
  const out = c.createGain()
  out.gain.value = 0.16
  out.connect(master)

  const src = noise(c)
  const band = c.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 2200
  band.Q.value = 0.9
  const clicks = c.createGain()
  clicks.gain.setValueAtTime(0, now)
  for (let t = 0.05; t < seconds; t += 0.055 + Math.random() * 0.02) {
    clicks.gain.setValueAtTime(0.55, now + t)
    clicks.gain.exponentialRampToValueAtTime(0.02, now + t + 0.03)
  }
  clicks.gain.setValueAtTime(0, now + seconds)
  src.connect(band).connect(clicks).connect(out)
  src.start(now)
  src.stop(now + seconds + 0.4)

  const motor = c.createOscillator()
  motor.type = 'sawtooth'
  motor.frequency.value = 92
  const low = c.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.value = 320
  const hum = c.createGain()
  hum.gain.setValueAtTime(0, now)
  hum.gain.linearRampToValueAtTime(0.22, now + 0.15)
  hum.gain.setValueAtTime(0.22, now + seconds - 0.15)
  hum.gain.linearRampToValueAtTime(0, now + seconds)
  motor.connect(low).connect(hum).connect(out)
  motor.start(now)
  motor.stop(now + seconds + 0.1)

  const thud = c.createOscillator()
  thud.frequency.setValueAtTime(110, now + seconds)
  thud.frequency.exponentialRampToValueAtTime(45, now + seconds + 0.25)
  const tg = c.createGain()
  tg.gain.setValueAtTime(0, now)
  tg.gain.setValueAtTime(0, now + seconds)
  tg.gain.linearRampToValueAtTime(0.9, now + seconds + 0.01)
  tg.gain.exponentialRampToValueAtTime(0.001, now + seconds + 0.35)
  thud.connect(tg).connect(out)
  thud.start(now + seconds)
  thud.stop(now + seconds + 0.4)
}
