/**
 * ColorGrax — Popup Logic
 *
 * Uses the native EyeDropper API (Chrome 95+) to sample colors,
 * displays HEX/RGB/Pantone values in the info bar, supports clipboard copy,
 * and persists the last 8 colors in chrome.storage.local.
 */

// ── DOM References ──
const infoBar     = document.getElementById('info-bar');
const swatch      = document.getElementById('swatch');
const hexBtn      = document.getElementById('hex-btn');
const rgbBtn      = document.getElementById('rgb-btn');
const pantoneBtn  = document.getElementById('pantone-btn');
const hexText     = document.getElementById('hex-text');
const rgbText     = document.getElementById('rgb-text');
const pantoneText = document.getElementById('pantone-text');
const pickBtn     = document.getElementById('pick-btn');
const emptyState  = document.getElementById('empty-state');
const unsupported = document.getElementById('unsupported');
const histSection = document.getElementById('history-section');
const historyRow  = document.getElementById('history-row');

// Maximum number of colors to keep in history
const MAX_HISTORY = 8;

// Lightweight Pantone-like lookup for common brand/print colors.
// This is an approximation and is best used as a helpful reference,
// not as an official Pantone database replacement.
const PANTONE_LIBRARY = [
  { name: 'PMS 185 C', hex: '#C41230' },
  { name: 'PMS 186 C', hex: '#B31B38' },
  { name: 'PMS 2728 C', hex: '#0033AB' },
  { name: 'PMS 300 C', hex: '#0057B8' },
  { name: 'PMS 354 C', hex: '#147D3B' },
  { name: 'PMS 368 C', hex: '#3F9D2A' },
  { name: 'PMS 1235 C', hex: '#F2C200' },
  { name: 'PMS 1585 C', hex: '#F57C00' },
  { name: 'PMS 267 C', hex: '#6A1B9A' },
  { name: 'PMS 432 C', hex: '#5C6B73' },
  { name: 'PMS 109 C', hex: '#F4D748' },
  { name: 'PMS 2935 C', hex: '#80B7E6' }
];

// ── Initialise ──
document.addEventListener('DOMContentLoaded', init);

function init() {
  // Check if the EyeDropper API is available
  if (!('EyeDropper' in window)) {
    // Show unsupported fallback, hide the pick button
    unsupported.classList.remove('hidden');
    emptyState.classList.add('hidden');
    pickBtn.classList.add('hidden');
    return;
  }

  // Wire up event listeners
  pickBtn.addEventListener('click', openEyeDropper);
  hexBtn.addEventListener('click', () => copyToClipboard(hexText.textContent, hexBtn));
  rgbBtn.addEventListener('click', () => copyToClipboard(rgbText.textContent, rgbBtn));
  pantoneBtn.addEventListener('click', () => copyToClipboard(pantoneText.textContent, pantoneBtn));

  // Load saved history
  loadHistory();
}

// ── EyeDropper ──
async function openEyeDropper() {
  // Create a new EyeDropper instance each time
  const eyeDropper = new EyeDropper();

  try {
    // .open() returns a promise that resolves when the user clicks a pixel.
    // result.sRGBHex is the picked color in #RRGGBB format.
    const result = await eyeDropper.open();
    const hex = result.sRGBHex.toUpperCase();

    handleColorPicked(hex);
  } catch (err) {
    // User pressed Escape or cancelled — silently ignore.
    // No error state needed; the popup stays as-is.
    console.log('EyeDropper cancelled:', err.message);
  }
}

// ── Handle Picked Color ──
function handleColorPicked(hex) {
  const rgb = hexToRgb(hex);
  const pantone = findClosestPantone(hex);

  // Update the info bar
  swatch.style.backgroundColor = hex;
  hexText.textContent = hex;
  rgbText.textContent = rgb;
  pantoneText.textContent = pantone || 'PMS —';

  // Show the info bar with animation (remove hidden, the CSS animation handles the rest)
  infoBar.classList.remove('hidden');
  // Re-trigger the slide-down animation by briefly removing/re-adding the element
  infoBar.style.animation = 'none';
  // Force reflow to restart animation
  void infoBar.offsetHeight;
  infoBar.style.animation = '';

  // Hide the empty state illustration once we have a result
  emptyState.classList.add('hidden');

  // Save to history
  saveToHistory(hex);
}

// ── HEX → RGB Conversion ──
/**
 * Converts a hex string like "#3A8DFF" to "rgb(58, 141, 255)".
 */
function hexToRgb(hex) {
  // Remove the leading #
  const stripped = hex.replace('#', '');
  const r = parseInt(stripped.substring(0, 2), 16);
  const g = parseInt(stripped.substring(2, 4), 16);
  const b = parseInt(stripped.substring(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgbObject(hex) {
  const stripped = hex.replace('#', '');
  return {
    r: parseInt(stripped.substring(0, 2), 16),
    g: parseInt(stripped.substring(2, 4), 16),
    b: parseInt(stripped.substring(4, 6), 16)
  };
}

function findClosestPantone(hex) {
  const target = hexToRgbObject(hex);
  let bestMatch = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const swatch of PANTONE_LIBRARY) {
    const candidate = hexToRgbObject(swatch.hex);
    const distance = (
      (target.r - candidate.r) ** 2 +
      (target.g - candidate.g) ** 2 +
      (target.b - candidate.b) ** 2
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = swatch.name;
    }
  }

  return bestMatch;
}

// ── Clipboard Copy ──
/**
 * Copies a value to clipboard and shows a brief "Copied!" toast
 * on the button that was clicked.
 */
async function copyToClipboard(text, buttonEl) {
  try {
    await navigator.clipboard.writeText(text);
    showCopiedToast(buttonEl);
  } catch (err) {
    // Fallback: use the legacy execCommand approach if clipboard API fails
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showCopiedToast(buttonEl);
  }
}

/**
 * Briefly shows the "Copied!" tooltip on a value button.
 */
function showCopiedToast(buttonEl) {
  const toast = buttonEl.querySelector('.copied-toast');
  if (!toast) return;

  toast.classList.add('show');

  // Remove after 1.2 seconds
  setTimeout(() => {
    toast.classList.remove('show');
  }, 1200);
}

// ── Color History (chrome.storage.local) ──
/**
 * Loads saved color history from chrome.storage.local
 * and renders swatches in the history row.
 */
function loadHistory() {
  // Use chrome.storage if available (extension context), otherwise fall back to localStorage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['colorHistory'], (result) => {
      const history = result.colorHistory || [];
      renderHistory(history);
    });
  } else {
    // Fallback for local dev / testing outside extension context
    try {
      const history = JSON.parse(localStorage.getItem('colorHistory') || '[]');
      renderHistory(history);
    } catch {
      renderHistory([]);
    }
  }
}

/**
 * Saves a new color to the front of the history array,
 * deduplicates, and caps at MAX_HISTORY items.
 */
function saveToHistory(hex) {
  const getAndSave = (history) => {
    // Remove duplicate if this color was already stored
    const filtered = history.filter(c => c !== hex);
    // Prepend the new color and cap at MAX_HISTORY
    const updated = [hex, ...filtered].slice(0, MAX_HISTORY);

    // Persist
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ colorHistory: updated });
    } else {
      localStorage.setItem('colorHistory', JSON.stringify(updated));
    }

    renderHistory(updated);
  };

  // Read current history first
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['colorHistory'], (result) => {
      getAndSave(result.colorHistory || []);
    });
  } else {
    try {
      const history = JSON.parse(localStorage.getItem('colorHistory') || '[]');
      getAndSave(history);
    } catch {
      getAndSave([]);
    }
  }
}

/**
 * Renders the history row with clickable swatches.
 * Each swatch copies its HEX value on click and
 * re-selects the color in the info bar.
 */
function renderHistory(history) {
  if (!history.length) {
    histSection.classList.add('hidden');
    return;
  }

  histSection.classList.remove('hidden');
  historyRow.innerHTML = '';

  history.forEach(hex => {
    const el = document.createElement('button');
    el.className = 'history-swatch';
    el.style.backgroundColor = hex;
    el.setAttribute('data-hex', hex);
    el.title = `${hex} — Click to copy`;
    el.setAttribute('aria-label', `Copy color ${hex}`);

    el.addEventListener('click', () => {
      // Re-select this color in the info bar
      handleColorPicked(hex);
      // Also copy to clipboard
      copyToClipboard(hex, el);
    });

    historyRow.appendChild(el);
  });
}
