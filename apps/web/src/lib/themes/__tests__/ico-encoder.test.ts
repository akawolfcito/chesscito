import { describe, it, expect } from "vitest";
import { encodeIco } from "../ico-encoder";

/** Payload stand-ins — encodeIco never decodes them, it only frames them. */
const png = (byte: number, length: number): Buffer => Buffer.alloc(length, byte);

describe("encodeIco", () => {
  it("writes an ICONDIR header with type 1 and the image count", () => {
    const ico = encodeIco([{ size: 16, png: png(0xaa, 10) }]);
    expect(ico.readUInt16LE(0)).toBe(0); // reserved
    expect(ico.readUInt16LE(2)).toBe(1); // type: icon
    expect(ico.readUInt16LE(4)).toBe(1); // count
  });

  it("writes one 16-byte directory entry per image, sorted ascending by size", () => {
    const ico = encodeIco([
      { size: 48, png: png(0x03, 30) },
      { size: 16, png: png(0x01, 10) },
      { size: 32, png: png(0x02, 20) },
    ]);
    expect(ico.readUInt16LE(4)).toBe(3);
    expect(ico.readUInt8(6 + 0 * 16)).toBe(16);
    expect(ico.readUInt8(6 + 1 * 16)).toBe(32);
    expect(ico.readUInt8(6 + 2 * 16)).toBe(48);
  });

  it("points each entry at its payload with a cumulative offset", () => {
    const ico = encodeIco([
      { size: 16, png: png(0x01, 10) },
      { size: 32, png: png(0x02, 20) },
    ]);
    const headerBytes = 6 + 2 * 16;
    expect(ico.readUInt32LE(6 + 8)).toBe(10); // bytesInRes, first
    expect(ico.readUInt32LE(6 + 12)).toBe(headerBytes); // imageOffset, first
    expect(ico.readUInt32LE(6 + 16 + 8)).toBe(20);
    expect(ico.readUInt32LE(6 + 16 + 12)).toBe(headerBytes + 10);
    expect(ico.length).toBe(headerBytes + 30);
  });

  it("recovers each payload byte-for-byte at its declared offset", () => {
    const first = png(0x01, 10);
    const second = png(0x02, 20);
    const ico = encodeIco([
      { size: 16, png: first },
      { size: 32, png: second },
    ]);
    const offset = ico.readUInt32LE(6 + 16 + 12);
    const length = ico.readUInt32LE(6 + 16 + 8);
    expect(ico.subarray(offset, offset + length).equals(second)).toBe(true);
  });

  it("declares 1 color plane and 32 bits per pixel", () => {
    const ico = encodeIco([{ size: 32, png: png(0x01, 8) }]);
    expect(ico.readUInt16LE(6 + 4)).toBe(1);
    expect(ico.readUInt16LE(6 + 6)).toBe(32);
  });

  it("encodes a 256px image as 0, the format's escape for 256", () => {
    const ico = encodeIco([{ size: 256, png: png(0x01, 8) }]);
    expect(ico.readUInt8(6)).toBe(0);
    expect(ico.readUInt8(7)).toBe(0);
  });

  it("refuses an empty image list rather than emitting a header-only file", () => {
    expect(() => encodeIco([])).toThrow(/at least one image/i);
  });
});
