import type ModuleInstance from './main.js'

/** Tally states, keyed the way `f.tally.mode` names them */
export type TallyState = 'off' | 'program' | 'preview' | 'preview_program'

/**
 * Function button choices, sized by what the controller reported in `f.assign.min` and
 * `f.assign.max`. An RC-IP1000 has 10 of them and an RC-IP300 has 12, which is the only
 * difference between the two devices in the protocol, so the list is built from polled
 * state rather than hardcoded and is rebuilt whenever a poll reports different bounds.
 */
export function functionButtonChoices(self: ModuleInstance): { id: number; label: string }[] {
	const { assignMin, assignMax } = self.state
	const count = Math.max(0, assignMax - assignMin + 1)
	return Array.from({ length: count }, (_, i) => ({ id: assignMin + i, label: `F${assignMin + i}` }))
}

/** How the function button range reads in a tooltip, e.g. `F1-F12` */
export function functionButtonRangeLabel(self: ModuleInstance): string {
	return `F${self.state.assignMin}–F${self.state.assignMax}`
}

/**
 * The tally states the protocol defines. `preview_program` is listed only for Cinema EOS
 * and XF605 bodies; the controller relays `f.tally.` parameters to whichever camera is
 * targeted, so whether it is accepted depends on that camera rather than on the controller.
 */
export const TALLY_STATE_CHOICES = [
	{ id: 'off', label: 'Off' },
	{ id: 'program', label: 'On (Program)' },
	{ id: 'preview', label: 'On (Preview)' },
	{ id: 'preview_program', label: 'On (Preview + Program) — Cinema EOS / XF605 only' },
]
