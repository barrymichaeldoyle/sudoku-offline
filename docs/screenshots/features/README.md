# Feature screenshots

In-app captures used to verify and document the app's UX (distinct from the
marketing captures under `assets/store/`). Taken on an iPhone SE simulator
(iOS 26.4) against the live dev build, then resized to 540px wide.

To re-capture: run the app on a simulator, drive it to each state, and replace
the files below. The two "incorrect board" states are reached from the
Settings → Developer panel (only the success-screen preview ships in that panel;
the incorrect-board preview is a temporary dev affordance).

| File | What it shows |
| --- | --- |
| `01-home.png` | Home screen — resume, daily puzzle/challenge, new game, stats/settings. |
| `02-settings-input-and-cleanup-scope.png` | Settings: the **Input mode** selector (cell-first / number-first) and the **Auto-clear notes** scope selector (row, column & box / box only). |
| `03-game-reset-and-input-toggle.png` | Game screen with the **Reset** button and **Cell-first** input toggle in the row above the board. |
| `04-restart-confirm-keep-time.png` | The restart confirmation with the **Keep my time** toggle (shown only when the timer is enabled). |
| `05-incorrect-board-mistake-checking-on.png` | "Not quite right" modal when mistake checking is on — wrong cells highlighted in red behind it. |
| `06-incorrect-board-mistake-checking-off.png` | "Not quite right" modal when mistake checking is off — offers **Show my mistakes** to turn it on. |
