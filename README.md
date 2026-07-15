# Multiverse Shift

A browser-based arcade game where you jump between parallel universes, collect multiverse fragments, and survive each realm’s rewritten rules.

## Play

Open `index.html` in a modern browser, or serve the folder locally:

```bash
# Python
python3 -m http.server 8080

# Node (if you have npx)
npx serve .
```

Then visit `http://localhost:8080`.

## Controls

| Key | Action |
|-----|--------|
| `WASD` / Arrow keys | Move |
| `Space` / `E` | Shift to another universe |
| `P` | Pause / resume |
| `Enter` | Start / restart from the menu |

## How to win

1. Collect **5 fragments** in the current universe (optional for shifting, but required for progress).
2. **Shift** between realms — each universe has different speed, hazards, and enemy behavior.
3. Clear **all five universes** (Prime, Neon Tide, Ember Fold, Void Mirror, Crystal Lattice) to stabilize the multiverse.

You have **3 lives**. Colliding with enemies or hazards costs a life.

## Universes

- **Prime** — baseline physics, balanced pace  
- **Neon Tide** — faster movement, drift currents, sine-wave hazards  
- **Ember Fold** — aggressive enemies, flame zones  
- **Void Mirror** — gravity wells that pull you in  
- **Crystal Lattice** — spinning spike hazards, grid terrain  

## Stack

Pure HTML, CSS, and Canvas JavaScript — no build step, no dependencies.

## License

MIT
