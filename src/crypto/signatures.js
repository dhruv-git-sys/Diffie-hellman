const SIGNATURE_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' }
const VERIFY_ALGORITHM = { name: 'ECDSA', hash: 'SHA-256' }
const encoder = new TextEncoder()

function subtleCrypto() {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto API is unavailable.')
  return globalThis.crypto.subtle
}

function bytesToBase64(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function canonicalPayload({ identity, p, g, publicKey }) {
  return `KeyShift-DH-SIG-v1|identity=${identity}|p=${p}|g=${g}|public=${publicKey}`
}

export async function generateSigningIdentity(identity) {
  const subtle = subtleCrypto()
  const keyPair = await subtle.generateKey(SIGNATURE_ALGORITHM, true, ['sign', 'verify'])
  const verificationKey = await subtle.exportKey('jwk', keyPair.publicKey)
  return { identity, privateKey: keyPair.privateKey, publicKey: keyPair.publicKey, verificationKey }
}

export async function signExchangePacket({ identity, p, g, publicKey, privateKey }) {
  const signature = await subtleCrypto().sign(VERIFY_ALGORITHM, privateKey, encoder.encode(canonicalPayload({ identity, p, g, publicKey })))
  return { identity, p: p.toString(), g: g.toString(), publicKey: publicKey.toString(), signature: bytesToBase64(new Uint8Array(signature)) }
}

export async function verifyExchangePacket(packet, trustedVerificationKey) {
  const importedKey = await subtleCrypto().importKey('jwk', trustedVerificationKey, SIGNATURE_ALGORITHM, false, ['verify'])
  return subtleCrypto().verify(VERIFY_ALGORITHM, importedKey, base64ToBytes(packet.signature), encoder.encode(canonicalPayload(packet)))
}

export function tamperPacket(packet, { publicKey = packet.publicKey, signature = packet.signature } = {}) {
  return { ...packet, publicKey: publicKey.toString(), signature }
}

export function tamperSignature(packet) {
  const bytes = base64ToBytes(packet.signature)
  bytes[0] ^= 1
  return tamperPacket(packet, { signature: bytesToBase64(bytes) })
}

export async function createAuthenticatedExchange(result) {
  const [aliceIdentity, bobIdentity] = await Promise.all([
    generateSigningIdentity('alice'),
    generateSigningIdentity('bob'),
  ])
  const [alicePacket, bobPacket] = await Promise.all([
    signExchangePacket({ identity: 'alice', p: result.p, g: result.g, publicKey: result.alicePublic, privateKey: aliceIdentity.privateKey }),
    signExchangePacket({ identity: 'bob', p: result.p, g: result.g, publicKey: result.bobPublic, privateKey: bobIdentity.privateKey }),
  ])
  const [aliceVerified, bobVerified] = await Promise.all([
    verifyExchangePacket(alicePacket, aliceIdentity.verificationKey),
    verifyExchangePacket(bobPacket, bobIdentity.verificationKey),
  ])
  return {
    identities: { alice: aliceIdentity, bob: bobIdentity },
    packets: { alice: alicePacket, bob: bobPacket },
    trustedKeys: { alice: aliceIdentity.verificationKey, bob: bobIdentity.verificationKey },
    verified: { alice: aliceVerified, bob: bobVerified },
  }
}
