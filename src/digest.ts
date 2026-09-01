import { createHash, randomBytes } from 'crypto'

/**
 * A parsed `WWW-Authenticate: Digest ...` challenge from the Controller.
 */
export interface DigestChallenge {
	realm: string
	nonce: string
	qop: string | null
	opaque: string | null
	algorithm: string
	nonceCount: number
}

/**
 * Parse a `WWW-Authenticate` header value. Returns null if it is not a Digest challenge.
 */
export function parseDigestChallenge(header: string | null): DigestChallenge | null {
	if (!header) return null

	const match = header.match(/^\s*Digest\s+(.*)$/is)
	if (!match) return null

	const params: Record<string, string> = {}
	const paramRegex = /([a-zA-Z0-9_-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^,\s]+))/g
	let param: RegExpExecArray | null
	while ((param = paramRegex.exec(match[1])) !== null) {
		params[param[1].toLowerCase()] = (param[2] !== undefined ? param[2].replace(/\\(.)/g, '$1') : param[3]).trim()
	}

	if (!params.nonce) return null

	// Servers may offer several qop values; `auth` is the only one we implement
	const qopOptions = params.qop ? params.qop.split(',').map((q) => q.trim().toLowerCase()) : []

	return {
		realm: params.realm ?? '',
		nonce: params.nonce,
		qop: qopOptions.includes('auth') ? 'auth' : null,
		opaque: params.opaque ?? null,
		algorithm: (params.algorithm ?? 'MD5').toUpperCase(),
		nonceCount: 0,
	}
}

function hashFor(algorithm: string): (value: string) => string {
	// Strip the `-sess` suffix, it selects the HA1 derivation rather than the hash
	const base = algorithm.replace(/-SESS$/, '')
	const nodeAlgorithm = base === 'SHA-256' ? 'sha256' : base === 'SHA-512-256' ? 'sha512-256' : 'md5'
	return (value: string) => createHash(nodeAlgorithm).update(value).digest('hex')
}

/**
 * Build the `Authorization` header for a request answering the given challenge.
 * Mutates `challenge.nonceCount`, so a challenge must be reused for subsequent
 * requests rather than each one being computed from a fresh copy.
 *
 * @param uri Path and query of the request, as sent in the request line
 */
export function buildDigestAuthHeader(
	challenge: DigestChallenge,
	username: string,
	password: string,
	method: string,
	uri: string,
): string {
	const hash = hashFor(challenge.algorithm)
	const cnonce = randomBytes(16).toString('hex')
	challenge.nonceCount += 1
	const nc = challenge.nonceCount.toString(16).padStart(8, '0')

	let ha1 = hash(`${username}:${challenge.realm}:${password}`)
	if (challenge.algorithm.endsWith('-SESS')) {
		ha1 = hash(`${ha1}:${challenge.nonce}:${cnonce}`)
	}
	const ha2 = hash(`${method}:${uri}`)

	const response = challenge.qop
		? hash(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`)
		: hash(`${ha1}:${challenge.nonce}:${ha2}`)

	const parts = [
		`username="${escapeQuoted(username)}"`,
		`realm="${escapeQuoted(challenge.realm)}"`,
		`nonce="${escapeQuoted(challenge.nonce)}"`,
		`uri="${escapeQuoted(uri)}"`,
		`response="${response}"`,
		`algorithm=${challenge.algorithm}`,
	]
	if (challenge.qop) {
		parts.push(`qop=${challenge.qop}`, `nc=${nc}`, `cnonce="${cnonce}"`)
	}
	if (challenge.opaque !== null) {
		parts.push(`opaque="${escapeQuoted(challenge.opaque)}"`)
	}

	return `Digest ${parts.join(', ')}`
}

function escapeQuoted(value: string): string {
	return value.replace(/(["\\])/g, '\\$1')
}
