# 🛸✨ Davinci Code — Project Development Rules

This document defines the strict development rules, architectural standards, and game design rules for the Davinci Code (Solo vs AI) web application. Enforce these rules at all times during coding and redesign tasks.

---

## 🏗️ 1. ARCHITECTURE & MULTIPLAYER READY

- **Strict Separation of Concerns**: Game Logic (`js/game.js`) must never directly import, call, or manipulate UI elements (`js/ui.js`) or Audio players (`js/audio.js`).
- **UI Decoupling**: UI must never directly modify the Game State. It must invoke public control methods exposed by the `Game` engine.
- **State-Driven Events**: All visual updates, sound triggers, and log entries must be driven by state changes (`onStateChange`).
- **Single Source of Truth**: Keep game parameters, player hands, deck sizes, and turn phases strictly inside the game state object.
- **Future Multiplayer Compatibility**: Design all state mutations and event flows to remain compatible with a server-authoritative multiplayer backend architecture.

---

## 💾 2. STATE MANAGEMENT & PERFORMANCE

- **Avoid Duplicated State**: Do not store game status or card information in multiple independent variables across modules.
- **Avoid Unnecessary Re-renders**:
  - Compare states before updating DOM elements. If a state change only affects timers, do not re-render the cards, consoles, or mascot components.
  - **Timer Re-render Guard**: Ticking of the turn timer or total elapsed timer must never wipe out, refresh, or reset active user inputs or selection panels (e.g., the guess buttons console).

---

## 👾 3. GAME-SPECIFIC RULES (DAVINCI CODE)

- **Empty Deck Draw Transition**:
  - When a new turn starts and the deck count is `0`, the game engine must automatically transition the turn phase to `'guess'` instead of waiting for a manual click on the empty deck.
- **Official Empty-Deck Penalty Rule**:
  - If a player makes a wrong guess when the deck is `0`, a penalty phase (`'penalty_reveal'`) must be triggered. All board inputs are locked, and the player is forced to click and reveal one of their own secret/unrevealed cards.
- **AI Guess Logging**:
  - AI guess actions must be logged in the UI terminal log exactly once per event. To prevent duplicates from multiple state ticks, track the log count using a helper index during rendering.
- **Hard AI Human-like Error Margin**:
  - To make the game fun and realistic, the Hard AI must have a **10-15% chance to make a calculation error** (i.e. make a wrong guess on adjacent numbers), even when it has reached 100% mathematical certainty about a hidden card.

---

## 🎨 4. UI/UX & MOBILE OPTIMIZATION

- **Theme Cohesion (Cartoon & Retro Toy Style)**:
  - Enforce a vibrant, playful Cartoon Sci-Fi theme. Use thick dark borders (`border: 3px solid #050816`) and solid offset drop-shadows (`box-shadow: 4px 4px 0px #050816`) to achieve a cell-shaded comic style.
  - Cards should look like shiny, thick plastic retro toy chips with gloss reflection highlights.
  - Implement a springy hover animation (**Elastic Bounce**) for selectable cards using `transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)`.
- **Game Info HUD**: Display **Elapsed Time (เวลาภารกิจ)** and **Current Round (รอบบิน)** side-by-side in a visible, neat radar-HUD console at the top-center of the screen.
- **Interactive Mascots**:
  - The Alien and Astronaut must have a continuous idle floating animation.
  - The Alien must react dynamically to game outcomes (shocked on correct guess, laughing on wrong guess).
  - The Alien must show a trash-talk bubble with humorous text if the player leaves the screen inactive for more than **7 seconds** (Idle Timer). No cheating/hover hints are allowed on cards.
- **Mobile Portrait Optimization**:
  - **Flat Board**: Disable 3D board tilt (`transform: none !important`) on screens narrower than `1000px` to ensure accurate touch inputs.
  - **Mobile Bottom Sheet**: When a user clicks an AI card on mobile, slide up a full-screen or bottom-sheet input panel (segmented colors on top, 0-11 grid in middle, Joker in center, Confirm/Cancel at bottom) to allow easy one-handed play.
  - **Avatar Mode**: Hide large mascot illustrations on mobile, rendering them as small circular 45px head avatars next to speech bubbles to maximize gameplay area.

---

## 📝 5. CODE QUALITY & SAFE DEPLOYMENT

- **No Placeholders**: Never write incomplete implementations, empty functions, or temporary `// TODO` comments in production files.
- **No Mock Logic**: Avoid leaving testing data, simulated plays, or bypassed calculations in production code.
- **Backward Compatibility**: New features and UI layouts must be tested to ensure they do not break existing single-player gameplay, AI levels, settings, or tutorial modes.

---

## 🔍 6. BEFORE EVERY CHANGE CHECKLIST

Before editing any code, the agent must check for:
1.  **Architectural Conflicts**: Does the change introduce coupling between the game engine and DOM/UI?
2.  **UI Regressions**: Does this change cause vertical scrolling or horizontal overflows on mobile screens?
3.  **State Synchronization**: Does saving and loading this state from `localStorage` work seamlessly without causing a black/white screen of death?
