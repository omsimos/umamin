export type ShareResult = "shared" | "cancelled" | "downloaded";

/** Native share sheet when it accepts files (mobile — reaches story-capable
 *  apps); otherwise a download. Call synchronously from a user gesture with a
 *  pre-generated blob. */
export async function sharePng(
  blob: Blob,
  filename: string,
): Promise<ShareResult> {
  const file = new File([blob], filename, { type: "image/png" });
  if (
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (error) {
      // User closed the sheet — done, no fallback.
      if ((error as DOMException)?.name === "AbortError") return "cancelled";
      // NotAllowedError (lost gesture) etc. → fall through to download.
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Safari needs the URL alive past the click.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
