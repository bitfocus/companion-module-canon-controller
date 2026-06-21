import type ModuleInstance from './main.js'

export type VariablesSchema = {
	current_camera: string
	last_preset: string
	tally_state: string
	connection_status: string
}

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions({
		current_camera: { name: 'Current Camera' },
		last_preset: { name: 'Last Preset Recalled' },
		tally_state: { name: 'Tally State' },
		connection_status: { name: 'Connection Status' },
	})

	self.setVariableValues({
		current_camera: String(self.state.currentCamera),
		last_preset: self.state.lastPreset !== null ? String(self.state.lastPreset) : '',
		tally_state: self.state.tallyState,
		connection_status: 'Disconnected',
	})
}
