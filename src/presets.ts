import { combineRgb } from '@companion-module/base'
import type { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type { ModuleSchema } from './main.js'
import type ModuleInstance from './main.js'
import { functionButtonChoices, functionButtonRangeLabel } from './choices.js'

/** Starter buttons offered for cameras and presets, out of the much larger ranges both allow */
const STARTER_BUTTON_COUNT = 10

/** The preset-recall defaults, spelled out so a dropped-in button sends a plain `p=<n>` */
const PLAIN_RECALL_OPTIONS = {
	target_camera: 0,
	speed_mode: 'default',
	ptzspeed: 50,
	ptztime: 5000,
	freeze: 'default',
}

export function UpdatePresets(self: ModuleInstance): void {
	const functionButtons = functionButtonChoices(self)

	const structure: CompanionPresetSection[] = [
		{
			id: 'cameras',
			name: 'Camera Select',
			definitions: [
				{
					id: 'cam_select',
					name: 'Camera Select',
					description: 'Switch the active camera on the controller',
					type: 'simple',
					presets: Array.from({ length: STARTER_BUTTON_COUNT }, (_, i) => `select_camera_${i + 1}`),
				},
			],
		},
		{
			id: 'presets',
			name: 'Presets',
			definitions: [
				{
					id: 'preset_recall',
					name: 'Preset Recall',
					description: 'Recall a stored preset on the active camera',
					type: 'simple',
					presets: Array.from({ length: STARTER_BUTTON_COUNT }, (_, i) => `recall_preset_${i + 1}`),
				},
				{
					id: 'preset_stop',
					name: 'Stop Preset Move',
					description: 'Interrupt a preset move already under way',
					type: 'simple',
					presets: ['stop_preset_move'],
				},
			],
		},
		{
			id: 'function_buttons',
			name: 'Function Buttons',
			definitions: [
				{
					id: 'fn_buttons',
					name: 'Function Buttons',
					description: `Trigger assignable function buttons ${functionButtonRangeLabel(self)}`,
					type: 'simple',
					presets: functionButtons.map((choice) => `function_button_${choice.id}`),
				},
			],
		},
		{
			id: 'tally',
			name: 'Tally',
			definitions: [
				{
					id: 'tally_control',
					name: 'Tally Control',
					description: 'Set the tally lamp state on the active camera',
					type: 'simple',
					presets: ['tally_off', 'tally_program', 'tally_preview'],
				},
			],
		},
	]

	const presets: CompanionPresetDefinitions<ModuleSchema> = {}

	for (let i = 1; i <= STARTER_BUTTON_COUNT; i++) {
		presets[`select_camera_${i}`] = {
			type: 'simple',
			name: `Camera ${i}`,
			style: {
				text: `CAM ${i}`,
				size: 'auto',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 128),
				show_topbar: false,
			},
			steps: [
				{
					down: [{ actionId: 'select_camera', options: { camera: i } }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'current_camera',
					options: { camera: i },
					style: {
						bgcolor: combineRgb(255, 255, 0),
						color: combineRgb(0, 0, 0),
					},
				},
			],
		}
	}

	for (let i = 1; i <= STARTER_BUTTON_COUNT; i++) {
		presets[`recall_preset_${i}`] = {
			type: 'simple',
			name: `Preset ${i}`,
			style: {
				text: `PRESET\n${i}`,
				size: 'auto',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 64, 128),
				show_topbar: false,
			},
			steps: [
				{
					down: [{ actionId: 'recall_preset', options: { preset: i, ...PLAIN_RECALL_OPTIONS } }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'active_preset',
					options: { preset: i },
					style: {
						bgcolor: combineRgb(0, 0, 255),
						color: combineRgb(255, 255, 255),
					},
				},
			],
		}
	}

	presets['stop_preset_move'] = {
		type: 'simple',
		name: 'Stop Preset Move',
		style: {
			text: 'PRESET\nSTOP',
			size: 'auto',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(96, 32, 32),
			show_topbar: false,
		},
		steps: [
			{
				down: [{ actionId: 'stop_preset_move', options: { target_camera: 0 } }],
				up: [],
			},
		],
		feedbacks: [],
	}

	for (const choice of functionButtons) {
		presets[`function_button_${choice.id}`] = {
			type: 'simple',
			name: choice.label,
			style: {
				text: choice.label,
				size: 'auto',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(64, 0, 128),
				show_topbar: false,
			},
			steps: [
				{
					down: [{ actionId: 'press_function_button', options: { button: choice.id } }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'function_button_status',
					options: { button: choice.id },
					style: {
						bgcolor: combineRgb(255, 128, 0),
						color: combineRgb(0, 0, 0),
					},
				},
			],
		}
	}

	presets['tally_off'] = {
		type: 'simple',
		name: 'Tally Off',
		style: {
			text: 'TALLY\nOFF',
			size: 'auto',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(64, 64, 64),
			show_topbar: false,
		},
		steps: [
			{
				down: [{ actionId: 'set_tally', options: { state: 'off', target_camera: 0 } }],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'tally_state',
				options: { state: 'off' },
				style: {
					bgcolor: combineRgb(128, 128, 128),
					color: combineRgb(255, 255, 255),
				},
			},
		],
	}

	presets['tally_program'] = {
		type: 'simple',
		name: 'Tally Program',
		style: {
			text: 'TALLY\nPGM',
			size: 'auto',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(128, 0, 0),
			show_topbar: false,
		},
		steps: [
			{
				down: [{ actionId: 'set_tally', options: { state: 'program', target_camera: 0 } }],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'tally_state',
				options: { state: 'program' },
				style: {
					bgcolor: combineRgb(255, 0, 0),
					color: combineRgb(255, 255, 255),
				},
			},
		],
	}

	presets['tally_preview'] = {
		type: 'simple',
		name: 'Tally Preview',
		style: {
			text: 'TALLY\nPVW',
			size: 'auto',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 96, 32),
			show_topbar: false,
		},
		steps: [
			{
				down: [{ actionId: 'set_tally', options: { state: 'preview', target_camera: 0 } }],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'tally_state',
				options: { state: 'preview' },
				style: {
					bgcolor: combineRgb(0, 200, 0),
					color: combineRgb(0, 0, 0),
				},
			},
		],
	}

	self.setPresetDefinitions(structure, presets)
}
