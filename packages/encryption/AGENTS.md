# @umamin/encryption

AES-256-GCM helpers used by both apps to encrypt message content at rest. The
key comes from the `AES_256_GCM_KEY` environment variable.

```sh
pnpm --filter=@umamin/encryption test
pnpm aes:generate        # from the root: prints a new key
```

- Changing the format (IV length, encoding, tag handling) breaks every stored
  ciphertext. Any change must still decrypt existing data; add a test with a
  ciphertext produced by the current code before you touch it.
- Rotating the key needs a re-encryption plan for existing rows. Never rotate it
  as a side effect of other work.
- Never log plaintext, ciphertext or the key.
