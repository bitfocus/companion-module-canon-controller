# canon-controller — gap analysis against XC Protocol Specifications BPE-7216-012

Written 2026-11-02 against module v1.0.0 (`package.json`) / manifest `0.0.0`.

Source: **XC Protocol Specifications BPE-7216-012**, Canon Inc., Sep 1 2026.
Relevant sections: Table 1 (§1.1.2), Appendix A.3 (RC-IP1000/IP300-dependent
information), Appendix B.4 (parameter list).

## Status

Implemented 2026-11-02. Every section below is addressed in the module; the text is
kept as written so the reasoning behind each change stays on record.

| Section | Change                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| §1      | Function button choices built from `f.assign.min`/`f.assign.max`, rebuilt when a poll reports different bounds                       |
| §2      | Camera number bounds built from `camno.count`                                                                                        |
| §3      | Optional **Target Camera** on Recall Preset, Stop Preset Move and Set Tally State                                                    |
| §4      | **Move Speed** (default / saved / speed / time) and **Freeze** on Recall Preset; new **Stop Preset Move** action                     |
| §5      | Tally ids now match `f.tally.mode` (`off`/`program`/`preview`), `preview_program` added, old ids migrated in `src/upgrades.ts`       |
| §6      | The three command-echo feedbacks renamed "Last … " and described as what Companion sent                                              |
| §7      | `405` reported as missing credentials on the controller, in both `sendControl` and `poll`                                            |
| §8      | Manifest products/keywords, model-neutral copy, Digest auth and the 1000ms polling floor corrected in HELP, firmware baselines added |

Two things could not be checked without hardware: `f.assign.max:=12` on a real RC-IP300
(question 1), and whether `isVisibleExpression` hides the speed/time fields as intended,
since Companion evaluates those expressions host-side. Neither breaks anything if wrong —
the first leaves the button list at whatever the device reports, the second leaves both
fields visible.

---

## 0. Scope

Revision 012's entire change log is:

> Added support information for RC-IP300
> Updated the version of other product(s) that supports the XC protocol to the latest firmware

So **this module is the one 012 actually affects.** Appendix A.3 was retitled from
"RC-IP1000-dependent Information" to "RC-IP1000/IP300-dependent Information", and
the two controllers now share one command set.

The other document supplied, **Auto Tracking RA-AT001 Ver. 1.02**, does _not_
apply here. Its Table 1-1 scopes it to CR-N700/N500/N400/N350/N300/N100 running
the auto tracking app; the RC-IP controllers cannot run it, and A.3 lists no
tracking CGI. That work belongs to `companion-module-canon-ptz`.

---

## 1. The one hard bug: RC-IP300 has 12 function buttons, not 10

`f.assign.max` is **10 on RC-IP1000 and 12 on RC-IP300** (§A.3.2.1). This is the
only functional difference between the two devices in the whole specification.

The module already polls the value correctly — `parseInfoResponse` in
`src/main.ts` reads `f.assign.min` and `f.assign.max` into `state.assignMin` /
`state.assignMax`. **It then never uses them.** The button list is a hardcoded
constant, duplicated in two files:

- `src/actions.ts` — `FUNCTION_BUTTON_CHOICES = Array.from({ length: 10 }, …)`
- `src/feedbacks.ts` — the same constant again
- `src/presets.ts` — `Array.from({ length: 10 }, …)` for the preset buttons, and
  the section description "Trigger assignable function buttons F1–F10"

Result: **on an RC-IP300, F11 and F12 are unreachable** from this module. The
state is sitting in memory, unused.

`state.assignMax` also defaults to `10` in `src/main.ts`, which is the wrong
starting guess for an RC-IP300 — though it is corrected by the first poll.

`f.assign.min` is ignored entirely; choices are always generated from 1. It is
documented as 1 on both devices, so this is latent rather than broken.

**Fix:** build the choices from `state.assignMin`…`state.assignMax` and re-run
`updateActions()` / `updateFeedbacks()` / `updatePresets()` when either value
changes in `parseInfoResponse`. The module already re-checks feedbacks from
there, so the hook point exists.

One wrinkle: Companion needs action/feedback definitions at init, before the
first poll has returned. Either define 12 and let the extra two fail harmlessly
on an RC-IP1000, or define from cached state and refresh on first poll. The
refresh approach is better — an F11 button that silently does nothing on a
1000 is worse than one that isn't offered.

---

## 2. `camno.count` is polled and also ignored

Same shape of problem, lower stakes. `camno` is specified as `1…camno.count`
(§A.3.2.1), and `camno.count` is polled into `state.cameraCount`. Both
`select_camera` (`src/actions.ts`) and the `current_camera` feedback
(`src/feedbacks.ts`) hardcode `min: 1, max: 200`.

200 is the documented value on both devices today, so nothing is broken. But the
spec defines the range as device-reported, and the module already has the
number. Worth driving the bounds from `state.cameraCount` in the same pass as §1.

---

## 3. Missing: designated-camera control (`camno.target`)

§A.3.5 is titled "Designated Camera Presets/Tally Lamp Control". The module
implements none of it.

```
control.cgi?[p=<value>][&p.ptztime=<value>][&p.ptzspeed=<value>]
            [&p.action=stop][&p.ptzspeed.saved=on][&p.freeze=on]
            [&f.tally=on/off][&f.tally.mode=<value>][&camno.target=<value>]
```

`camno.target` (range `1…camno.count`) names the camera to act on **independently
of the camera selected on the controller**. If omitted, the selected camera is
used — which is the module's current behaviour, and the only behaviour it offers.

This is the most valuable missing feature in A.3: it lets a Companion button
recall a preset or set tally on camera 5 without switching the operator's
controller away from camera 2. For a production surface that is the difference
between "usable alongside an operator" and "fights the operator".

**Fix:** add an optional "Target Camera" field to `recall_preset` and `set_tally`
— blank/0 meaning "currently selected camera", otherwise `&camno.target=<n>`.

Note the relay rules: only parameters beginning `p.` or `f.tally.` are passed
through to the camera, and whether a given command works "depends on the
specification of the selected camera". So a target camera that does not support
tally mode will refuse it, and the controller cannot tell you that in advance.

---

## 4. Missing: every preset-recall modifier

`recall_preset` sends a bare `p=<n>`. The spec allows (ranges from B.4, §3.2.3.1):

| Parameter          | Range                         | Meaning                                   |
| ------------------ | ----------------------------- | ----------------------------------------- |
| `p`                | `1…p.count` (p.count = 100)   | Preset number                             |
| `p.ptztime`        | 2000…99000                    | Synchronised PTZ move time, ms            |
| `p.ptzspeed`       | 1…100                         | PTZ move speed                            |
| `p.ptzspeed.saved` | `on`                          | Use the speed/time stored with the preset |
| `p.freeze`         | `off` \| `on` (default `off`) | Freeze the image during the move          |
| `p.action`         | `stop`                        | Stop a preset move in progress            |

Interaction rules worth encoding, from §3.2.3.1:

- If `p.ptztime` **and** `p.ptzspeed` are both given, **`p.ptztime` wins**.
- If `p.ptzspeed.saved=on` is given together with `p.ptztime` or `p.ptzspeed`,
  the **explicit value wins** over the saved one.
- If none of the three is given, the camera's own default applies.
- If `p.freeze` is not given, the target camera's "still image during preset"
  model-specific setting applies.

**Fix:** extend `recall_preset` with optional speed/time/freeze fields (mutually
exclusive speed-vs-time in the UI, since the protocol silently prefers time), and
add a **Stop Preset Move** action sending `p.action=stop`. The stop action is
currently impossible to express and is the kind of thing an operator wants on a
physical button.

---

## 5. Tally: one mislabel and one missing mode

B.4 gives `f.tally.list := off, on` and `f.tally.mode.list := preview, program`
for the CR-N series and CR-X300 — so the module's `f.tally=on&f.tally.mode=program`
and `…=preview` are **protocol-correct**.

Two problems with how they're presented:

1. **"Flash (Preview)" is a mislabel.** `preview` is a tally _mode_, not a flash
   behaviour. Whether the lamp flashes is the camera's business; the protocol
   exposes only `preview` vs `program`. The label appears in `src/actions.ts`,
   `src/feedbacks.ts`, `src/presets.ts` (`TALLY FLASH`) and `companion/HELP.md`
   ("flashing tally lamp in preview mode" — not something the spec claims).
   Suggest **Off / On (Program) / On (Preview)**, with the internal id kept or
   migrated via `src/upgrades.ts`.

2. **`preview_program` is missing.** B.4 lists a third mode for Cinema EOS and
   XF605 targets: `f.tally.mode.list := preview, program, preview_program` for
   C500mk2, C400, C300mk3, C80, C70, C50, XF605. Since §A.3.5 relays `f.tally.`
   parameters to whatever camera is targeted, an RC-IP driving a Cinema EOS body
   should be able to ask for it. Add it as a fourth choice, documented as
   "Cinema EOS / XF605 targets only".

---

## 6. Three feedbacks report what was commanded, not what is true

`info.cgi` on an RC-IP returns **exactly four keys** — `camno`, `camno.count`,
`f.assign.min`, `f.assign.max` (§A.3.2.2). No tally, no preset, no assign state,
and explicitly no `timestamp`/`realtime` because stream format is unsupported.

So of the module's five feedbacks, only `current_camera` and `connection_status`
reflect the device. `active_preset`, `function_button_status` and `tally_state`
are driven purely from `state.lastPreset` / `lastFunctionButton` / `tallyState`,
which are written by the action callbacks in `src/actions.ts` after a successful
send. They are "what this module last asked for", and they go stale the moment
anyone touches the physical controller or another Companion instance.

This is **not fixable** — the protocol gives nothing back. But the descriptions
overclaim, in `src/feedbacks.ts` and `companion/HELP.md`:

> Active when the tally lamp is in the specified state

It isn't; it's active when this module last _set_ that state. Reword these three
to say so, so operators don't trust a stale lamp indicator during a show.

---

## 7. `405 Method Not Allowed` deserves its own message

§A.3.1, verbatim:

> When an info/control.cgi command is executed on the RC-IP1000/IP300 without a
> configured username and password, the error code "405 Method Not Allowed" is
> returned.
>
> Note that this behavior and error code are unique to the RC-IP1000/IP300 and
> are not common features of the XC control protocol.

Today a 405 falls through to the generic paths: `Control command failed: HTTP 405`
in `sendControl`, or `HTTP 405` thrown into `ConnectionFailure` in `poll`. Neither
tells the user the actual cause, which is that **credentials must be configured
on the controller itself**, not merely in Companion.

**Fix:** special-case 405 in both places with something like "The controller has
no username/password configured. Set them on the RC-IP itself, then enter them
here." Worth a line in HELP too.

---

## 8. Smaller corrections

**Parameter groups are mutually exclusive.** §A.3.3/A.3.4/A.3.5 each say "If any
other parameters are included, an error is returned". So `camno=`, `f.assign=`
and the `p.`/`f.tally.` group cannot be combined in one request. The module never
does today, but it's a constraint to respect if actions are ever batched — in
particular, a future "select camera and recall preset" convenience action must be
**two** requests, not one.

**Model identity.** The manifest declares `"products": ["RC-IP1000"]` and
`"keywords": [… "rc-ip1000"]`; strings throughout `src/` and HELP.md say RC-IP1000
(`select_camera` tooltip, every feedback description, preset descriptions, the
HELP title and body). Add RC-IP300 to products and keywords, and generalise the
user-facing copy to "the controller" — the module genuinely supports both once §1
is fixed, and the device self-identifies via `f.assign.max`.

There is no model dropdown today and none is needed; `f.assign.max` distinguishes
the two devices without asking the user.

**HELP.md says the wrong auth scheme.** "The module uses HTTP Basic
Authentication" — it has used Digest since commit `9fdc6fd`, and `src/digest.ts`
plus the nonce handling in `main.ts` are a non-trivial part of this module.

**HELP.md polling range is wrong.** It documents 500–30000 ms; `src/config.ts`
enforces `min: 1000` and `MIN_POLLING_RATE_MS` floors it at 1000 regardless.

**Firmware baselines (Table 1).** RC-IP1000 **1.3.0**, RC-IP300 **1.0.0**. Worth
stating in HELP as the minimum tested firmware.

---

## 9. Suggested sequencing

**Phase 1 — RC-IP300 support proper.** §1 (dynamic assign range, the actual
bug), §2 (dynamic camera count, same pass), manifest/products/keywords and the
RC-IP1000-only copy from §8. This is what "support RC-IP300" means, and it's
mostly deleting hardcoded constants in favour of state the module already has.

**Phase 2 — honest errors and labels.** §7 (405), §6 (feedback descriptions),
§5.1 (tally mislabel), and the HELP corrections in §8. Small, no new protocol
surface, and §7 in particular will cut support questions.

**Phase 3 — the features A.3 allows and the module doesn't.** §3
(`camno.target`), §4 (preset modifiers and stop), §5.2 (`preview_program`).
Biggest operator-facing win, `camno.target` especially.

---

## 10. Questions

1. Do you have an **RC-IP300** on hand to test against? §1 is a confident read of
   the spec, but `f.assign.max:=12` should be confirmed off real hardware before
   the module reshapes its UI around it.
2. Is `preview_program` (§5.2) reachable through an RC-IP, or does the controller
   filter tally modes to its own list before relaying? The spec says only that
   relay propriety "depends on the specification of the selected camera", which
   implies pass-through, but it doesn't say so outright.
3. Should the tally state ids be migrated (`flash` → `preview`) via
   `src/upgrades.ts`, or left alone and only relabelled? Migrating is cleaner but
   touches existing users' buttons.
4. Is anyone relying on the preset/tally/function feedbacks as-is (§6)? Rewording
   them is honest but will read as a downgrade to anyone who hasn't noticed.
