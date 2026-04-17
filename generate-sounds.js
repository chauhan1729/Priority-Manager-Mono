#!/usr/bin/env node
/**
 * Generates simple notification sound WAV files for the mobile app.
 * Run once: node generate-sounds.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const BITS = 16;

function buildWav(samples) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  let o = 0;
  buf.write('RIFF', o); o += 4;
  buf.writeUInt32LE(36 + dataSize, o); o += 4;
  buf.write('WAVE', o); o += 4;
  buf.write('fmt ', o); o += 4;
  buf.writeUInt32LE(16, o); o += 4;
  buf.writeUInt16LE(1, o); o += 2;   // PCM
  buf.writeUInt16LE(1, o); o += 2;   // mono
  buf.writeUInt32LE(SAMPLE_RATE, o); o += 4;
  buf.writeUInt32LE(SAMPLE_RATE * 2, o); o += 4;
  buf.writeUInt16LE(2, o); o += 2;
  buf.writeUInt16LE(BITS, o); o += 2;
  buf.write('data', o); o += 4;
  buf.writeUInt32LE(dataSize, o); o += 4;
  for (const s of samples) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s * 32767))), o);
    o += 2;
  }
  return buf;
}

function sine(freq, t) {
  return Math.sin(2 * Math.PI * freq * t);
}

/** Bell tone with natural harmonics and exponential decay */
function bell(freq, durationSec, volume = 0.80) {
  const n = Math.floor(SAMPLE_RATE * durationSec);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 3.5) * Math.min(1, t / 0.003);
    const s =
      sine(freq, t)        * 0.55 +
      sine(freq * 2, t)    * 0.25 +
      sine(freq * 3, t)    * 0.12 +
      sine(freq * 4.2, t)  * 0.05 +
      sine(freq * 6.1, t)  * 0.03;
    out.push(s * env * volume);
  }
  return out;
}

/** Short pure sine with quick attack and decay */
function beep(freq, durationSec, volume = 0.75) {
  const n = Math.floor(SAMPLE_RATE * durationSec);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, t / 0.005);
    const release = Math.min(1, (durationSec - t) / 0.02);
    out.push(sine(freq, t) * attack * release * volume);
  }
  return out;
}

function silence(durationSec) {
  return new Array(Math.floor(SAMPLE_RATE * durationSec)).fill(0);
}

function concat(...arrays) {
  return [].concat(...arrays);
}

// ---------------------------------------------------------------------------
// Sounds
// ---------------------------------------------------------------------------

// ding — warm bell at 880 Hz (A5)
const ding = bell(880, 1.4, 0.85);

// chime — ascending C5 → E5 → G5 major triad
const chime = concat(
  bell(523.25, 0.45, 0.75),
  silence(0.03),
  bell(659.25, 0.45, 0.75),
  silence(0.03),
  bell(783.99, 0.60, 0.75),
);

// ping — crisp high-pitched ping at C6
const ping = bell(1046.5, 0.7, 0.80);

// alert — two sharp beeps at C6
const alert = concat(
  beep(1046.5, 0.10, 0.90),
  silence(0.07),
  beep(1046.5, 0.10, 0.90),
  silence(0.05),
);

// gentle — soft low tone at D4 with long decay
const gentle = bell(293.66, 1.6, 0.60);

// ---------------------------------------------------------------------------

const outDir = path.join(__dirname, 'apps', 'mobile', 'assets', 'sounds');
fs.mkdirSync(outDir, { recursive: true });

const sounds = { ding, chime, ping, alert, gentle };
for (const [name, samples] of Object.entries(sounds)) {
  const fp = path.join(outDir, `${name}.wav`);
  fs.writeFileSync(fp, buildWav(samples));
  const secs = (samples.length / SAMPLE_RATE).toFixed(2);
  console.log(`wrote ${name}.wav  (${secs}s, ${samples.length} samples)`);
}
console.log('done');
