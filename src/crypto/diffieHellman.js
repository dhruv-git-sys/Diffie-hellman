export function modPow(base, exponent, modulus) {
  if (modulus <= 0n) throw new Error('Modulus must be positive.')

  let result = 1n
  let current = base % modulus
  let remaining = exponent

  while (remaining > 0n) {
    if (remaining % 2n === 1n) result = (result * current) % modulus
    current = (current * current) % modulus
    remaining /= 2n
  }

  return result
}

export function isPrime(value) {
  if (value < 2n) return false
  if (value === 2n) return true
  if (value % 2n === 0n) return false

  for (let divisor = 3n; divisor * divisor <= value; divisor += 2n) {
    if (value % divisor === 0n) return false
  }
  return true
}

function primeFactors(value) {
  const factors = new Set()
  let remaining = value

  for (let divisor = 2n; divisor * divisor <= remaining; divisor += divisor === 2n ? 1n : 2n) {
    if (remaining % divisor === 0n) {
      factors.add(divisor)
      while (remaining % divisor === 0n) remaining /= divisor
    }
  }
  if (remaining > 1n) factors.add(remaining)
  return [...factors]
}

export function isPrimitiveRoot(generator, prime) {
  if (generator <= 1n || generator >= prime) return false
  return primeFactors(prime - 1n).every(
    (factor) => modPow(generator, (prime - 1n) / factor, prime) !== 1n,
  )
}

export function calculateExchange({ p, g, a, b }) {
  const prime = BigInt(p)
  const generator = BigInt(g)
  const alicePrivate = BigInt(a)
  const bobPrivate = BigInt(b)

  const alicePublic = modPow(generator, alicePrivate, prime)
  const bobPublic = modPow(generator, bobPrivate, prime)
  const aliceSecret = modPow(bobPublic, alicePrivate, prime)
  const bobSecret = modPow(alicePublic, bobPrivate, prime)

  return {
    p: prime,
    g: generator,
    a: alicePrivate,
    b: bobPrivate,
    alicePublic,
    bobPublic,
    aliceSecret,
    bobSecret,
    verified: aliceSecret === bobSecret,
  }
}

export function validateInputs(values) {
  const errors = {}
  const parsed = {}

  for (const [key, rawValue] of Object.entries(values)) {
    if (!rawValue.trim()) {
      errors[key] = 'Required'
      continue
    }
    if (!/^\d+$/.test(rawValue.trim())) {
      errors[key] = 'Use a positive whole number'
      continue
    }
    parsed[key] = BigInt(rawValue)
  }

  if (parsed.p !== undefined && !isPrime(parsed.p)) errors.p = 'p must be prime'
  if (parsed.p !== undefined && parsed.g !== undefined && !isPrimitiveRoot(parsed.g, parsed.p)) {
    errors.g = 'g must be a primitive root modulo p'
  }
  if (parsed.p !== undefined && parsed.a !== undefined && (parsed.a < 1n || parsed.a >= parsed.p)) {
    errors.a = 'Use a value from 1 to p - 1'
  }
  if (parsed.p !== undefined && parsed.b !== undefined && (parsed.b < 1n || parsed.b >= parsed.p)) {
    errors.b = 'Use a value from 1 to p - 1'
  }

  return { errors, parsed }
}

export function toDisplay(value) {
  return value === undefined || value === null ? '—' : value.toString()
}