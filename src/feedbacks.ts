import { combineRgb } from '@companion-module/base'
import type ModuleInstance from './main.js'
import { functionButtonChoices, TALLY_STATE_CHOICES } from './choices.js'

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

/**
 * `info.cgi` on these controllers answers with four values and nothing else: `camno`,
 * `camno.count`, `f.assign.min` and `f.assign.max`. Preset, function button and tally
 * state are never reported back, so the three feedbacks below can only show what this
 * module last sent. Anyone touching the controller's own panel, or a second Companion
 * instance, will leave them stale, and their descriptions say so.
 */
const UNREPORTED_STATE_NOTE = 'The controller does not report this, so it reflects what Companion last sent'

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions({
		connection_status: {
			name: 'Connection Status',
			description: 'Active when the controller is online and responding',
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
			description: 'Active when the specified camera is currently selected on the controller',
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
					max: self.state.cameraCount,
				},
			],
			callback: (feedback) => self.state.currentCamera === feedback.options.camera,
		},

		active_preset: {
			name: 'Last Preset Recalled',
			description: `Active when this module last recalled the specified preset. ${UNREPORTED_STATE_NOTE}, not which preset the camera is actually on.`,
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
			name: 'Last Function Button Pressed',
			description: `Active when this module last pressed the specified function button. ${UNREPORTED_STATE_NOTE}, so a press on the controller's own panel will not show here.`,
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
					default: self.state.assignMin,
					choices: functionButtonChoices(self),
				},
			],
			callback: (feedback) => self.state.lastFunctionButton === feedback.options.button,
		},

		tally_state: {
			name: 'Last Tally State Set',
			description: `Active when this module last set the specified tally state. ${UNREPORTED_STATE_NOTE}, not the state of the lamp itself.`,
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
					default: 'program',
					choices: TALLY_STATE_CHOICES,
				},
			],
			callback: (feedback) => self.state.tallyState === feedback.options.state,
		},
	})
}
