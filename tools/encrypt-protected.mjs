// Encrypts a file into the .enc.json payload that assets/js/password-lock.js
// decrypts in the browser: PBKDF2-SHA256 (250,000 iterations) -> AES-256-GCM,
// with the 16-byte GCM tag appended to the ciphertext as Web Crypto expects.
//
// Usage (from the repo root), one or more input/output pairs:
//   node tools/encrypt-protected.mjs <input> <output.enc.json> [<input> <output.enc.json> ...]
//
// The visitor's download filename is the input file's name. The password is
// read from the PROTECT_PASSWORD environment variable if set, otherwise
// prompted for once on the terminal. It is never written to disk. Only the
// .enc.json outputs belong in the repo; keep the source files out of git.
import { readFileSync, writeFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { randomBytes, pbkdf2Sync, createCipheriv } from "node:crypto";
import { createInterface } from "node:readline";

const ITERATIONS = 250000;
const MIME = { ".pdf": "application/pdf", ".zip": "application/zip", ".html": "text/html" };

const args = process.argv.slice(2);
if (args.length === 0 || args.length % 2 !== 0) {
  console.error("Usage: node tools/encrypt-protected.mjs <input> <output.enc.json> [<input> <output.enc.json> ...]");
  process.exit(2);
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write("\n"); resolve(answer); });
  });
}

const password = process.env.PROTECT_PASSWORD || await promptHidden("Password: ");
if (!password) { console.error("No password given."); process.exit(1); }

for (let i = 0; i < args.length; i += 2) {
  const [input, output] = [args[i], args[i + 1]];
  const plain = readFileSync(input);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);

  writeFileSync(output, JSON.stringify({
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    iterations: ITERATIONS,
    ciphertext: ciphertext.toString("base64"),
    filename: basename(input),
    mime: MIME[extname(input).toLowerCase()] || "application/octet-stream",
  }));
  console.log(`Encrypted ${basename(input)} (${plain.length.toLocaleString()} bytes) -> ${output}`);
}
