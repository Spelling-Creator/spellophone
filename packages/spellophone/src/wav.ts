/**
 * Encodes 16-bit mono PCM samples as a WAV file (RIFF, PCM format 1).
 *
 * The output is what `espeak-ng -w out.wav` would write, so it can be saved
 * to disk, served over HTTP or handed to an `<audio>` element as a Blob.
 */
export function encodeWav(
  samples: Int16Array,
  sampleRate: number,
): Uint8Array<ArrayBuffer> {
  const channels = 1;
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);

  // Write sample by sample: a plain copy would assume little-endian hosts.
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * bytesPerSample, samples[i] ?? 0, true);
  }
  return new Uint8Array(buffer);
}

/**
 * Converts 16-bit PCM samples to the float format the Web Audio API wants
 * (`AudioBuffer.copyToChannel`), scaled to the range -1 to 1.
 */
export function toFloat32(samples: Int16Array): Float32Array<ArrayBuffer> {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = (samples[i] ?? 0) / 32768;
  }
  return out;
}
