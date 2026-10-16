import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowDown, ArrowLeftRight, Check, ChevronDown, CircleHelp, FlaskConical, KeyRound, LockKeyhole, Pause, Play, RotateCcw, ShieldCheck, Sparkles, Terminal, UserRound, X, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { calculateExchange, modPow, toDisplay, validateInputs } from './crypto/diffieHellman'
import { createAuthenticatedExchange, tamperPacket, tamperSignature, verifyExchangePacket } from './crypto/signatures'
import './App.css'
import './mitm.css'
import './auth.css'

const DEFAULTS = { p: '23', g: '5', a: '6', b: '15' }
const STEP_COUNT = 4
const STEPS = { length: STEP_COUNT }

function generateAttackKeys(values) {
  const prime = BigInt(values.p)
  const max = Number(prime - 2n)
  const first = Math.floor(Math.random() * (max - 1)) + 2
  let second = Math.floor(Math.random() * (max - 1)) + 2
  if (max > 2 && second === first) second = second === max ? 2 : second + 1
  return { xD1: BigInt(first), xD2: BigInt(second) }
}

function calculateMitm(result, keys) {
  const yD1 = modPow(result.g, keys.xD1, result.p)
  const yD2 = modPow(result.g, keys.xD2, result.p)
  const aliceK2 = modPow(yD2, result.a, result.p)
  const eveK2 = modPow(result.alicePublic, keys.xD2, result.p)
  const bobK1 = modPow(yD1, result.b, result.p)
  const eveK1 = modPow(result.bobPublic, keys.xD1, result.p)
  return { ...keys, yD1, yD2, aliceK2, eveK2, bobK1, eveK1 }
}

function getSteps(result) {
  return [
  { label: 'Private keys chosen', title: 'Only Alice and Bob know these values.', copy: 'Each participant selects a private number. These values never travel across the channel.', formula: `a = ${result.a}     b = ${result.b}` },
  { label: 'Public keys computed', title: 'Both participants publish a one-way result.', copy: 'Alice calculates gᵃ mod p and Bob calculates gᵇ mod p. The private keys stay hidden.', formula: `A = ${result.g}^${result.a} mod ${result.p} = ${result.alicePublic}     B = ${result.g}^${result.b} mod ${result.p} = ${result.bobPublic}` },
  { label: 'Public keys exchanged', title: 'The public values cross the open channel.', copy: 'An observer can see A and B, but reversing the exponentiation is computationally hard with real parameters.', formula: `Alice receives B = ${result.bobPublic}     Bob receives A = ${result.alicePublic}` },
  { label: 'Shared secret derived', title: 'Both sides arrive at the same secret.', copy: 'Alice raises Bob’s public key to a, while Bob raises Alice’s public key to b.', formula: `S₁ = ${result.bobPublic}^${result.a} mod ${result.p} = ${result.aliceSecret}     S₂ = ${result.alicePublic}^${result.b} mod ${result.p} = ${result.bobSecret}` },
  ]
}

function App() {
  const [values, setValues] = useState(DEFAULTS)
  const [result, setResult] = useState(() => calculateExchange(DEFAULTS))
  const [errors, setErrors] = useState({})
  const [step, setStep] = useState(3)
  const [isPlaying, setIsPlaying] = useState(false)
  const [authMode, setAuthMode] = useState('normal')
  const [attackStep, setAttackStep] = useState(0)
  const [attackKeys, setAttackKeys] = useState(() => generateAttackKeys(DEFAULTS))
  const [quizAnswer, setQuizAnswer] = useState(null)
  const [signatureSession, setSignatureSession] = useState(null)
  const [signatureTampered, setSignatureTampered] = useState(false)
  const showAttack = authMode !== 'normal'
  const steps = useMemo(() => getSteps(result), [result])
  const mitm = useMemo(() => calculateMitm(result, attackKeys), [result, attackKeys])
  const eve = { publicKey: mitm.yD1, aliceSecret: mitm.aliceK2, bobSecret: mitm.bobK1 }

  useEffect(() => {
    if (!isPlaying || showAttack) return undefined
    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current >= steps.length - 1) { setIsPlaying(false); return current }
        return current + 1
      })
    }, 2200)
    return () => window.clearInterval(timer)
  }, [isPlaying, showAttack, steps.length])

  useEffect(() => {
    if (!showAttack || !isPlaying) return undefined
    const timer = window.setInterval(() => {
      setAttackStep((current) => {
        if (current >= 5) { setIsPlaying(false); return current }
        return current + 1
      })
    }, 2200)
    return () => window.clearInterval(timer)
  }, [showAttack, isPlaying])

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setAttackStep(0)
      setIsPlaying(false)
    }, 0)
    return () => window.clearTimeout(resetTimer)
  }, [showAttack])

  useEffect(() => {
    let active = true
    if (authMode !== 'signed') {
      return () => { active = false }
    }
    createAuthenticatedExchange(result).then((session) => {
      if (active) setSignatureSession({ status: 'ready', ...session })
    }).catch((error) => {
      if (active) setSignatureSession({ status: 'error', message: error.message })
    })
    return () => { active = false }
  }, [authMode, result])

  function updateValue(key, value) {
    setValues((current) => ({ ...current, [key]: value.replace(/[^0-9]/g, '') }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  function runSimulation(nextValues = values) {
    const validation = validateInputs(nextValues)
    setErrors(validation.errors)
    if (Object.keys(validation.errors).length) return
    setResult(calculateExchange(nextValues))
    setAttackKeys(generateAttackKeys(nextValues))
    setSignatureSession(null)
    setStep(0)
    setAttackStep(0)
    setIsPlaying(false)
  }

  function randomize() {
    const primes = [{ p: '23', g: '5' }, { p: '29', g: '2' }, { p: '31', g: '3' }]
    const selected = primes[Math.floor(Math.random() * primes.length)]
    const next = { ...selected, a: String(Math.floor(Math.random() * (Number(selected.p) - 2)) + 2), b: String(Math.floor(Math.random() * (Number(selected.p) - 2)) + 2) }
    setValues(next)
    runSimulation(next)
  }

  function reset() {
    setValues(DEFAULTS); setResult(calculateExchange(DEFAULTS)); setAttackKeys(generateAttackKeys(DEFAULTS)); setSignatureSession(null); setErrors({}); setStep(3); setAttackStep(0); setIsPlaying(false); setAuthMode('normal')
  }

  function changeAuthMode(nextMode) {
    setAuthMode(nextMode)
    setAttackStep(0)
    setStep(0)
    setIsPlaying(false)
    setSignatureTampered(false)
    setSignatureSession(null)
  }

  function setShowAttack(updater) {
    setAuthMode((current) => {
      const nextAttack = typeof updater === 'function' ? updater(current !== 'normal') : updater
      return nextAttack ? 'mitm' : 'normal'
    })
  }

  return (
    <main className="app-shell">
      <AnimatePresence>{authMode === 'mitm' && <MitmSequence result={result} mitm={mitm} step={attackStep} isPlaying={isPlaying} onPlay={() => setIsPlaying((current) => !current)} onNext={() => setAttackStep((current) => Math.min(current + 1, 5))} onPrevious={() => setAttackStep((current) => Math.max(current - 1, 0))} onRestart={() => { setAttackStep(0); setIsPlaying(false) }} />}</AnimatePresence>
      <AnimatePresence>{authMode === 'signed' && <SignedSequence result={result} session={signatureSession} tampered={signatureTampered} onTamper={() => setSignatureTampered((current) => !current)} />}</AnimatePresence>
      <nav className="topbar"><div className="brand"><span className="brand-mark"><LockKeyhole size={17} /></span><span>Key<span className="accent-text">Shift</span></span><span className="brand-tag">LAB / 01</span></div><div className="topbar-status"><span className="status-dot" /> ENCRYPTION LAB <span className="status-divider" /> <span className="muted">EDUCATIONAL SIMULATOR</span></div></nav>
      <section className="hero-section page-width"><div className="eyebrow"><span className="eyebrow-line" /> PUBLIC-KEY CRYPTOGRAPHY <span className="eyebrow-line" /></div><h1>Make secrets<br /><span>in public.</span></h1><p className="hero-copy">Explore how two people agree on a shared secret over an open channel.<br />No secret key is ever transmitted.</p><div className="hero-meta"><span><Sparkles size={15} /> REAL-TIME MATH</span><span><ShieldCheck size={15} /> BIGINT PRECISION</span><span><Zap size={15} /> INTERACTIVE</span></div></section>

      <ModeSelector mode={authMode} onChange={changeAuthMode} />

      <section className="workspace page-width">
        <div className="control-panel glass-panel"><div className="panel-heading"><div><span className="section-kicker">01 / PARAMETERS</span><h2>Set the stage</h2></div><span className="live-pill"><span className="status-dot" /> LIVE</span></div><p className="panel-copy">Choose the public parameters and private keys. Try the example, then make it your own.</p><div className="input-grid">{Object.entries({ p: ['Prime modulus', 'Public', 'e.g. 23'], g: ['Generator', 'Public', 'e.g. 5'], a: ["Alice's private key", 'Secret', 'e.g. 6'], b: ["Bob's private key", 'Secret', 'e.g. 15'] }).map(([key, [label, type, hint]]) => <label className="input-field" key={key}><span className="field-label"><span>{label}</span><span className={type === 'Secret' ? 'secret-label' : 'public-label'}>{type === 'Secret' ? <LockKeyhole size={11} /> : <Sparkles size={11} />}{type}</span></span><span className="input-wrap"><span className="input-symbol">{key}</span><input value={values[key]} placeholder={hint} onChange={(event) => updateValue(key, event.target.value)} /></span>{errors[key] && <span className="field-error"><X size={12} />{errors[key]}</span>}</label>)}</div><div className="control-actions"><button className="primary-button" onClick={() => runSimulation()}><Play size={16} fill="currentColor" /> Run simulation</button><button className="secondary-button" onClick={randomize}><Sparkles size={15} /> Random keys</button><button className="icon-button" onClick={reset} title="Reset parameters"><RotateCcw size={16} /></button></div><div className="education-note"><AlertTriangle size={15} /><span>Small parameters are for education only. Real systems use 2048+ bit primes.</span></div></div>

        <div className="simulation-panel"><div className="panel-heading"><div><span className="section-kicker">02 / LIVE EXCHANGE</span><h2>Watch the handshake</h2></div><button className={`mode-toggle ${showAttack ? 'active' : ''}`} onClick={() => setShowAttack((current) => !current)}><AlertTriangle size={14} /> {showAttack ? 'MITM ACTIVE' : 'Try MITM mode'}<span className="toggle-track"><span /></span></button></div><div className={`exchange-stage ${showAttack ? 'attack-stage' : ''}`}><Participant name="Alice" role="Initiator" icon={<UserRound size={22} />} accent="cyan" privateKey={result.a} publicKey={result.alicePublic} secret={result.aliceSecret} /><div className="channel"><div className="channel-label"><span className="channel-dot" /> OPEN CHANNEL <span className="channel-dot" /></div><div className="channel-line"><AnimatePresence>{step >= 2 && <motion.span className="packet packet-right" initial={{ left: '0%' }} animate={{ left: '90%' }} transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1.2 }}><ArrowLeftRight size={14} /></motion.span>}</AnimatePresence><span className="line-dash" /></div><div className="channel-values"><span>A = {toDisplay(result.alicePublic)}</span><span>B = {toDisplay(result.bobPublic)}</span></div></div>{showAttack && <div className="eve-node"><div className="eve-badge"><AlertTriangle size={17} /></div><span>EVE</span><small>interceptor</small></div>}<Participant name="Bob" role="Responder" icon={<UserRound size={22} />} accent="violet" privateKey={result.b} publicKey={result.bobPublic} secret={result.bobSecret} /></div><div className="exchange-controls"><button className="round-control" onClick={() => setIsPlaying((current) => !current)} title={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><button className="round-control" onClick={() => setStep((current) => Math.min(current + 1, STEPS.length - 1))} title="Next step"><ArrowDown size={17} /></button><button className="round-control" onClick={() => { setStep(0); setIsPlaying(false) }} title="Restart"><RotateCcw size={17} /></button><div className="step-progress"><div className="progress-bar"><motion.div animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div><span>STEP {String(step + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}</span></div></div></div>
      </section>

      <section className="readout page-width"><div className="readout-copy"><span className="section-kicker">03 / CALCULATION TRACE</span><h2>{steps[step].title}</h2><p>{steps[step].copy}</p><div className="formula-line"><Terminal size={15} /> <code>{steps[step].formula}</code></div></div><div className="trace-list">{steps.map((item, index) => <button key={item.label} className={`trace-step ${index === step ? 'current' : ''} ${index < step ? 'done' : ''}`} onClick={() => { setStep(index); setIsPlaying(false) }}><span className="trace-number">{index < step ? <Check size={14} /> : `0${index + 1}`}</span><span>{item.label}</span>{index === step && <ChevronDown size={15} />}</button>)}</div></section>

      <section className="secrets-section page-width"><div className="section-intro"><span className="section-kicker">04 / THE PAYOFF</span><h2>One secret.<br /><span>Two identical answers.</span></h2></div><div className="secret-cards"><SecretCard owner="Alice computes" formula={`Bᵃ mod p = ${result.bobPublic}^${result.a} mod ${result.p}`} value={result.aliceSecret} accent="cyan" /><div className="equals-mark">=</div><SecretCard owner="Bob computes" formula={`Aᵇ mod p = ${result.alicePublic}^${result.b} mod ${result.p}`} value={result.bobSecret} accent="violet" /></div><div className={`verification ${result.verified ? 'verified' : 'failed'}`}><ShieldCheck size={18} /><span>{result.verified ? 'MATCH VERIFIED' : 'MISMATCH DETECTED'}</span><strong>{result.verified ? 'S₁ = S₂' : 'Check your inputs'}</strong><small>{result.verified ? `Both parties derived the secret ${result.aliceSecret}.` : 'The shared secret could not be verified.'}</small></div></section>

      <AnimatePresence>{showAttack && <motion.section className="attack-section page-width" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }}><div className="attack-heading"><div className="eve-large"><AlertTriangle size={20} /></div><div><span className="section-kicker danger-kicker">OPTIONAL SCENARIO / ADVERSARY IN THE MIDDLE</span><h2>What if Eve is listening?</h2></div></div><p className="attack-copy">Eve intercepts the public keys and replaces them with her own. Alice and Bob still see “valid” calculations, but they end up with separate secrets that Eve can translate between.</p><div className="attack-grid"><AttackCard label="Alice ↔ Eve" value={eve.aliceSecret} detail={`Eve sends public key ${eve.publicKey} to Alice`} /><AttackCard label="Bob ↔ Eve" value={eve.bobSecret} detail={`Eve sends public key ${eve.publicKey} to Bob`} /></div><div className="attack-footer"><AlertTriangle size={17} /><strong>Authentication is the missing ingredient.</strong><span>Basic DH hides the secret, but does not prove who sent the public key. Certificates or signatures close this gap.</span></div></motion.section>}</AnimatePresence>

      <section className="learning-section page-width"><div className="learning-head"><div><span className="section-kicker">05 / FIELD NOTES</span><h2>Understand the protocol</h2></div><span className="learning-tag"><FlaskConical size={15} /> VIVA READY</span></div><div className="learning-grid"><article className="lesson-card"><div className="lesson-icon"><KeyRound size={18} /></div><h3>The idea</h3><p>Public values are easy to share. Private exponents are never sent. The hard-to-reverse nature of modular exponentiation keeps the secret safe.</p><div className="mini-formula">A = gᵃ mod p<br />B = gᵇ mod p<br /><b>S = Bᵃ = Aᵇ mod p</b></div></article><article className="lesson-card worked-example"><div className="lesson-icon"><Terminal size={18} /></div><h3>Worked example</h3><p>With p = 23, g = 5, Alice picks 6, Bob picks 15.</p><div className="worked-rows"><span>Alice publishes <b>5⁶ mod 23 = 8</b></span><span>Bob publishes <b>5¹⁵ mod 23 = 19</b></span><span>Both calculate <b>19⁶ = 8¹⁵ = 2</b></span></div></article><article className="lesson-card quiz-card"><div className="lesson-icon"><CircleHelp size={18} /></div><h3>Quick check</h3><p>Which value is never sent over the open channel?</p><div className="quiz-options">{['The prime p', 'Alice’s private key a', 'The public key A'].map((option, index) => <button key={option} className={quizAnswer === index ? (index === 1 ? 'correct' : 'incorrect') : ''} onClick={() => setQuizAnswer(index)}>{quizAnswer !== null && index === 1 ? <Check size={14} /> : quizAnswer !== null && index !== 1 && quizAnswer === index ? <X size={14} /> : <span className="option-letter">{String.fromCharCode(65 + index)}</span>}{option}</button>)}</div>{quizAnswer !== null && <span className={`quiz-feedback ${quizAnswer === 1 ? 'correct-text' : 'incorrect-text'}`}>{quizAnswer === 1 ? 'Correct. Private keys stay private.' : 'Not quite. Public values are designed to be shared.'}</span>}</article></div></section>
      <footer className="footer page-width"><span><LockKeyhole size={14} /> KEYSHIFT LAB</span><span>Diffie–Hellman / Educational build / 2026</span><span className="footer-note">NOT FOR PRODUCTION CRYPTOGRAPHY</span></footer>
    </main>
  )
}

function ModeSelector({ mode, onChange }) {
  return <section className="mode-selector page-width"><div><span className="section-kicker">AUTHENTICATION LAYER</span><h2>Choose the trust model</h2></div><div className="mode-options"><button className={mode === 'normal' ? 'selected normal-mode' : ''} onClick={() => onChange('normal')}><span>01</span><strong>Normal exchange</strong><small>Unauthenticated DH</small></button><button className={mode === 'mitm' ? 'selected mitm-mode' : ''} onClick={() => onChange('mitm')}><span>02</span><strong>MITM attack</strong><small>Eve replaces keys</small></button><button className={mode === 'signed' ? 'selected signed-mode' : ''} onClick={() => onChange('signed')}><span>03</span><strong>Signature protection</strong><small>Trusted ECDSA keys</small></button></div></section>
}

function keyPreview(jwk) {
  if (!jwk) return '—'
  return `${jwk.x?.slice(0, 10)}…${jwk.y?.slice(-8)}`
}

function packetPreview(packet) {
  if (!packet) return '—'
  return `${packet.signature.slice(0, 16)}…`
}

function SignedSequence({ result, session, tampered, onTamper }) {
  const [verification, setVerification] = useState({ alice: false, bob: false, loading: true })
  const tamperedPackets = useMemo(() => {
    if (!session || session.status !== 'ready') return null
    if (!tampered) return session.packets
    const alicePublic = (BigInt(session.packets.alice.publicKey) % result.p) + 1n
    return { alice: tamperPacket(session.packets.alice, { publicKey: alicePublic }), bob: tamperSignature(session.packets.bob) }
  }, [result.p, session, tampered])

  useEffect(() => {
    let active = true
    if (!session || session.status !== 'ready') {
      return () => { active = false }
    }
    const nextPackets = tamperedPackets
    const resetTimer = window.setTimeout(() => setVerification({ alice: false, bob: false, loading: true }), 0)
    if (!tampered) {
      const validTimer = window.setTimeout(() => {
        if (active) setVerification({ ...session.verified, loading: false })
      }, 10)
      return () => { active = false; window.clearTimeout(resetTimer); window.clearTimeout(validTimer) }
    }
    Promise.all([
      verifyExchangePacket(nextPackets.alice, session.trustedKeys.alice),
      verifyExchangePacket(nextPackets.bob, session.trustedKeys.bob),
    ]).then(([alice, bob]) => {
      if (active) setVerification({ alice, bob, loading: false })
    }).catch(() => {
      if (active) setVerification({ alice: false, bob: false, loading: false, error: true })
    })
    return () => { active = false; window.clearTimeout(resetTimer) }
  }, [tampered, tamperedPackets, session])

  if (!session || session.status === 'loading') return <motion.section className="signed-sequence page-width" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="signed-loading"><ShieldCheck size={22} /><span>Generating trusted P-256 signing identities…</span></div></motion.section>
  if (session.status === 'error') return <section className="signed-sequence page-width"><div className="signed-loading failed"><AlertTriangle size={22} /><span>{session.message}</span></div></section>
  const aliceValid = !verification.loading && verification.alice
  const bobValid = !verification.loading && verification.bob
  const exchangeAccepted = aliceValid && bobValid
  return <motion.section className={`signed-sequence page-width ${tampered ? 'tampered-sequence' : ''}`} initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}><div className="signed-topline"><div><span className="section-kicker signed-kicker"><ShieldCheck size={13} /> AUTHENTICATED EXCHANGE / ECDSA P-256</span><h2>Sign first. Then derive.</h2><p>Alice and Bob sign their canonical DH packets with trusted verification keys. Eve can see the channel, but cannot forge either identity.</p></div><div className={`auth-badge ${exchangeAccepted ? 'valid' : tampered ? 'invalid' : 'pending'}`}><span>{exchangeAccepted ? '●' : tampered ? '×' : '…'}</span>{exchangeAccepted ? 'AUTHENTICATED' : tampered ? 'MITM DETECTED' : 'VERIFYING'}</div></div><div className="signed-lifelines"><div className="signed-person"><span className="signed-avatar alice-avatar"><UserRound size={17} /></span><b>ALICE</b><small>signs yA</small></div><div className="signed-person eve-signed"><span className="signed-avatar eve-avatar"><AlertTriangle size={17} /></span><b>EVE</b><small>intercepts</small></div><div className="signed-person"><span className="signed-avatar bob-avatar"><UserRound size={17} /></span><b>BOB</b><small>verifies yA</small></div><div className="signed-line alice-signed-line" /><div className="signed-line eve-signed-line" /><div className="signed-line bob-signed-line" /><motion.div className="signed-packet packet-a" animate={{ x: tampered ? [0, 40, 0] : [0, 100, 0] }} transition={{ duration: 2.5, repeat: Infinity }}><LockKeyhole size={12} /> yA + σA</motion.div><motion.div className="signed-packet packet-b" animate={{ x: [0, -100, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: .8 }}><LockKeyhole size={12} /> yB + σB</motion.div><div className={`verify-card verify-alice ${aliceValid ? 'valid-card' : tampered && !verification.loading ? 'invalid-card' : ''}`}><span>BOB VERIFIES ALICE</span><code>verify(σA, yA, trusted Alice key)</code><strong>{verification.loading ? '…' : aliceValid ? 'VALID SIGNATURE' : 'SIGNATURE VERIFICATION FAILED'}</strong></div><div className={`verify-card verify-bob ${bobValid ? 'valid-card' : tampered && !verification.loading ? 'invalid-card' : ''}`}><span>ALICE VERIFIES BOB</span><code>verify(σB, yB, trusted Bob key)</code><strong>{verification.loading ? '…' : bobValid ? 'VALID SIGNATURE' : 'SIGNATURE VERIFICATION FAILED'}</strong></div></div><div className="signature-inspection"><div className="inspection-heading"><div><span className="section-kicker">SIGNATURE INSPECTION</span><h3>What travels across the channel</h3></div><button className={`tamper-toggle ${tampered ? 'active' : ''}`} onClick={onTamper}><AlertTriangle size={14} /> Simulate signature tampering <span /></button></div><div className="inspection-grid"><SignatureCard identity="Alice" packet={tamperedPackets?.alice} verificationKey={session.trustedKeys.alice} valid={aliceValid} /><SignatureCard identity="Bob" packet={tamperedPackets?.bob} verificationKey={session.trustedKeys.bob} valid={bobValid} /></div></div><div className={`signed-result ${exchangeAccepted ? 'success-result' : tampered ? 'failure-result' : ''}`}><LockKeyhole size={19} /><div><strong>{exchangeAccepted ? 'Trusted keys accepted. Shared secret can be derived.' : tampered ? 'Signature Verification Failed — MITM Detected.' : 'Waiting for signature verification…'}</strong><span>{exchangeAccepted ? `Alice and Bob can safely use shared secret ${result.aliceSecret}. Signatures authenticate the exchange; they do not encrypt messages.` : 'Bob rejects Eve’s modified packet, and Alice rejects Eve’s modified response. The DH values never enter the forged session.'}</span></div></div></motion.section>
}

function SignatureCard({ identity, packet, verificationKey, valid }) {
  return <article className="signature-card"><div className="signature-card-head"><span>{identity} / TRUST RECORD</span><span className={valid ? 'signature-status valid-status' : 'signature-status invalid-status'}>{valid ? <Check size={12} /> : <AlertTriangle size={12} />}{valid ? 'VERIFIED' : 'REJECTED'}</span></div><div className="signature-row"><small>DH PUBLIC KEY</small><code>{packet?.publicKey ?? '—'}</code></div><div className="signature-row"><small>SIGNING PUBLIC KEY</small><code>{keyPreview(verificationKey)}</code></div><div className="signature-row"><small>DIGITAL SIGNATURE</small><code>{packetPreview(packet)}</code></div></article>
}

function MitmSequence({ result, mitm, step, isPlaying, onPlay, onNext, onPrevious, onRestart }) {
  const visible = (target) => step >= target ? 'visible' : 'hidden'
  const stepLabels = ['Alice publishes', 'Eve replaces both keys', 'Alice derives K2', 'Bob publishes', 'K1 matches', 'Attack exposed']
  return <motion.section className="mitm-sequence page-width" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}><div className="mitm-topline"><div><span className="section-kicker danger-kicker"><AlertTriangle size={12} /> ATTACK SIMULATION / ACTIVE</span><h2>Man-in-the-middle sequence</h2><p>Watch Eve replace unauthenticated public keys and establish two separate sessions.</p></div><div className="attack-badge"><span className="status-dot danger-dot" /> MITM ACTIVE</div></div><div className="mitm-lifelines"><div className="lifeline-head"><span className="mitm-avatar alice-avatar"><UserRound size={17} /></span><b>ALICE</b><small>initiator</small></div><div className="lifeline-head eve-head"><span className="mitm-avatar eve-avatar"><AlertTriangle size={17} /></span><b>EVE</b><small>attacker</small></div><div className="lifeline-head"><span className="mitm-avatar bob-avatar"><UserRound size={17} /></span><b>BOB</b><small>responder</small></div><div className="lifeline-line" /><div className="lifeline-line eve-line" /><div className="lifeline-line" /><div className={`mitm-message message-one ${visible(0)}`}><span>yA = g^xA mod p</span><b>{result.alicePublic}</b><i className="moving-packet cyan-packet" /></div><div className={`mitm-message message-d1 ${visible(1)}`}><span>Eve → Bob / yD1</span><b>{mitm.yD1}</b><i className="moving-packet purple-packet" /></div><div className={`mitm-message message-d2 ${visible(1)}`}><span>Eve → Alice / yD2</span><b>{mitm.yD2}</b><i className="moving-packet cyan-packet" /></div><div className={`mitm-message message-bob ${visible(3)}`}><span>yB = g^xB mod p</span><b>{result.bobPublic}</b><i className="moving-packet purple-packet" /></div><div className={`mitm-calc calc-k2 ${visible(2)}`}><small>ALICE ↔ EVE / SESSION K2</small><code>K2 = yD2^xA mod p</code><strong>{mitm.aliceK2}</strong><em>{mitm.aliceK2 === mitm.eveK2 ? 'MATCH' : 'MISMATCH'}</em></div><div className={`mitm-calc calc-k1 ${visible(4)}`}><small>EVE ↔ BOB / SESSION K1</small><code>K1 = yD1^xB mod p</code><strong>{mitm.bobK1}</strong><em>{mitm.bobK1 === mitm.eveK1 ? 'MATCH' : 'MISMATCH'}</em></div></div><div className="mitm-key-strip"><span>xA <b>{result.a}</b></span><span>yA <b>{result.alicePublic}</b></span><span>xD1 <b>{mitm.xD1}</b></span><span>xD2 <b>{mitm.xD2}</b></span><span>yD1 <b>{mitm.yD1}</b></span><span>yD2 <b>{mitm.yD2}</b></span><span>xB <b>{result.b}</b></span><span>yB <b>{result.bobPublic}</b></span></div><div className="mitm-progress"><span>STEP {String(step + 1).padStart(2, '0')} / 06</span><div><motion.i animate={{ width: `${((step + 1) / 6) * 100}%` }} /></div><b>{stepLabels[step]}</b></div><div className="mitm-controls"><button className="round-control" onClick={onPlay} title={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button><button className="round-control" onClick={onPrevious} title="Previous step"><ArrowLeftRight size={16} /></button><button className="round-control" onClick={onNext} title="Next step"><ArrowDown size={16} /></button><button className="round-control" onClick={onRestart} title="Restart"><RotateCcw size={16} /></button><span>Playback controls</span></div><div className={`mitm-warning ${visible(5)}`}><AlertTriangle size={20} /><strong>Alice and Bob believe they are communicating securely, but Eve can intercept the exchange because the public keys are unauthenticated.</strong></div></motion.section>
}

function Participant({ name, role, icon, accent, privateKey, publicKey, secret }) { return <div className={`participant-card ${accent}`}><div className="participant-top"><div className="avatar">{icon}</div><div><h3>{name}</h3><span>{role}</span></div><span className="participant-lock"><LockKeyhole size={14} /></span></div><div className="participant-values"><div><span>PRIVATE KEY</span><b>{toDisplay(privateKey)}</b></div><div><span>PUBLIC KEY</span><b>{toDisplay(publicKey)}</b></div></div><div className="participant-secret"><span>SHARED SECRET</span><strong>{toDisplay(secret)}</strong></div></div> }
function SecretCard({ owner, formula, value, accent }) { return <div className={`secret-card ${accent}`}><span className="card-owner">{owner}</span><code>{formula}</code><strong>{toDisplay(value)}</strong><span className="card-caption">derived locally</span></div> }
function AttackCard({ label, value, detail }) { return <div className="attack-card"><span>{label}</span><strong>{toDisplay(value)}</strong><small>{detail}</small></div> }
export default App
