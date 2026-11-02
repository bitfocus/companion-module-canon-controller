import type ModuleInstance from './main.js'
import { functionButtonChoices, functionButtonRangeLabel, TALLY_STATE_CHOICES, type TallyState } from './choices.js'

export type ActionsSchema = {
	select_camera: {
		options: {
			camera: number
		}
	}
	recall_preset: {
		options: {
			preset: number
			target_camera: number
			speed_mode: string
			ptzspeed: number
			ptztime: number
			freeze: string
		}
	}
	stop_preset_move: {
		options: {
			target_camera: number
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
			target_camera: number
		}
	}
}

/** Tooltip shared by every Target Camera field, since the rule is the same for all of them */
const TARGET_CAMERA_TOOLTIP =
	'Camera to act on, leaving the controller on whatever camera is currently selected. 0 acts on the selected camera.'

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
					max: self.state.cameraCount,
					tooltip: `Camera number to select on the controller (1–${self.state.cameraCount})`,
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
					tooltip: 'Preset number to recall',
				},
				{
					id: 'target_camera',
					type: 'number',
					label: 'Target Camera (0 = currently selected)',
					default: 0,
					min: 0,
					max: self.state.cameraCount,
					tooltip: TARGET_CAMERA_TOOLTIP,
				},
				{
					id: 'speed_mode',
					type: 'dropdown',
					label: 'Move Speed',
					default: 'default',
					disableAutoExpression: true,
					choices: [
						{ id: 'default', label: "Camera's own default" },
						{ id: 'saved', label: 'Saved with the preset' },
						{ id: 'speed', label: 'Speed' },
						{ id: 'time', label: 'Time' },
					],
					tooltip:
						'The protocol prefers a time over a speed and either over the saved value, so only the chosen one is sent.',
				},
				{
					id: 'ptzspeed',
					type: 'number',
					label: 'Speed (1–100)',
					default: 50,
					min: 1,
					max: 100,
					isVisibleExpression: "$(options:speed_mode) == 'speed'",
				},
				{
					id: 'ptztime',
					type: 'number',
					label: 'Time (ms)',
					default: 5000,
					min: 2000,
					max: 99000,
					isVisibleExpression: "$(options:speed_mode) == 'time'",
					tooltip: 'Pan, tilt and zoom are synchronised to finish together within this time',
				},
				{
					id: 'freeze',
					type: 'dropdown',
					label: 'Freeze Image During Move',
					default: 'default',
					choices: [
						{ id: 'default', label: "Camera's own setting" },
						{ id: 'off', label: 'Off' },
						{ id: 'on', label: 'On' },
					],
				},
			],
			callback: async (event) => {
				const { preset, target_camera, speed_mode, ptzspeed, ptztime, freeze } = event.options
				const params = [`p=${preset}`]
				// Only ever send one of these: the camera prefers p.ptztime over p.ptzspeed and
				// either over p.ptzspeed.saved, so sending more than one hides the chosen value
				if (speed_mode === 'saved') params.push('p.ptzspeed.saved=on')
				else if (speed_mode === 'speed') params.push(`p.ptzspeed=${ptzspeed}`)
				else if (speed_mode === 'time') params.push(`p.ptztime=${ptztime}`)
				// Omitting p.freeze leaves the camera's own still-image-during-preset setting alone
				if (freeze === 'off' || freeze === 'on') params.push(`p.freeze=${freeze}`)
				if (target_camera > 0) params.push(`camno.target=${target_camera}`)

				const success = await self.sendControl(params.join('&'))
				// A preset recalled on another camera says nothing about the selected one
				if (success && self.actsOnSelectedCamera(target_camera)) {
					self.state.lastPreset = preset
					self.setVariableValues({ last_preset: String(preset) })
					self.checkFeedbacks('active_preset')
				}
			},
		},

		stop_preset_move: {
			name: 'Stop Preset Move',
			options: [
				{
					id: 'target_camera',
					type: 'number',
					label: 'Target Camera (0 = currently selected)',
					default: 0,
					min: 0,
					max: self.state.cameraCount,
					tooltip: TARGET_CAMERA_TOOLTIP,
				},
			],
			callback: async (event) => {
				const target = event.options.target_camera
				const params = ['p.action=stop']
				if (target > 0) params.push(`camno.target=${target}`)
				await self.sendControl(params.join('&'))
			},
		},

		press_function_button: {
			name: 'Press Function Button',
			options: [
				{
					id: 'button',
					type: 'dropdown',
					label: 'Function Button',
					default: self.state.assignMin,
					choices: functionButtonChoices(self),
					tooltip: `Executes the command assigned to the selected USER button (${functionButtonRangeLabel(self)})`,
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
				},
				{
					id: 'target_camera',
					type: 'number',
					label: 'Target Camera (0 = currently selected)',
					default: 0,
					min: 0,
					max: self.state.cameraCount,
					tooltip: TARGET_CAMERA_TOOLTIP,
				},
			],
			callback: async (event) => {
				const { state, target_camera } = event.options
				const params = state === 'off' ? ['f.tally=off'] : ['f.tally=on', `f.tally.mode=${state}`]
				if (target_camera > 0) params.push(`camno.target=${target_camera}`)

				const success = await self.sendControl(params.join('&'))
				// A lamp set on another camera says nothing about the selected one
				if (success && self.actsOnSelectedCamera(target_camera)) {
					self.state.tallyState = state as TallyState
					self.setVariableValues({ tally_state: state })
					self.checkFeedbacks('tally_state')
				}
			},
		},
	})
}
