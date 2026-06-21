# Canon RC-IP1000 Controller

Controls the Canon RC-IP1000 remote camera controller over its HTTP API, allowing you to select cameras, recall presets, trigger function buttons, and set tally states.

## Configuration

| Field             | Default | Description                                            |
| ----------------- | ------- | ------------------------------------------------------ |
| IP Address        | —       | IP address of the RC-IP1000                            |
| Network Port      | 50080   | HTTP port on the controller                            |
| Username          | —       | Username configured on the device                      |
| Password          | —       | Password configured on the device                      |
| Auto Reconnect    | Enabled | Retry polling automatically after connection loss      |
| Polling Rate (ms) | 5000    | How often to poll the device for status (500–30000 ms) |

The module uses HTTP Basic Authentication and polls the device's `info.cgi` endpoint at the configured interval to keep state in sync.

---

## Actions

### Select Camera

Switches the active camera on the RC-IP1000.

| Option        | Range | Description           |
| ------------- | ----- | --------------------- |
| Camera Number | 1–200 | Camera to make active |

### Recall Preset

Recalls a stored position preset on the currently selected camera.

| Option        | Range | Description      |
| ------------- | ----- | ---------------- |
| Preset Number | 1–100 | Preset to recall |

### Press Function Button

Executes the command assigned to a USER function button (F1–F10).

| Option          | Choices | Description                               |
| --------------- | ------- | ----------------------------------------- |
| Function Button | F1–F10  | Button whose assigned action is triggered |

### Set Tally State

Sets the tally lamp state on the currently selected camera.

| Option      | Choices                            | Description              |
| ----------- | ---------------------------------- | ------------------------ |
| Tally State | Off, On (Program), Flash (Preview) | Desired tally lamp state |

- **Off** — tally lamp off
- **On (Program)** — solid tally lamp in program mode
- **Flash (Preview)** — flashing tally lamp in preview mode

---

## Feedbacks

All feedbacks are boolean (true/false) and can change button style when active.

### Connection Status

Active when the RC-IP1000 is online and responding to polls.

Default active style: green background.

### Current Camera

Active when the specified camera number is currently selected on the controller.

| Option        | Range |
| ------------- | ----- |
| Camera Number | 1–200 |

Default active style: yellow background, black text.

### Active Preset

Active when the specified preset was most recently recalled.

| Option        | Range |
| ------------- | ----- |
| Preset Number | 1–100 |

Default active style: blue background, white text.

### Function Button Status

Active when the specified function button was most recently pressed.

| Option          | Choices |
| --------------- | ------- |
| Function Button | F1–F10  |

Default active style: orange background, black text.

### Tally State

Active when the tally lamp is in the specified state.

| Option      | Choices                            |
| ----------- | ---------------------------------- |
| Tally State | Off, On (Program), Flash (Preview) |

Default active style: red background, white text.

---

## Variables

| Variable                        | Description                          | Example Values              |
| ------------------------------- | ------------------------------------ | --------------------------- |
| `$(instance:current_camera)`    | Currently selected camera number     | `1`                         |
| `$(instance:last_preset)`       | Most recently recalled preset number | `3`                         |
| `$(instance:tally_state)`       | Current tally lamp state             | `off`, `on`, `flash`        |
| `$(instance:connection_status)` | Connection state                     | `Connected`, `Disconnected` |

---

## Presets

Ready-made buttons are provided in four groups. Drag them onto your Companion surface to get started quickly.

### Camera Select (Cameras 1–10)

One button per camera (`CAM 1` through `CAM 10`). Each button:

- Triggers **Select Camera** on press
- Highlights yellow when that camera is active

### Preset Recall (Presets 1–10)

One button per preset (`PRESET 1` through `PRESET 10`). Each button:

- Triggers **Recall Preset** on press
- Highlights blue when that preset was most recently recalled

### Function Buttons (F1–F10)

One button per function button. Each button:

- Triggers **Press Function Button** on press
- Highlights orange when that button was most recently pressed

### Tally

Three buttons for tally control:

| Preset      | Action                     | Active Style     |
| ----------- | -------------------------- | ---------------- |
| TALLY OFF   | Sets tally off             | Grey highlight   |
| TALLY ON    | Sets tally on (program)    | Red highlight    |
| TALLY FLASH | Sets tally flash (preview) | Orange highlight |
