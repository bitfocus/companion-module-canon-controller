import type ModuleInstance from './main.js'

export type ActionsSchema = {
	select_camera: {
		options: {
			camera: number
		}
	}
	recall_preset: {
		options: {
			preset: number
		}
	}
	press_function_button: {
		options: {
			button: number
		}
	}
	set_tally: {
		options: {
			state: string
		}
	}
}

const FUNCTION_BUTTON_CHOICES = Array.from({ length: 10 }, (_, i) => ({
	id: i + 1,
	label: `F${i + 1}`,
}))

const TALLY_STATE_CHOICES = [
	{ id: 'off', label: 'Off' },
	{ id: 'on', label: 'On (Program)' },
	{ id: 'flash', label: 'Flash (Preview)' },
]

export function UpdateActions(self: ModuleInstance): void {
	self.setActionDefinitions({
		select_camera: {
			name: 'Select Camera',
			options: [
				{
					id: 'camera',
					type: 'number',
					label: 'Camera Number',
					default: 1,
					min: 1,
					max: 200,
					tooltip: 'Camera number to select on the RC-IP1000 (1–200)',
				},
			],
			callback: async (event) => {
				const cam = event.options.camera
				const success = await self.sendControl(`camno=${cam}`)
				if (success) {
					self.state.currentCamera = cam
					self.setVariableValues({ current_camera: String(cam) })
					self.checkFeedbacks('current_camera')
				}
			},
		},

		recall_preset: {
			name: 'Recall Preset',
			options: [
				{
					id: 'preset',
					type: 'number',
					label: 'Preset Number',
					default: 1,
					min: 1,
					max: 100,
					tooltip: 'Preset number to recall on the currently selected camera',
				},
			],
			callback: async (event) => {
				const preset = event.options.preset
				const success = await self.sendControl(`p=${preset}`)
				if (success) {
					self.state.lastPreset = preset
					self.setVariableValues({ last_preset: String(preset) })
					self.checkFeedbacks('active_preset')
				}
			},
		},

		press_function_button: {
			name: 'Press Function Button',
			options: [
				{
					id: 'button',
					type: 'dropdown',
					label: 'Function Button',
					default: 1,
					choices: FUNCTION_BUTTON_CHOICES,
					tooltip: 'Executes the command assigned to the selected USER button (F1–F10)',
				},
			],
			callback: async (event) => {
				const button = event.options.button
				const success = await self.sendControl(`f.assign=${button}`)
				if (success) {
					self.state.lastFunctionButton = button
					self.checkFeedbacks('function_button_status')
				}
			},
		},

		set_tally: {
			name: 'Set Tally State',
			options: [
				{
					id: 'state',
					type: 'dropdown',
					label: 'Tally State',
					default: 'off',
					choices: TALLY_STATE_CHOICES,
					tooltip: 'Sets the tally lamp state on the currently selected camera',
				},
			],
			callback: async (event) => {
				const state = event.options.state
				let params: string
				if (state === 'off') {
					params = 'f.tally=off'
				} else if (state === 'on') {
					params = 'f.tally=on&f.tally.mode=program'
				} else {
					// flash → preview mode
					params = 'f.tally=on&f.tally.mode=preview'
				}
				const success = await self.sendControl(params)
				if (success) {
					self.state.tallyState = state as 'off' | 'on' | 'flash'
					self.setVariableValues({ tally_state: state })
					self.checkFeedbacks('tally_state')
				}
			},
		},
	})
}
