# Canon Camera Controller

Controls the Canon RC-IP1000 and RC-IP300 remote camera controllers over their HTTP API, allowing you to select cameras, recall presets, trigger function buttons, and set tally states.

The two controllers share one command set. The module asks the controller what it is capable of rather than asking you which one you have, so there is no model to pick: an RC-IP300 reports 12 function buttons where an RC-IP1000 reports 10, and the action and preset lists resize themselves on the first poll.

Tested against RC-IP1000 firmware 1.3.0 and RC-IP300 firmware 1.0.0.

## Configuration

| Field             | Default | Description                                             |
| ----------------- | ------- | ------------------------------------------------------- |
| IP Address        | —       | IP address of the controller                            |
| Network Port      | 50080   | HTTP port on the controller                             |
| Username          | —       | Username configured on the device                       |
| Password          | —       | Password configured on the device                       |
| Auto Reconnect    | Enabled | Retry polling automatically after connection loss       |
| Polling Rate (ms) | 5000    | How often to poll the device for status (1000–30000 ms) |

The module uses HTTP Digest Authentication and polls the device's `info.cgi` endpoint at the configured interval to keep state in sync.

**A username and password must be configured on the controller itself.** If they are not, the controller answers every command with `405 Method Not Allowed` and the module reports "The controller has no username and password configured". Setting them in Companion alone is not enough.

---

## Actions

### Select Camera

Switches the active camera on the controller.

| Option        | Range          | Description           |
| ------------- | -------------- | --------------------- |
| Camera Number | 1–camera count | Camera to make active |

The upper bound comes from the controller's own `camno.count`, which is 200 on both models.

### Recall Preset

Recalls a stored position preset.

| Option                   | Range / Choices                    | Description                                        |
| ------------------------ | ---------------------------------- | -------------------------------------------------- |
| Preset Number            | 1–100                              | Preset to recall                                   |
| Target Camera            | 0–camera count                     | 0 recalls on the selected camera (see below)       |
| Move Speed               | Camera default, Saved, Speed, Time | Which timing the camera should use                 |
| Speed                    | 1–100                              | Shown when Move Speed is **Speed**                 |
| Time (ms)                | 2000–99000                         | Shown when Move Speed is **Time**                  |
| Freeze Image During Move | Camera's own setting, Off, On      | Whether to hold a still image while the head moves |

Only one timing parameter is ever sent. The camera prefers a time over a speed, and prefers either over the value saved with the preset, so sending more than one would silently discard your choice. Leaving **Move Speed** or **Freeze** on the camera's own setting sends nothing for it and lets the camera's configuration stand.

### Stop Preset Move

Interrupts a preset move already under way, leaving the head where it is.

| Option        | Range          | Description                             |
| ------------- | -------------- | --------------------------------------- |
| Target Camera | 0–camera count | 0 stops the move on the selected camera |

### Press Function Button

Executes the command assigned to a USER function button.

| Option          | Choices                    | Description                               |
| --------------- | -------------------------- | ----------------------------------------- |
| Function Button | F1–F10, or F1–F12 on a 300 | Button whose assigned action is triggered |

### Set Tally State

Sets the tally lamp state.

| Option        | Choices                                                 | Description                            |
| ------------- | ------------------------------------------------------- | -------------------------------------- |
| Tally State   | Off, On (Program), On (Preview), On (Preview + Program) | Desired tally lamp state               |
| Target Camera | 0–camera count                                          | 0 sets the lamp on the selected camera |

- **Off** — tally lamp off
- **On (Program)** — tally lamp in program mode
- **On (Preview)** — tally lamp in preview mode
- **On (Preview + Program)** — only defined for Cinema EOS and XF605 bodies. The controller relays the request to whichever camera is targeted, so a camera that does not support it will refuse it.

### Target Camera

**Recall Preset**, **Stop Preset Move** and **Set Tally State** all take an optional target camera. Leave it at **0** and the command goes to whichever camera is currently selected on the controller, which is how the module has always behaved.

Give it a camera number and the command goes to that camera instead, **without moving the controller off the camera the operator is using**. This is how you drive a preset or a tally lamp on camera 5 from Companion while an operator stays on camera 2.

Two things to know about it:

- Only the preset and tally parameters are relayed to the target camera. Whether a given command works depends on that camera's own specification, and the controller cannot tell you in advance that it will not.
- The module's preset and tally feedbacks track the **selected** camera only. A command aimed at a different camera deliberately leaves them alone rather than reporting something untrue about the selected one.

---

## Feedbacks

All feedbacks are boolean (true/false) and can change button style when active.

> **What the controller does and does not report.** `info.cgi` answers with four values and nothing else: the selected camera, the camera count, and the function button range. Preset, function button and tally state are never reported back. The last three feedbacks below can therefore only show what this module last sent, and they go stale the moment someone uses the controller's own panel or a second Companion instance.

### Connection Status

Active when the controller is online and responding to polls.

Default active style: green background.

### Current Camera

Active when the specified camera number is currently selected on the controller. This one does reflect the device.

| Option        | Range          |
| ------------- | -------------- |
| Camera Number | 1–camera count |

Default active style: yellow background, black text.

### Last Preset Recalled

Active when this module last recalled the specified preset. Not a report of which preset the camera is actually on.

| Option        | Range |
| ------------- | ----- |
| Preset Number | 1–100 |

Default active style: blue background, white text.

### Last Function Button Pressed

Active when this module last pressed the specified function button. A press on the controller's own panel will not show here.

| Option          | Choices                    |
| --------------- | -------------------------- |
| Function Button | F1–F10, or F1–F12 on a 300 |

Default active style: orange background, black text.

### Last Tally State Set

Active when this module last set the specified tally state. Not a report of the lamp itself.

| Option      | Choices                                                 |
| ----------- | ------------------------------------------------------- |
| Tally State | Off, On (Program), On (Preview), On (Preview + Program) |

Default active style: red background, white text.

---

## Variables

| Variable                        | Description                          | Example Values                                                        |
| ------------------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| `$(instance:current_camera)`    | Currently selected camera number     | `1`                                                                   |
| `$(instance:last_preset)`       | Most recently recalled preset number | `3`                                                                   |
| `$(instance:tally_state)`       | Tally state this module last set     | `off`, `program`, `preview`, `preview_program`                        |
| `$(instance:connection_status)` | Connection state                     | `Connected`, `Disconnected`, `Invalid Login`, `No Device Credentials` |

---

## Presets

Ready-made buttons are provided in four groups. Drag them onto your Companion surface to get started quickly.

### Camera Select (Cameras 1–10)

One button per camera (`CAM 1` through `CAM 10`). Each button:

- Triggers **Select Camera** on press
- Highlights yellow when that camera is active

### Preset Recall (Presets 1–10)

One button per preset (`PRESET 1` through `PRESET 10`). Each button:

- Triggers **Recall Preset** on press, with the camera's own speed and freeze settings
- Highlights blue when that preset was most recently recalled

A `PRESET STOP` button is also provided, which interrupts a move in progress.

### Function Buttons

One button per function button, F1–F10 on an RC-IP1000 and F1–F12 on an RC-IP300. Each button:

- Triggers **Press Function Button** on press
- Highlights orange when that button was most recently pressed

### Tally

Three buttons for tally control:

| Preset    | Action                  | Active Style    |
| --------- | ----------------------- | --------------- |
| TALLY OFF | Sets tally off          | Grey highlight  |
| TALLY PGM | Sets tally program mode | Red highlight   |
| TALLY PVW | Sets tally preview mode | Green highlight |

Preview + Program has no preset button, since it only applies to Cinema EOS and XF605 targets. Use the **Set Tally State** action for it.
