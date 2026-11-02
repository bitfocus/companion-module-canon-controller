import type {
	CompanionMigrationAction,
	CompanionMigrationFeedback,
	CompanionMigrationOptionValues,
	CompanionStaticUpgradeScript,
} from '@companion-module/base'
import type { ModuleConfig } from './config.js'

/**
 * The tally choices used to be Off / On / Flash. "Flash" was really the protocol's `preview`
 * mode -- whether the lamp flashes is the camera's business and the specification never says
 * it does -- so the ids now match `f.tally.mode` and existing buttons are moved across.
 */
const TALLY_STATE_RENAMES: Record<string, string> = {
	on: 'program',
	flash: 'preview',
}

function renameTallyState(options: CompanionMigrationOptionValues): boolean {
	const state = options.state
	// An expression computes its own value, so there is nothing here for us to rename
	if (!state || state.isExpression || typeof state.value !== 'string') return false

	const renamed = TALLY_STATE_RENAMES[state.value]
	if (!renamed) return false

	options.state = { value: renamed, isExpression: false }
	return true
}

const renameTallyStateIds: CompanionStaticUpgradeScript<ModuleConfig> = (_context, props) => {
	const updatedActions: CompanionMigrationAction[] = []
	const updatedFeedbacks: CompanionMigrationFeedback[] = []

	for (const action of props.actions) {
		if (action.actionId === 'set_tally' && renameTallyState(action.options)) updatedActions.push(action)
	}

	for (const feedback of props.feedbacks) {
		if (feedback.feedbackId === 'tally_state' && renameTallyState(feedback.options)) updatedFeedbacks.push(feedback)
	}

	return { updatedConfig: null, updatedActions, updatedFeedbacks }
}

export const UpgradeScripts: CompanionStaticUpgradeScript<ModuleConfig>[] = [renameTallyStateIds]
