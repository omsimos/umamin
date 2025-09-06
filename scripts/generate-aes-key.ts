const { subtle } = globalThis.crypto;

async function main() {
  try {
    const key = await subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const rawKey = await subtle.exportKey("raw", key);
    const base64Key = Buffer.from(new Uint8Array(rawKey)).toString("base64");
    console.log("Generated AES-256-GCM key (base64):");
    console.log(base64Key);
  } catch (err) {
    console.error("Failed to generate key:", err);
    process.exit(1);
  }
}

main();
