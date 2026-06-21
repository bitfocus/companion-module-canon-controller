import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'

export type ModuleSchema = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

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

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
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

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
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

	private getAuthHeader(): string {
		const username = this.config.username ?? ''
		const password = this.config.password ?? ''
		return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
	}

	async sendControl(params: string): Promise<boolean> {
		if (!this.config.host) return false
		try {
			const url = `${this.buildBaseUrl()}/control.cgi?${params}`
			const response = await fetch(url, {
				headers: { Authorization: this.getAuthHeader() },
				signal: AbortSignal.timeout(5000),
			})
			if (!response.ok) {
				this.log('warn', `Control command failed: HTTP ${response.status} for ${params}`)
				return false
			}
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
		const interval = Math.max(500, this.config.pollingRate ?? 5000)
		this.pollTimer = setInterval(() => void this.poll(), interval)
	}

	private stopPolling(): void {
		if (this.pollTimer !== null) {
			clearInterval(this.pollTimer)
			this.pollTimer = null
		}
	}

	private async poll(): Promise<void> {
		try {
			const url = `${this.buildBaseUrl()}/info.cgi`
			const response = await fetch(url, {
				headers: { Authorization: this.getAuthHeader() },
				signal: AbortSignal.timeout(5000),
			})

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
