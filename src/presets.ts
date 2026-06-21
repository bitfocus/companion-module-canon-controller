import { combineRgb } from '@companion-module/base'
import type { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type { ModuleSchema } from './main.js'
import type ModuleInstance from './main.js'

export function UpdatePresets(self: ModuleInstance): void {
	const structure: CompanionPresetSection[] = [
		{
			id: 'cameras',
			name: 'Camera Select',
			definitions: [
				{
					id: 'cam_select',
					name: 'Camera Select',
					description: 'Switch the active camera on the RC-IP1000',
					type: 'simple',
					presets: Array.from({ length: 10 }, (_, i) => `select_camera_${i + 1}`),
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
					presets: Array.from({ length: 10 }, (_, i) => `recall_preset_${i + 1}`),
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
					description: 'Trigger assignable function buttons F1–F10',
					type: 'simple',
					presets: Array.from({ length: 10 }, (_, i) => `function_button_${i + 1}`),
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
					presets: ['tally_off', 'tally_on', 'tally_flash'],
				},
			],
		},
	]

	const presets: CompanionPresetDefinitions<ModuleSchema> = {}

	for (let i = 1; i <= 10; i++) {
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

	for (let i = 1; i <= 10; i++) {
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
					down: [{ actionId: 'recall_preset', options: { preset: i } }],
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

	for (let i = 1; i <= 10; i++) {
		presets[`function_button_${i}`] = {
			type: 'simple',
			name: `F${i}`,
			style: {
				text: `F${i}`,
				size: 'auto',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(64, 0, 128),
				show_topbar: false,
			},
			steps: [
				{
					down: [{ actionId: 'press_function_button', options: { button: i } }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'function_button_status',
					options: { button: i },
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
				down: [{ actionId: 'set_tally', options: { state: 'off' } }],
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

	presets['tally_on'] = {
		type: 'simple',
		name: 'Tally On',
		style: {
			text: 'TALLY\nON',
			size: 'auto',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(128, 0, 0),
			show_topbar: false,
		},
		steps: [
			{
				down: [{ actionId: 'set_tally', options: { state: 'on' } }],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'tally_state',
				options: { state: 'on' },
				style: {
					bgcolor: combineRgb(255, 0, 0),
					color: combineRgb(255, 255, 255),
				},
			},
		],
	}

	presets['tally_flash'] = {
		type: 'simple',
		name: 'Tally Flash',
		style: {
			text: 'TALLY\nFLASH',
			size: 'auto',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(128, 64, 0),
			show_topbar: false,
		},
		steps: [
			{
				down: [{ actionId: 'set_tally', options: { state: 'flash' } }],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'tally_state',
				options: { state: 'flash' },
				style: {
					bgcolor: combineRgb(255, 128, 0),
					color: combineRgb(0, 0, 0),
				},
			},
		],
	}

	self.setPresetDefinitions(structure, presets)
}
