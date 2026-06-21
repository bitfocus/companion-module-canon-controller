import { combineRgb } from '@companion-module/base'
import type ModuleInstance from './main.js'

export type FeedbacksSchema = {
	connection_status: {
		type: 'boolean'
		options: Record<string, never>
	}
	current_camera: {
		type: 'boolean'
		options: {
			camera: number
		}
	}
	active_preset: {
		type: 'boolean'
		options: {
			preset: number
		}
	}
	function_button_status: {
		type: 'boolean'
		options: {
			button: number
		}
	}
	tally_state: {
		type: 'boolean'
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

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions({
		connection_status: {
			name: 'Connection Status',
			description: 'Active when the RC-IP1000 is online and responding',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(0, 200, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [],
			callback: () => self.state.connected,
		},

		current_camera: {
			name: 'Current Camera',
			description: 'Active when the specified camera is currently selected on the RC-IP1000',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(255, 255, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [
				{
					id: 'camera',
					type: 'number',
					label: 'Camera Number',
					default: 1,
					min: 1,
					max: 200,
				},
			],
			callback: (feedback) => self.state.currentCamera === feedback.options.camera,
		},

		active_preset: {
			name: 'Active Preset',
			description: 'Active when the specified preset was most recently recalled',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(0, 0, 255),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					id: 'preset',
					type: 'number',
					label: 'Preset Number',
					default: 1,
					min: 1,
					max: 100,
				},
			],
			callback: (feedback) => self.state.lastPreset === feedback.options.preset,
		},

		function_button_status: {
			name: 'Function Button Status',
			description: 'Active when the specified function button was most recently pressed',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(255, 128, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [
				{
					id: 'button',
					type: 'dropdown',
					label: 'Function Button',
					default: 1,
					choices: FUNCTION_BUTTON_CHOICES,
				},
			],
			callback: (feedback) => self.state.lastFunctionButton === feedback.options.button,
		},

		tally_state: {
			name: 'Tally State',
			description: 'Active when the tally lamp is in the specified state',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(255, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					id: 'state',
					type: 'dropdown',
					label: 'Tally State',
					default: 'on',
					choices: TALLY_STATE_CHOICES,
				},
			],
			callback: (feedback) => self.state.tallyState === feedback.options.state,
		},
	})
}
