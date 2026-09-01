import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig, type ModuleSecrets } from './config.js'
import { UpdateVariableDefinitions, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { buildDigestAuthHeader, parseDigestChallenge, type DigestChallenge } from './digest.js'

export type ModuleSchema = {
	config: ModuleConfig
	secrets: ModuleSecrets
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

/**
 * Floor for the poll interval. The Controller answers in roughly 300ms and serves one
 * request at a time, so polling faster than this starves the commands we send without
 * surfacing changes any sooner.
 */
const MIN_POLLING_RATE_MS = 1000

/**
 * How long to wait after a command before refreshing state. The Controller reflects a
 * command as soon as it answers it, so this is not a settling delay: it only gathers a
 * burst of commands from one button press into a single refresh.
 */
const COMMAND_REFRESH_DEBOUNCE_MS = 100

/** How many freshly issued challenges must be refused before we blame the credentials */
const AUTH_FAILURES_BEFORE_BAD_CONFIG = 3

export interface DeviceState {
	currentCamera: number
	cameraCount: number
	assignMin: number
	assignMax: number
	lastPreset: number | null
	lastFunctionButton: number | null
	tallyState: 'off' | 'on' | 'flash'
	connected: boolean
}

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	config!: ModuleConfig
	secrets!: ModuleSecrets

	state: DeviceState = {
		currentCamera: 1,
		cameraCount: 200,
		assignMin: 1,
		assignMax: 10,
		lastPreset: null,
		lastFunctionButton: null,
		tallyState: 'off',
		connected: false,
	}

	private pollTimer: ReturnType<typeof setInterval> | null = null
	/** Cached digest challenge, reused across requests until the Controller rejects it */
	private digestChallenge: DigestChallenge | null = null
	/** Tail of the request chain, used to keep authenticated requests one at a time */
	private requestChain: Promise<unknown> = Promise.resolve()
	/** Consecutive rejections of a freshly issued challenge, to avoid acting on a one-off */
	private authFailures = 0
	/** Whether a poll is already running, so ticks cannot stack up behind a slow request */
	private pollInFlight = false
	/** Pending refresh scheduled after a command, so feedbacks do not wait for the next tick */
	private refreshTimer: ReturnType<typeof setTimeout> | null = null

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig, _isFirstInit: boolean, secrets: ModuleSecrets): Promise<void> {
		this.config = config
		this.secrets = secrets
		this.updateStatus(InstanceStatus.Connecting)
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()
		this.startPolling()
	}

	async destroy(): Promise<void> {
		this.stopPolling()
	}

	async configUpdated(config: ModuleConfig, secrets: ModuleSecrets): Promise<void> {
		this.config = config
		this.secrets = secrets
		this.digestChallenge = null
		this.authFailures = 0
		this.stopPolling()
		this.state.connected = false
		this.updateStatus(InstanceStatus.Connecting)
		this.startPolling()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	private buildBaseUrl(): string {
		return `http://${this.config.host}:${this.config.port}/-wvhttp-01-`
	}

	/**
	 * Run `work` once every previously queued request has settled.
	 *
	 * The Controller only keeps one digest nonce alive at a time: asking for a new
	 * challenge silently invalidates the previous one. Two requests re-authenticating
	 * at once would therefore knock each other out, so every authenticated request
	 * takes its turn instead. Requests are short and polling is comparatively slow,
	 * so in practice nothing waits long.
	 */
	private async enqueue<T>(work: () => Promise<T>): Promise<T> {
		const result = this.requestChain.then(work, work)
		// Keep the chain alive regardless of how this request turned out
		this.requestChain = result.catch(() => undefined)
		return result
	}

	/**
	 * Fetch with HTTP Digest authentication. The Controller answers an unauthenticated
	 * request with a challenge, so the first request of a session costs a round trip;
	 * the challenge is then cached and reused until the Controller rejects it.
	 *
	 * The Controller expires its nonce every so often, and when it does it answers with
	 * a bare 401 carrying no `WWW-Authenticate` header at all, contrary to RFC 9110. A
	 * plain unauthenticated request always yields a fresh challenge, so that is how we
	 * re-authenticate. `credentialsRejected` is only reported once the Controller has
	 * turned down several freshly issued challenges in a row, which is the one case
	 * that really does mean the username or password is wrong.
	 */
	private async authenticatedFetch(url: string): Promise<{ response: Response; credentialsRejected: boolean }> {
		return this.enqueue(async () => {
			const username = this.config.username ?? ''
			const password = this.secrets?.password ?? ''
			const parsedUrl = new URL(url)
			const requestUri = parsedUrl.pathname + parsedUrl.search

			const send = async (authorization: string | null): Promise<Response> =>
				fetch(url, {
					headers: authorization ? { Authorization: authorization } : {},
					signal: AbortSignal.timeout(5000),
				})

			const request = async (authorization: string | null): Promise<Response> => {
				try {
					return await send(authorization)
				} catch (err) {
					// The Controller closes the connection after every 401, so a pooled socket
					// can be reused just as it goes away. A second attempt gets a fresh one.
					if (!isDroppedConnection(err)) throw err
					this.log('debug', 'Retrying request after the Controller dropped the connection')
					return send(authorization)
				}
			}

			const response = await request(
				this.digestChallenge
					? buildDigestAuthHeader(this.digestChallenge, username, password, 'GET', requestUri)
					: null,
			)
			if (response.status !== 401) {
				this.authFailures = 0
				return { response, credentialsRejected: false }
			}

			// Prefer the challenge on the 401 itself, and fall back to asking for one
			let challenge = parseDigestChallenge(response.headers.get('www-authenticate'))
			if (!challenge) {
				await discardBody(response)
				const challengeResponse = await request(null)
				challenge = parseDigestChallenge(challengeResponse.headers.get('www-authenticate'))
				await discardBody(challengeResponse)
			}

			this.digestChallenge = challenge
			if (!challenge) {
				// No challenge to answer, so we cannot tell whether the credentials are good
				this.log('warn', 'Controller returned 401 without an authentication challenge')
				return { response, credentialsRejected: false }
			}

			const retry = await request(buildDigestAuthHeader(challenge, username, password, 'GET', requestUri))
			if (retry.status !== 401) {
				this.authFailures = 0
				return { response: retry, credentialsRejected: false }
			}

			this.digestChallenge = null
			this.authFailures += 1
			this.log('warn', `Controller rejected a freshly issued challenge (attempt ${this.authFailures})`)
			return { response: retry, credentialsRejected: this.authFailures >= AUTH_FAILURES_BEFORE_BAD_CONFIG }
		})
	}

	async sendControl(params: string): Promise<boolean> {
		if (!this.config.host) return false
		try {
			const url = `${this.buildBaseUrl()}/control.cgi?${params}`
			this.log('debug', `Sending control command: ${url}`)
			const { response, credentialsRejected } = await this.authenticatedFetch(url)
			await discardBody(response)
			if (!response.ok) {
				this.log(
					'warn',
					credentialsRejected
						? `Control command rejected: invalid username or password for ${params}`
						: `Control command failed: HTTP ${response.status} for ${params}`,
				)
				return false
			}
			// The command changed something, so pick it up now rather than at the next tick
			this.scheduleRefresh()
			return true
		} catch (err) {
			this.log('error', `Control command error: ${err}`)
			return false
		}
	}

	private startPolling(): void {
		if (!this.config.host) {
			this.updateStatus(InstanceStatus.BadConfig, 'IP Address is required')
			return
		}
		void this.poll()
		const interval = Math.max(MIN_POLLING_RATE_MS, this.config.pollingRate ?? 5000)
		this.pollTimer = setInterval(() => void this.poll(), interval)
	}

	private stopPolling(): void {
		if (this.pollTimer !== null) {
			clearInterval(this.pollTimer)
			this.pollTimer = null
		}
		if (this.refreshTimer !== null) {
			clearTimeout(this.refreshTimer)
			this.refreshTimer = null
		}
	}

	/**
	 * Poll shortly after a command, so button feedback follows the action instead of
	 * waiting up to a full polling interval. Repeated commands share one refresh.
	 */
	private scheduleRefresh(): void {
		// Nothing to refresh into if polling is stopped, and we should not restart it here
		if (this.pollTimer === null) return

		if (this.refreshTimer !== null) clearTimeout(this.refreshTimer)
		this.refreshTimer = setTimeout(() => {
			this.refreshTimer = null
			// A poll already running was issued before the command, so it cannot see the
			// change; let it finish and refresh after it
			if (this.pollInFlight) {
				this.scheduleRefresh()
				return
			}
			void this.poll()
		}, COMMAND_REFRESH_DEBOUNCE_MS)
	}

	private async poll(): Promise<void> {
		// Requests take their turn, so a slow one must not let polls stack up behind it
		if (this.pollInFlight) return
		this.pollInFlight = true
		try {
			const url = `${this.buildBaseUrl()}/info.cgi`
			const { response, credentialsRejected } = await this.authenticatedFetch(url)

			//only a challenge we answered and the Controller still refused means the username/password is wrong.
			//any other 401 is the Controller expiring its nonce, which the next poll re-authenticates through
			if (credentialsRejected) {
				await discardBody(response)
				this.updateStatus(InstanceStatus.BadConfig, 'Invalid username or password')
				this.setVariableValues({ connection_status: 'Invalid Login' })
				this.stopPolling()
				throw new Error('Invalid username or password')
			}

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`)
			}

			const text = await response.text()
			this.parseInfoResponse(text)

			if (!this.state.connected) {
				this.state.connected = true
				this.updateStatus(InstanceStatus.Ok)
				this.checkFeedbacks('connection_status')
			}
		} catch (err) {
			if (this.state.connected) {
				this.state.connected = false
				this.updateStatus(InstanceStatus.ConnectionFailure, `${err}`)
				this.checkFeedbacks('connection_status')
				this.setVariableValues({ connection_status: 'Disconnected' })
			}
			if (!this.config.autoReconnect) {
				this.stopPolling()
			}
		} finally {
			this.pollInFlight = false
		}
	}

	private parseInfoResponse(text: string): void {
		const parsed: Record<string, string> = {}
		for (const line of text.split('\n')) {
			const match = line.match(/^(.+?):=(.*)$/)
			if (match) parsed[match[1].trim()] = match[2].trim()
		}

		const camno = parseInt(parsed['camno'] ?? '', 10)
		if (!isNaN(camno) && camno !== this.state.currentCamera) {
			this.state.currentCamera = camno
			this.setVariableValues({ current_camera: String(camno) })
			this.checkFeedbacks('current_camera')
		}

		const cameraCount = parseInt(parsed['camno.count'] ?? '', 10)
		if (!isNaN(cameraCount)) this.state.cameraCount = cameraCount

		const assignMin = parseInt(parsed['f.assign.min'] ?? '', 10)
		if (!isNaN(assignMin)) this.state.assignMin = assignMin

		const assignMax = parseInt(parsed['f.assign.max'] ?? '', 10)
		if (!isNaN(assignMax)) this.state.assignMax = assignMax

		this.setVariableValues({ connection_status: 'Connected' })
	}
}

/**
 * Release a response we are not going to read, so the socket is not held open.
 */
async function discardBody(response: Response): Promise<void> {
	try {
		await response.body?.cancel()
	} catch {
		// The body may already be consumed or the connection gone; neither matters here
	}
}

/**
 * Whether an error is the connection being dropped underneath us, as opposed to a
 * timeout or a genuine failure to reach the Controller. Only these are worth retrying.
 */
function isDroppedConnection(err: unknown): boolean {
	const code = (err as { cause?: { code?: string } })?.cause?.code
	return code === 'UND_ERR_SOCKET' || code === 'ECONNRESET' || code === 'EPIPE'
}
