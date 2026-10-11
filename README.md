# KeyShift Lab

An interactive Diffie-Hellman key exchange simulator built with React, Vite, Tailwind CSS, Framer Motion, and Lucide icons.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The production build can be checked with `npm run build`.

## Included

- BigInt modular exponentiation and primitive-root validation in `src/crypto/diffieHellman.js`
- Live inputs for `p`, `g`, Alice's private key `a`, and Bob's private key `b`
- Animated step-by-step exchange controls and packet movement
- Optional man-in-the-middle attack demonstration
- Worked example, formula trace, and interactive quiz

The default educational example is `p=23, g=5, a=6, b=15`, producing `A=8`, `B=19`, and shared secret `2`. These small values are intentionally insecure and are not suitable for production cryptography.
