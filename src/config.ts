import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

export type ModuleConfig = {
	host: string
	port: number
	username: string
	password: string
	autoReconnect: boolean
	pollingRate: number
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'IP Address',
			width: 8,
			regex: Regex.IP,
			default: '',
			tooltip: 'IP address of the Controller',
		},
		{
			type: 'number',
			id: 'port',
			label: 'Network Port',
			width: 4,
			min: 1,
			max: 65535,
			default: 50080,
			tooltip: 'Network port (Controller HTTP default: 50080)',
		},
		{
			type: 'textinput',
			id: 'username',
			label: 'Username',
			width: 6,
			default: '',
			tooltip: 'Username configured on the Controller',
		},
		{
			type: 'textinput',
			id: 'password',
			label: 'Password',
			width: 6,
			default: '',
			tooltip: 'Password configured on the Controller',
		},
		{
			type: 'checkbox',
			id: 'autoReconnect',
			label: 'Auto Reconnect',
			width: 4,
			default: true,
			tooltip: 'Automatically retry polling if the connection is lost',
		},
		{
			type: 'number',
			id: 'pollingRate',
			label: 'Polling Rate (ms)',
			width: 8,
			min: 500,
			max: 30000,
			default: 5000,
			tooltip: 'How often to poll the Controller for status updates (milliseconds)',
		},
	]
}
