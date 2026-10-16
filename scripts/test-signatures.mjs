import assert from 'node:assert/strict'
import { calculateExchange } from '../src/crypto/diffieHellman.js'
import { createAuthenticatedExchange, generateSigningIdentity, signExchangePacket, tamperPacket, tamperSignature, verifyExchangePacket } from '../src/crypto/signatures.js'

const result = calculateExchange({ p: '23', g: '5', a: '6', b: '15' })
const session = await createAuthenticatedExchange(result)

assert.equal(session.verified.alice, true, 'Alice signature should verify with the trusted key')
assert.equal(session.verified.bob, true, 'Bob signature should verify with the trusted key')
assert.equal(await verifyExchangePacket(tamperPacket(session.packets.alice, { publicKey: '9' }), session.trustedKeys.alice), false, 'Modified public key must fail verification')
assert.equal(await verifyExchangePacket(tamperSignature(session.packets.bob), session.trustedKeys.bob), false, 'Modified signature must fail verification')
const untrusted = await generateSigningIdentity('eve')
assert.equal(await verifyExchangePacket(session.packets.alice, untrusted.verificationKey), false, 'Untrusted verification key must fail verification')
const freshPacket = await signExchangePacket({ identity: 'alice', p: result.p, g: result.g, publicKey: result.alicePublic, privateKey: session.identities.alice.privateKey })
assert.equal(await verifyExchangePacket(freshPacket, session.trustedKeys.alice), true, 'A fresh valid packet should verify')
console.log('Digital signature tests passed: valid, modified message, invalid signature, untrusted key')
