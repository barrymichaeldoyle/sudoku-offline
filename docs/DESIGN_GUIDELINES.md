# Design Guidelines

Last updated: 2026-06-19

App working name: **Sudoku Offline**

This document defines the visual and interaction design direction for the app.
Future agents should follow this when modifying screens, components, themes,
animations, onboarding, screenshots, or store assets.

The app should feel:

> Calm, focused, readable, offline-first, and respectful.

The core design promise is:

> Classic Sudoku that gets out of the player’s way.

---

# 1. Design Principles

## 1.1 Calm over flashy

Sudoku is a concentration game. The UI should reduce noise, not create it.

Prefer:

- Clean spacing
- Soft contrast
- Subtle highlights
- Minimal animation
- Predictable controls
- Clear typography

Avoid:

- Casino-style colours
- Excessive gradients
- Constant motion
- Loud success effects
- Cluttered screens
- Aggressive upsells
- UI that competes with the puzzle

---

## 1.2 The board is the product

The Sudoku board is the most important UI element.

Everything else should support the board.

Priority order:

1. Board readability
2. Number input clarity
3. Notes readability
4. Game controls
5. Timer/stats
6. Secondary navigation
7. Monetisation

Never sacrifice board readability for decoration.

---

## 1.3 Offline-first should feel visible

The app’s offline-first nature is a product differentiator.

The design should subtly reinforce:

- Reliability
- No Wi-Fi needed
- No loading anxiety
- No account requirement
- No interruptions during play

Do not show network-dependent UI as primary gameplay UI.

---

## 1.4 No ads while playing

The game screen must never contain banner ads or disruptive monetisation
placements.

Allowed monetisation surfaces:

- After puzzle completion
- Settings screen
- Remove Ads entry point
- Optional rewarded hint flow

Not allowed:

- Ads inside the board screen
- Ads between moves
- Ads after entering numbers
- Ads after completing a row/box
- Fake system-like ad prompts

---

## 1.5 Readability beats style

Sudoku attracts many older users and casual players. The design must be readable
on small phones and comfortable for long sessions.

All key text, numbers, notes, and tap targets must be easy to read.

---

# 2. Visual Identity

## 2.1 Brand personality

The app should feel:

- Quiet
- Trustworthy
- Minimal
- Useful
- Polished
- Slightly premium
- Not childish
- Not overly serious

Reference mood:

```text
A calm notebook, a clean newspaper puzzle, and a modern offline utility.
```

---

## 2.2 Visual keywords

Use these words when evaluating the look and feel:

```text
calm
clear
offline
focused
classic
soft
legible
uncluttered
```

Do not use these words as visual direction:

```text
flashy
neon
gamey
casino
cartoon
chaotic
hyper-casual
```

---

# 3. Colour System

The app should support light mode, dark mode, and system mode.

Use semantic colour tokens. Components should not hard-code raw colours except
inside the theme definition.

---

## 3.1 Light theme

Recommended palette:

```text
background             #F7F3EA
surface                #FFFFFF
surfaceMuted           #EFE9DD

textPrimary            #1F2937
textSecondary          #667085
textMuted              #98A2B3

gridMajor              #2F3A5F
gridMinor              #C9C1B3

cellDefault            #FFFFFF
cellGiven              #F3EBDD
cellSelected           #DDBB72
cellPeer               #F4E7C4
cellSameNumber         #E1ECE8
cellError              #F8D7DA

numberGiven            #1F2937
numberUser             #2F3A5F
numberNote             #667085
numberError            #C75C5C

primary                #2F3A5F
primaryPressed         #25304F
primaryText            #FFFFFF

accent                 #7C9A92
warning                #DDBB72
error                  #C75C5C
success                #5F9E7D

border                 #D8D0C2
shadow                 rgba(31, 41, 55, 0.12)
```

---

## 3.2 Dark theme

Recommended palette:

```text
background             #101828
surface                #1D2939
surfaceMuted           #27364A

textPrimary            #F2F4F7
textSecondary          #CBD5E1
textMuted              #94A3B8

gridMajor              #E4E7EC
gridMinor              #475467

cellDefault            #1D2939
cellGiven              #27364A
cellSelected           #FDB022
cellPeer               #344054
cellSameNumber         #244C5A
cellError              #5A2630

numberGiven            #F2F4F7
numberUser             #84CAFF
numberNote             #CBD5E1
numberError            #FDA29B

primary                #84CAFF
primaryPressed         #53B1FD
primaryText            #101828

accent                 #7C9A92
warning                #FDB022
error                  #FDA29B
success                #75E0A7

border                 #475467
shadow                 rgba(0, 0, 0, 0.35)
```

---

## 3.3 Colour usage rules

### Board

The board must always have the strongest visual hierarchy.

Use:

- Stronger lines for 3x3 box boundaries
- Lighter lines for individual cells
- Clear selected cell highlight
- Subtle peer highlights
- Distinct but non-aggressive error state

### Errors

Error colours should be visible but not punishing.

Avoid:

- Full-screen red effects
- Harsh flashing
- Shame-based copy
- Loud sounds for mistakes

### Success

Completion should feel satisfying but calm.

Use:

- Subtle haptic
- Soft success highlight
- Completion modal
- Optional gentle animation

Avoid:

- Confetti by default
- Over-the-top celebratory effects
- Long blocking animations

---

# 4. Typography

Use a clean, highly legible sans-serif font.

Recommended options:

- System font
- Inter
- SF Pro on iOS via system
- Roboto on Android via system

For MVP, system font is acceptable and preferred for native feel.

---

## 4.1 Type scale

Use a consistent scale.

```text
displayLarge       32 / 40
titleLarge         24 / 32
titleMedium        20 / 28
titleSmall         18 / 24

bodyLarge          16 / 24
bodyMedium         14 / 20
bodySmall          12 / 16

labelLarge         16 / 20
labelMedium        14 / 18
labelSmall         12 / 16

boardNumber        dynamic, based on cell size
boardNote          dynamic, based on cell size
```

Format:

```text
font size / line height
```

---

## 4.2 Font weights

```text
Regular            400
Medium             500
Semibold           600
Bold               700
```

Use weights sparingly.

Recommended:

- Given Sudoku numbers: `700`
- User-entered numbers: `600`
- Notes: `500`
- Buttons: `600`
- Body text: `400`
- Screen titles: `700`

---

## 4.3 Sudoku number typography

Sudoku numbers must be extremely readable.

Given numbers and user-entered numbers should have clear distinction.

Suggested:

```text
Given numbers:
- weight: 700
- colour: textPrimary / numberGiven

User numbers:
- weight: 600
- colour: primary / numberUser

Notes:
- weight: 500
- smaller size
- colour: numberNote
```

Avoid decorative fonts for board numbers.

---

# 5. Spacing System

Use an 8-point spacing scale.

```text
space0      0
space1      4
space2      8
space3      12
space4      16
space5      20
space6      24
space8      32
space10     40
space12     48
```

Default screen padding:

```text
16px on phones
24px on larger screens/tablets
```

Minimum spacing between unrelated controls:

```text
16px
```

Minimum spacing between grouped controls:

```text
8px
```

---

# 6. Radius and Shape

Use soft but not playful rounding.

```text
radiusSmall       6
radiusMedium      10
radiusLarge       16
radiusXL          24
radiusPill        999
```

Recommended usage:

```text
Buttons           radiusMedium or radiusLarge
Cards             radiusLarge
Modals            radiusXL
Sudoku board      radiusLarge
Cells             0 or very small radius
Number buttons    radiusMedium
```

The Sudoku grid itself should still feel precise and structured.

---

# 7. Elevation and Shadows

Use shadows minimally.

Sudoku should feel flat, clean, and readable.

Allowed surfaces:

- Home cards
- Completion modal
- Bottom sheets
- Floating pause overlay

Avoid shadows inside the game board.

Light mode shadow:

```text
shadowColor       rgba(31, 41, 55, 0.12)
shadowOffset      0 4
shadowRadius      12
shadowOpacity     1
elevation         2
```

Dark mode shadow:

```text
shadowColor       rgba(0, 0, 0, 0.35)
shadowOffset      0 6
shadowRadius      16
shadowOpacity     1
elevation         3
```

---

# 8. Layout Guidelines

## 8.1 Screen structure

Most screens should follow:

```text
Safe area
  Header
  Main content
  Bottom action area, if needed
```

Avoid deep navigation where possible.

The app should feel simple:

```text
Home -> Game
Home -> Stats
Home -> Settings
```

---

## 8.2 Game screen layout

The game screen should prioritize the board.

Recommended vertical order:

```text
Top bar
  Timer
  Mistakes
  Pause/settings affordance

Sudoku board

Game controls
  Notes
  Undo
  Erase
  Hint

Number pad
```

Alternative:

```text
Top bar
Sudoku board
Number pad
Controls
```

The selected layout should be tested on small phones.

---

## 8.3 Board sizing

The Sudoku board should:

- Be square
- Use the maximum practical width
- Maintain comfortable vertical space for controls
- Never be horizontally scrollable
- Never be clipped

Recommended:

```text
boardSize = min(screenWidth - horizontalPadding * 2, availableHeight * 0.58)
```

On small phones, the board may need to be slightly smaller to preserve controls.

---

## 8.4 Tap targets

Minimum tap target:

```text
44x44 px
```

Preferred:

```text
48x48 px or larger
```

Applies to:

- Cells
- Number buttons
- Notes toggle
- Undo
- Erase
- Hint
- Settings toggles
- Difficulty buttons

If a Sudoku cell is smaller than 44x44 on very small devices, ensure the board
still feels usable and forgiving.

---

# 9. Sudoku Board Design

## 9.1 Board hierarchy

The board should show:

1. 3x3 box boundaries
2. Selected cell
3. Peer cells
4. Same-number cells
5. Given vs user numbers
6. Notes
7. Mistakes/errors

Do not make all states equally strong.

---

## 9.2 Grid lines

Use two line weights:

```text
minorGridLine      1px
majorGridLine      2px or 3px
```

In light mode:

- Minor lines should be subtle
- Major lines should be clearly visible

In dark mode:

- Avoid pure white grid lines
- Use soft high-contrast grey/blue

---

## 9.3 Cell states

Cells can have multiple states. Priority should be:

1. Error
2. Selected
3. Same number
4. Peer
5. Given
6. Default

Example priority:

```text
if error:
  show error style
else if selected:
  show selected style
else if sameNumber:
  show same number style
else if peer:
  show peer style
else if given:
  show given style
else:
  show default style
```

---

## 9.4 Given cells

Given cells should feel fixed and authoritative.

Use:

- Slightly different background
- Stronger font weight
- Primary text colour

Do not:

- Make them look disabled
- Make them too faint
- Allow edit affordance

---

## 9.5 User-entered cells

User-entered numbers should be distinct from givens.

Use:

- Primary/accent colour
- Slightly lighter font weight than givens
- Same alignment and size

---

## 9.6 Notes

Notes must be readable and neatly arranged.

Each cell has a 3x3 mini-grid for notes:

```text
1 2 3
4 5 6
7 8 9
```

Rules:

- Notes should not visually dominate full numbers
- Notes must remain readable on small phones
- Notes should align consistently
- Notes should use muted text colour
- Notes should not overlap cell borders

If board cells are too small, reduce note size but keep minimum legibility.

---

## 9.7 Error states

If mistake checking is enabled:

- Incorrect user number should be marked
- Related duplicate conflict may be marked
- Use error colour but avoid harsh flashing

If mistake checking is disabled:

- Do not reveal correctness
- Still allow duplicate visual warning if the setting supports it

---

# 10. Controls

## 10.1 Number pad

Number pad should be large, easy, and obvious.

Recommended layout:

```text
1 2 3 4 5
6 7 8 9
```

or:

```text
1 2 3
4 5 6
7 8 9
```

Choose based on available vertical space.

Rules:

- Selected number should be highlighted
- Completed numbers may be subtly disabled or reduced
- Buttons must be large enough for one-handed use
- Number pad must not feel cramped

---

## 10.2 Game controls

Controls:

- Notes
- Undo
- Erase
- Hint

Use icons plus labels if space allows.

Recommended:

```text
[Notes] [Undo] [Erase] [Hint]
```

The Notes control must have a clear active state.

Hint should not look like a primary action unless the player is stuck.

---

## 10.3 Primary buttons

Use for:

- Start game
- Continue
- Resume
- New puzzle
- Complete modal primary action

Primary button style:

```text
background: primary
text: primaryText
height: 48
radius: radiusMedium or radiusLarge
fontWeight: 600
```

---

## 10.4 Secondary buttons

Use for:

- Difficulty options
- Settings links
- Share
- Stats navigation

Secondary button style:

```text
background: surface
border: border
text: textPrimary
height: 44 or 48
radius: radiusMedium
```

---

## 10.5 Destructive actions

Use destructive style only for:

- Reset puzzle
- Delete progress
- Reset stats

Require confirmation for destructive actions.

---

# 11. Screen Guidelines

## 11.1 Home screen

The Home screen should be simple and action-oriented.

Priority:

1. Continue current game
2. Daily puzzle
3. New game
4. Stats
5. Settings

Suggested structure:

```text
Sudoku Offline

Continue
Daily Puzzle

New Game
Easy
Medium
Hard
Expert

Stats
Settings
```

Home should not be overloaded with charts or ads.

---

## 11.2 Game screen

The Game screen should feel distraction-free.

Rules:

- No banners
- No promotional cards
- No unnecessary copy
- No network indicators unless required
- No visual clutter around the board

The game screen is not a marketing screen.

---

## 11.3 Completion screen

Completion should feel rewarding but minimal.

Show:

```text
Puzzle Complete

Difficulty
Time
Mistakes
Hints

New Game
Daily Puzzle / Continue
Share
```

If ads are enabled, ad display happens after completion and should not be
confused with the completion UI.

---

## 11.4 Stats screen

Stats should be simple and readable.

MVP stats:

- Total puzzles completed
- Daily streak
- Best time by difficulty
- Average time by difficulty
- Mistake-free completions

Use cards, but avoid overdecorating.

---

## 11.5 Settings screen

Settings should feel trustworthy.

Group settings:

```text
Appearance
Gameplay
Sound & Haptics
Offline & Data
Ads & Purchases
About
```

Use clear toggle labels.

Example:

```text
Mistake checking
Show when a number does not match the solution.
```

---

## 11.6 Pause screen

Pause overlay should be calm and clear.

Show:

```text
Paused

Resume
Restart puzzle
New game
Settings
```

Do not show ads or upsells on pause.

---

# 12. Empty, Loading, and Error States

## 12.1 Loading

Loading should be rare because the app is offline-first.

Allowed loading moments:

- First local database setup
- Importing bundled puzzles
- Restoring purchases
- Optional online sync

Use simple copy:

```text
Getting puzzles ready...
```

Avoid:

```text
Connecting...
```

for offline-first features.

---

## 12.2 Empty states

Empty stats screen:

```text
No completed puzzles yet.
Finish your first Sudoku to see your stats here.
```

No active game:

```text
Start a puzzle whenever you’re ready.
```

---

## 12.3 Error states

Errors should be plain and actionable.

Examples:

```text
Could not start this puzzle.
Please try another difficulty.
```

```text
Could not restore purchases.
Check your connection and try again.
```

Do not expose raw technical errors to users.

---

# 13. Motion and Animation

Animation should be subtle and fast.

Allowed:

- Cell selection fade
- Button press scale/opacity
- Completion modal entrance
- Gentle success pulse
- Theme transition if smooth

Recommended durations:

```text
fast        100ms
normal      180ms
slow        250ms
```

Avoid:

- Long animations
- Bouncy arcade effects
- Constant pulsing
- Motion that delays input
- Confetti by default

Respect reduced-motion accessibility settings where possible.

---

# 14. Haptics and Sound

## 14.1 Haptics

Haptics should be subtle.

Use for:

- Cell value placed
- Notes mode toggled
- Invalid move
- Puzzle completed

Do not use haptics for every minor highlight or selection if it feels noisy.

Respect `hapticsEnabled`.

---

## 14.2 Sound

If sound is added later:

- Off by default, or very subtle
- Separate setting from haptics
- No casino-like effects
- No loud failure sounds

---

# 15. Accessibility

Accessibility is a core requirement, not polish.

## 15.1 Contrast

All text and important UI states should meet accessible contrast standards.

Particular care:

- Notes on cells
- Grid lines in dark mode
- Selected cell state
- Error state
- Disabled number buttons

---

## 15.2 Dynamic type

Where practical, support system font scaling for:

- Settings
- Stats
- Home
- Modals
- Buttons

For the Sudoku board, dynamic type may need constraints to preserve layout, but
numbers must remain readable.

---

## 15.3 Screen readers

Important elements should have accessibility labels.

Examples:

```text
Cell row 1 column 2, empty
Cell row 3 column 4, given 7
Cell row 5 column 5, notes 1, 4, 9
Number 8
Notes mode on
Erase selected cell
```

Do not rely only on colour to indicate state.

---

## 15.4 Colour blindness

Avoid using colour as the only distinction between:

- Given and user numbers
- Correct and incorrect
- Selected and peer cells
- Active and inactive notes mode

Use a combination of:

- Colour
- Weight
- Background
- Border
- Icon state
- Text label

---

# 16. Theme Implementation

Use theme tokens rather than raw colours in components.

Recommended token shape:

```ts
export type AppTheme = {
  mode: "light" | "dark";
  colors: {
    background: string;
    surface: string;
    surfaceMuted: string;

    textPrimary: string;
    textSecondary: string;
    textMuted: string;

    gridMajor: string;
    gridMinor: string;

    cellDefault: string;
    cellGiven: string;
    cellSelected: string;
    cellPeer: string;
    cellSameNumber: string;
    cellError: string;

    numberGiven: string;
    numberUser: string;
    numberNote: string;
    numberError: string;

    primary: string;
    primaryPressed: string;
    primaryText: string;

    accent: string;
    warning: string;
    error: string;
    success: string;

    border: string;
    shadow: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };
};
```

Components should use:

```ts
const { colors, spacing, radius } = useTheme();
```

Avoid:

```ts
backgroundColor: "#FFFFFF"
```

inside app components.

---

# 17. Component Guidelines

## 17.1 `SudokuBoard`

Responsibilities:

- Render grid
- Render cells
- Apply visual states
- Accept cell press events
- Be layout-responsive

Should not:

- Own game rules
- Mutate persistence directly
- Know about ads, analytics, or purchases

---

## 17.2 `SudokuCell`

Responsibilities:

- Render one cell
- Render value or notes
- Render selected/peer/same/error/given states
- Expose accessibility label

Should remain visually consistent across themes.

---

## 17.3 `NumberPad`

Responsibilities:

- Render numbers 1-9
- Show selected number state
- Optionally show completed numbers
- Support number-first mode if implemented

---

## 17.4 `GameControls`

Responsibilities:

- Notes toggle
- Undo
- Erase
- Hint
- Disabled states

Active Notes mode must be visually obvious.

---

## 17.5 `DifficultyButton`

Should show:

- Difficulty name
- Optional small description
- Optional completion count later

Example:

```text
Easy
Relaxed solving
```

---

# 18. Copy Guidelines

Keep copy short and direct.

Use:

```text
Start puzzle
Continue
Daily puzzle
Notes
Undo
Erase
Hint
Paused
Puzzle complete
```

Avoid:

```text
Embark on your numerical journey
Oopsie! That’s not quite right!
Your brain power is amazing!
```

The tone should be calm and adult.

---

## 18.1 Mistake copy

Good:

```text
That number does not fit.
```

```text
Check this cell again.
```

Avoid:

```text
Wrong!
```

```text
You made a mistake!
```

---

## 18.2 Offline copy

Good:

```text
Works offline
```

```text
No Wi-Fi needed
```

```text
You can keep playing offline.
```

Avoid:

```text
Network unavailable. Some features may not function.
```

unless the user explicitly attempted an online feature.

---

## 18.3 Ads copy

If ads exist, be precise.

Allowed:

```text
No ads while you play
```

```text
No interruptions during puzzles
```

Not allowed:

```text
Ad-free
```

unless the entire app is actually ad-free.

---

# 19. Monetisation Design Rules

Monetisation should not degrade trust.

Allowed:

- Remove Ads in Settings
- Remove Ads on completion screen
- Optional rewarded hint prompt
- Post-completion interstitial

Not allowed:

- Banner ads on game screen
- Forced ads before the first puzzle
- Ads during active solving
- Dark patterns around hints
- Misleading close buttons
- Fake system alerts
- Blocking offline gameplay

Rewarded hint prompt should be clear:

```text
Need another hint?
Watch a short ad to get one extra hint.
```

If offline:

```text
Extra ad hints need internet.
```

But do not block all hints offline.

---

# 20. Icon and Branding

## 20.1 App icon direction

Preferred icon concept:

- Rounded square
- Simple Sudoku/grid mark
- One highlighted cell
- No text
- No tiny numbers
- Calm palette

Good icon themes:

1. Cream background, indigo grid, gold selected cell
2. Dark navy background, soft blue grid, warm selected cell
3. Minimal grid with pencil-mark dots
4. Cropped 3x3 grid with one strong highlighted cell

Avoid:

- Full busy 9x9 grid with tiny numbers
- Wi-Fi-off symbol as the main visual
- Text inside the icon
- Cartoon mascot
- Neon/casino colours

---

## 20.2 Store screenshot style

Screenshots should match in-app design.

Guidelines:

- Show real UI
- Use large captions
- Use calm background
- Keep copy short
- Lead with offline/no interruptions
- Do not misrepresent ads

Preferred screenshot messages:

```text
Sudoku Offline
Classic puzzles, no Wi-Fi needed
```

```text
No ads while you play
Stay focused from start to finish
```

```text
Daily Sudoku
Build a calm daily streak
```

```text
Pencil notes made easy
Fast notes, undo, hints and erase
```

```text
Dark mode
Easy on the eyes
```

---

# 21. Retrofit Plan for Current App

The current app exists, but the look and feel was an afterthought. Improve it in
this order.

## Phase 1: Create design tokens

- Add theme colour tokens
- Add spacing tokens
- Add radius tokens
- Add typography constants
- Replace hard-coded colours gradually

Goal:

```text
The app has one visual language.
```

---

## Phase 2: Fix the game board

Priority:

- Improve grid line hierarchy
- Improve selected cell state
- Improve peer highlighting
- Improve same-number highlighting
- Improve given vs user number distinction
- Improve notes readability
- Improve dark mode board contrast

Goal:

```text
The board feels clear and polished.
```

---

## Phase 3: Fix game controls

Priority:

- Number pad sizing
- Notes active state
- Undo/erase/hint consistency
- Button spacing
- Disabled states
- Haptic feedback consistency

Goal:

```text
Input feels deliberate and comfortable.
```

---

## Phase 4: Fix screens

Priority:

- Home screen hierarchy
- Completion modal
- Stats cards
- Settings grouping
- Empty states

Goal:

```text
The app feels like one product, not separate screens.
```

---

## Phase 5: Polish

Priority:

- Motion
- Accessibility labels
- Small-phone layout
- Tablet layout
- Store screenshots
- Icon

Goal:

```text
The app feels launch-ready.
```

---

# 22. Quality Checklist

Before shipping design changes, verify:

## Game board

- [ ] Board is readable on small phones
- [ ] Given numbers are distinct from user numbers
- [ ] Notes are readable
- [ ] Selected cell is obvious
- [ ] Peer cells are visible but subtle
- [ ] Same-number highlight is useful
- [ ] Error state is visible but not harsh
- [ ] Dark mode board has enough contrast

## Controls

- [ ] Number buttons are easy to tap
- [ ] Notes mode active state is obvious
- [ ] Undo disabled state works
- [ ] Erase disabled state works if applicable
- [ ] Hint state is clear
- [ ] Haptics respect settings

## Screens

- [ ] Home has clear primary action
- [ ] Completion screen is calm and useful
- [ ] Stats are readable
- [ ] Settings are grouped clearly
- [ ] Empty states are helpful
- [ ] No screen feels cluttered

## Accessibility

- [ ] Tap targets are at least 44x44
- [ ] Important text has sufficient contrast
- [ ] Board does not rely only on colour
- [ ] Screen reader labels exist for board cells
- [ ] Dynamic text does not break main screens
- [ ] Reduced motion is respected where possible

## Monetisation

- [ ] No ads on game screen
- [ ] No misleading ad-free claims
- [ ] Remove Ads placement is not aggressive
- [ ] Rewarded hint copy is clear
- [ ] Offline gameplay still works

---

# 23. Agent Rules

Future agents must follow these rules:

1. Do not add visual clutter to the game screen.
2. Do not place ads inside active gameplay.
3. Do not hard-code colours in components.
4. Do not reduce board readability for decoration.
5. Do not make note text too small to read.
6. Do not use colour as the only indicator of state.
7. Do not add aggressive animations.
8. Do not use casino/hyper-casual styling.
9. Do not make the app feel online-dependent.
10. Do not describe the app as ad-free if ads exist.
11. Keep Sudoku interactions fast and predictable.
12. Prioritize small-phone usability.
13. Keep dark mode as polished as light mode.
14. Update this document when major design decisions change.

---

# 24. Current Recommended Visual Direction

Use this as the default design direction:

```text
Light mode:
Warm cream background, white board surface, indigo grid, gold selected cell,
soft sage same-number highlight.

Dark mode:
Deep navy background, slate board surface, soft blue user numbers, warm amber
selected cell, muted grid lines.

Overall:
Calm, readable, minimal, offline-first.
```

The app should look like a polished daily puzzle utility, not a noisy mobile
game.