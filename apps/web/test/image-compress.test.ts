import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compressAvatar, compressImage } from "@/lib/image-compress";
import { AVATAR_EDGE } from "@/lib/post-images";

// jsdom has no canvas backend: give it a 2D context that accepts draws and an
// encoder that returns a small blob of whatever type was asked for.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  HTMLCanvasElement.prototype.toBlob = (callback, type) => {
    callback(new Blob([new Uint8Array(16)], { type }));
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fakeBitmap(width: number, height: number) {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap & {
    close: ReturnType<typeof vi.fn>;
  };
}

describe("compressAvatar", () => {
  // Chrome for Android failed the second decode of the same picked File, so
  // people saw the crop preview and then "Couldn't read this image" on every
  // Apply. The avatar path must encode the dialog's bitmap, never re-read.
  it("encodes the crop dialog's bitmap without decoding the file again", async () => {
    const createImageBitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    const bitmap = fakeBitmap(1200, 900);

    const out = await compressAvatar(bitmap, {
      x: 100,
      y: 0,
      width: 900,
      height: 900,
    });

    expect(createImageBitmap).not.toHaveBeenCalled();
    expect(out.width).toBe(AVATAR_EDGE);
    // The dialog still owns it: a failed upload keeps the dialog open for a
    // retry, which needs the same bitmap.
    expect(bitmap.close).not.toHaveBeenCalled();
  });
});

describe("compressImage", () => {
  it("closes the bitmap it decoded itself", async () => {
    const bitmap = fakeBitmap(800, 600);
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));

    await compressImage(
      new File([new Uint8Array(32)], "photo.jpg", { type: "image/jpeg" }),
    );

    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});
