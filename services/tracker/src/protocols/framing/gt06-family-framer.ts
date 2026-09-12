export interface FrameResult { frames: Buffer[]; remainder: Buffer }

/** Shared GT06/W15 wire-family framing; generic TCP transport never imports it. */
export const gt06FamilyFramer = {
  extract(data: Buffer): FrameResult {
    const frames: Buffer[] = [];
    let remainder = data;
    while (remainder.length >= 3) {
      const start = remainder.indexOf(Buffer.from([0x78, 0x78]));
      if (start < 0) return { frames, remainder: remainder.subarray(Math.max(0, remainder.length - 1)) };
      if (start > 0) remainder = remainder.subarray(start);
      const declaredLength = remainder[2];
      const frameLength = declaredLength + 5;
      if (declaredLength < 5) { remainder = remainder.subarray(2); continue; }
      if (remainder.length < frameLength) break;
      const frame = remainder.subarray(0, frameLength);
      remainder = remainder.subarray(frameLength);
      if (frame.at(-2) === 0x0d && frame.at(-1) === 0x0a) frames.push(frame);
    }
    return { frames, remainder };
  },
};
