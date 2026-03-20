const STORAGE_KEY = "pixelingart:v1";
const CELL_SIZE = 20;
const MIN_GRID = 10;
const MAX_GRID = 50;

let gridSize = 16;
let currentColor = "#000000";
let isEraserActive = false;

let isPointerDown = false;
let isFullScreen = false;

const canvas = document.getElementById("canvas");
const gridSizeInput = document.getElementById("gridSize");
const colorPicker = document.getElementById("colorPicker");
const eraserToggle = document.getElementById("eraserToggle");
const fullScreenBtn = document.getElementById("fullScreenBtn");
const scrapBtn = document.getElementById("scrapBtn");
const downloadBtn = document.getElementById("downloadBtn");

// `pixelColors` is the source of truth: each index represents one cell.
// Value is either a CSS color string (e.g. "#ff00aa") or `null` for transparent.
let pixelColors = [];
let pixelElements = [];

function clampInt(value, min, max) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
}

function migratePixelColors(oldColors, oldGrid, newGrid) {
    // Preserve the artwork in the overlapping top-left region.
    // Enlarging extends with empty (transparent) cells.
    // Shrinking crops anything outside the overlap.
    const newLen = newGrid * newGrid;
    const newColors = Array(newLen).fill(null);
    const limit = Math.min(oldGrid, newGrid);

    for (let y = 0; y < limit; y++) {
        for (let x = 0; x < limit; x++) {
            const oldIdx = y * oldGrid + x;
            const newIdx = y * newGrid + x;
            newColors[newIdx] = oldColors[oldIdx] ?? null;
        }
    }
    return newColors;
}

function applyColorToPixel(pixelEl, color) {
    pixelEl.style.backgroundColor = color ?? "transparent";
}

function paintPixelAt(index) {
    if (!pixelElements[index]) return;
    pixelColors[index] = isEraserActive ? null : currentColor;
    applyColorToPixel(pixelElements[index], pixelColors[index]);
    scheduleSave();
}

function buildCanvas() {
    canvas.style.gridTemplateColumns = `repeat(${gridSize}, ${CELL_SIZE}px)`;
    canvas.style.gridTemplateRows = `repeat(${gridSize}, ${CELL_SIZE}px)`;
    canvas.innerHTML = "";

    pixelElements = [];
    const total = gridSize * gridSize;

    for (let index = 0; index < total; index++) {
        const pixel = document.createElement("div");
        pixel.classList.add("pixel");
        applyColorToPixel(pixel, pixelColors[index] ?? null);

        pixel.addEventListener("pointerdown", (e) => {
            // Only primary button (and primary touch/pen). Helps avoid accidental paints.
            if (e.button !== 0) return;
            isPointerDown = true;
            paintPixelAt(index);
        });
        pixel.addEventListener("pointerenter", () => {
            if (!isPointerDown) return;
            paintPixelAt(index);
        });

        pixelElements[index] = pixel;
        canvas.appendChild(pixel);
    }
}

function setGridSize(nextGridSize) {
    const newGrid = clampInt(nextGridSize, MIN_GRID, MAX_GRID);
    if (newGrid === gridSize) return;

    const oldGrid = gridSize;
    const oldColors = pixelColors;

    gridSize = newGrid;
    pixelColors = migratePixelColors(oldColors, oldGrid, gridSize);

    // Keep UI consistent if user types outside min/max.
    gridSizeInput.value = String(gridSize);

    isPointerDown = false;
    buildCanvas();
    scheduleSave();
}

let saveTimer = null;
function persist() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                gridSize,
                pixelColors
            })
        );
    } catch {
        // localStorage may be unavailable (private mode / quota exceeded).
    }
}

function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 120);
}

// ======================== PREVIEW ========================
function clearAllPixels() {
    pixelColors = Array(gridSize * gridSize).fill(null);
    for (let i = 0; i < pixelElements.length; i++) {
        if (!pixelElements[i]) continue;
        applyColorToPixel(pixelElements[i], null);
    }
    scheduleSave();
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;

        const parsed = JSON.parse(raw);
        const savedGrid = clampInt(parsed.gridSize, MIN_GRID, MAX_GRID);
        if (!Array.isArray(parsed.pixelColors)) return false;

        gridSize = savedGrid;
        gridSizeInput.value = String(gridSize);

        pixelColors = Array(gridSize * gridSize).fill(null);
        const storedColors = parsed.pixelColors;
        const limit = Math.min(pixelColors.length, storedColors.length);
        for (let i = 0; i < limit; i++) {
            pixelColors[i] = storedColors[i] || null;
        }
        return true;
    } catch {
        return false;
    }
}

function init() {
    gridSize = clampInt(gridSizeInput.value, MIN_GRID, MAX_GRID);
    pixelColors = Array(gridSize * gridSize).fill(null);

    // Restore saved artwork (if any).
    const loaded = loadState();
    if (!loaded) {
        gridSizeInput.value = String(gridSize);
    }

    eraserToggle.textContent = "Eraser Off";
    buildCanvas();
}

// ======================== DRAG TO PAINT FEATURE ========================
canvas.addEventListener("pointerup", () => {
    isPointerDown = false;
});
canvas.addEventListener("pointerleave", () => {
    isPointerDown = false;
});
window.addEventListener("pointerup", () => {
    isPointerDown = false;
});
window.addEventListener("pointercancel", () => {
    isPointerDown = false;
});
// ======================== END OF DRAG TO PAINT FEATURE ========================

// Toggle the eraser tool
eraserToggle.addEventListener("click", () => {
    isEraserActive = !isEraserActive;
    eraserToggle.textContent = isEraserActive ? "Eraser On" : "Eraser Off";
    scheduleSave();
});

// Fully erase the whole artwork
scrapBtn.addEventListener("click", () => {
    clearAllPixels();
});

// Handle grid size change (migrates existing artwork instead of wiping it)
gridSizeInput.addEventListener("input", (e) => {
    const next = parseInt(e.target.value, 10);
    if (Number.isNaN(next)) return;
    setGridSize(next);
});

// Handle color selection
colorPicker.addEventListener("input", (e) => {
    currentColor = e.target.value;
});

// Full-screen toggle
fullScreenBtn.addEventListener("click", async () => {
    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
            isFullScreen = false;
        } else {
            await document.documentElement.requestFullscreen();
            isFullScreen = true;
        }
    } catch {
        // Ignore fullscreen errors.
    }
});

document.addEventListener("fullscreenchange", () => {
    isFullScreen = !!document.fullscreenElement;
    fullScreenBtn.textContent = isFullScreen ? "Exit Full Screen" : "Full Screen";
});

function downloadPng() {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = gridSize * CELL_SIZE;
    exportCanvas.height = gridSize * CELL_SIZE;

    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    // Leave background transparent, only draw painted pixels.
    ctx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);

    for (let index = 0; index < pixelColors.length; index++) {
        const color = pixelColors[index];
        if (!color) continue;

        const x = (index % gridSize) * CELL_SIZE;
        const y = Math.floor(index / gridSize) * CELL_SIZE;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    }

    const dataURL = exportCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = "pixelingart.png";
    link.click();
}

// Download the canvas as a PNG image
downloadBtn.addEventListener("click", () => {
    downloadPng();
});

// Initialize the canvas
init();
