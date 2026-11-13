# Arct

A browser-based 3D architecture planner. Choose a plot of land, draw walls and rooms,
cut doors and windows into them, lay floors and place furniture, all in a live 3D view
with a top-down plan mode.

## Run it

```bash
npm install
npm run dev
```

`npm run build` writes a static site to `dist/`. `npm run build:single` also folds
everything into one self-contained `dist/standalone.html`.

## What it does

- **Plot** – start a project by picking the plot width and depth in metres; resize it or
  change the ground later from the Project panel.
- **Walls and rooms** – click corner to corner to chain walls, or drag out a whole room
  (four walls and a floor). Points snap to a 0.25 m grid and to existing wall ends.
  Select a wall to edit its length, height, thickness and colour, or drag its end
  handles; shared corners move together.
- **Doors and windows** – hover a wall and click to cut an opening. Drag it along the
  wall or edit its size and sill height.
- **Floors** – timber, tile, carpet, concrete or marble.
- **Furniture** – 31 pieces across living, bedroom, kitchen, bathroom and outdoor.
  Drag to move, `R` to rotate, recolour from the panel.
- **Views** – orbiting 3D, a top-down plan with wall dimensions, and a cutaway that
  lowers the walls to 1 m.
- Undo/redo, autosave to the browser, JSON export/import and PNG snapshots.

## Keys

`1`–`7` tools · `R` rotate · `Del` delete · `Esc` cancel · `Ctrl+Z` / `Ctrl+Shift+Z`
undo/redo · `Ctrl+D` duplicate

## Code map

| File | Role |
| --- | --- |
| `src/state.js` | Project model, undo history, localStorage, example house |
| `src/scene.js` | Renderer, cameras, ground, dimension labels |
| `src/build.js` | Walls with openings, floors, materials |
| `src/furniture.js` | Furniture catalogue built from primitives |
| `src/tools.js` | Pointer tools and snapping |
| `src/ui.js` | Panels, dialogs, tool rail |
