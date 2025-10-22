const ORIENTATIONS = [
  { name: "horizontal", delta: [0, 1] },
  { name: "horizontalBack", delta: [0, -1] },
  { name: "vertical", delta: [1, 0] },
  { name: "verticalUp", delta: [-1, 0] },
  { name: "diagonal", delta: [1, 1] },
  { name: "diagonalBack", delta: [1, -1] },
  { name: "diagonalUp", delta: [-1, 1] },
  { name: "diagonalUpBack", delta: [-1, -1] }
];

const DEFAULT_L10N = {
  check: "Corrigir",
  tryAgain: "Repetir",
  showSolution: "Mostrar solu\u00e7\u00e3o",
  found: "@found de @totalWords encontrada(s)",
  timeSpent: "Tempo gasto",
  score: "Voc\u00ea conseguiu @score de @total pontos",
  wordListHeader: "Palavras"
};

const DEFAULT_BEHAVIOUR = {
  orientations: {
    horizontal: true,
    horizontalBack: true,
    vertical: true,
    verticalUp: true,
    diagonal: true,
    diagonalBack: true,
    diagonalUp: true,
    diagonalUpBack: true
  },
  fillPool: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  preferOverlap: true,
  showVocabulary: true,
  enableShowSolution: true,
  enableRetry: true
};

const state = {
  behaviour: null,
  l10n: DEFAULT_L10N,
  words: [],
  gridLetters: [],
  cellElements: [],
  wordData: [],
  wordLookup: new Map(),
  foundCount: 0,
  timerId: null,
  elapsedSeconds: 0,
  locked: false,
  selection: {
    active: false,
    pointerId: null,
    start: null,
    path: [],
    cells: []
  }
};

const elements = {
  app: document.getElementById("app"),
  grid: document.getElementById("grid"),
  vocabulary: document.getElementById("vocabulary"),
  wordList: document.getElementById("word-list"),
  taskDescription: document.getElementById("task-description"),
  vocabularyTitle: document.getElementById("vocabulary-title"),
  timerLabel: document.getElementById("timer-label"),
  timerValue: document.getElementById("timer-value"),
  counterLabel: document.getElementById("counter-label"),
  counterValue: document.getElementById("counter-value"),
  checkBtn: document.getElementById("check-btn"),
  showSolutionBtn: document.getElementById("show-solution-btn"),
  retryBtn: document.getElementById("retry-btn"),
  feedback: document.getElementById("feedback"),
  wordTemplate: document.getElementById("word-item-template")
};

init().catch((error) => {
  console.error(error);
  elements.feedback.textContent = "Erro ao inicializar o jogo.";
  elements.feedback.dataset.visible = "true";
  state.locked = true;
});

async function init() {
  const data = await loadConfig();
  setupConfig(data);
  setupUI();
  attachEventListeners();
  startNewGame();
}

async function loadConfig() {
  const response = await fetch("./data.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Falha ao carregar data.json (${response.status})`);
  }
  return response.json();
}

function setupConfig(config) {
  state.l10n = { ...DEFAULT_L10N, ...(config?.l10n || {}) };
  state.behaviour = mergeBehaviour(config?.behaviour || {});
  state.words = normalizeWords(config?.wordList);
  if (state.words.length === 0) {
    throw new Error("Lista de palavras vazia.");
  }

  const description = config?.taskDescription?.trim();
  elements.taskDescription.textContent =
    description || "Encontre todas as palavras na grade.";
}

function mergeBehaviour(customBehaviour) {
  const merged = {
    ...DEFAULT_BEHAVIOUR,
    ...customBehaviour,
    orientations: {
      ...DEFAULT_BEHAVIOUR.orientations,
      ...(customBehaviour.orientations || {})
    }
  };

  if (!merged.fillPool || typeof merged.fillPool !== "string") {
    merged.fillPool = DEFAULT_BEHAVIOUR.fillPool;
  }

  return merged;
}

function normalizeWords(wordList) {
  if (!Array.isArray(wordList)) {
    if (typeof wordList === "string") {
      return wordList
        .split(",")
        .map((word) => word.trim())
        .filter(Boolean)
        .map((word) => word.toUpperCase());
    }
    return [];
  }

  return wordList
    .map((word) => (typeof word === "string" ? word.trim() : ""))
    .filter(Boolean)
    .map((word) => word.toUpperCase());
}

function setupUI() {
  elements.app.dataset.state = "ready";

  elements.checkBtn.textContent = state.l10n.check;
  elements.showSolutionBtn.textContent = state.l10n.showSolution;
  elements.retryBtn.textContent = state.l10n.tryAgain;

  elements.timerLabel.textContent = state.l10n.timeSpent;
  elements.vocabularyTitle.textContent = state.l10n.wordListHeader;

  if (!state.behaviour.showVocabulary) {
    elements.vocabulary.setAttribute("hidden", "true");
  } else {
    elements.vocabulary.removeAttribute("hidden");
  }

  if (!state.behaviour.enableShowSolution) {
    elements.showSolutionBtn.setAttribute("hidden", "true");
  } else {
    elements.showSolutionBtn.removeAttribute("hidden");
    elements.showSolutionBtn.disabled = false;
  }

  if (!state.behaviour.enableRetry) {
    elements.retryBtn.setAttribute("hidden", "true");
  } else {
    elements.retryBtn.removeAttribute("hidden");
    elements.retryBtn.disabled = false;
  }

  updateFeedback("");
}

function attachEventListeners() {
  elements.grid.addEventListener("pointerdown", handlePointerDown);
  elements.checkBtn.addEventListener("click", handleCheck);
  elements.showSolutionBtn.addEventListener("click", handleShowSolution);
  elements.retryBtn.addEventListener("click", handleRetry);
}

function startNewGame() {
  state.locked = false;
  state.foundCount = 0;
  clearSelection();
  stopTimer();
  updateFeedback("");

  const puzzle = generatePuzzle(state.words, state.behaviour);
  state.gridLetters = puzzle.grid;
  state.wordData = puzzle.wordPlacements;
  state.wordLookup = buildWordLookup(state.wordData);

  renderGrid(puzzle);
  state.cellElements = puzzle.cellMatrix;
  renderVocabulary(state.wordData);

  updateCounter();
  resetTimer();
  toggleButtons(true);
  startTimer();
}

function toggleButtons(enabled) {
  elements.checkBtn.disabled = !enabled && state.foundCount !== state.wordData.length;
  if (state.behaviour.enableShowSolution) {
    elements.showSolutionBtn.disabled = !enabled;
  }
  if (state.behaviour.enableRetry) {
    elements.retryBtn.disabled = false;
  }
}

function generatePuzzle(words, behaviour) {
  const orientations = ORIENTATIONS.filter(
    (orientation) => behaviour.orientations[orientation.name]
  );

  if (orientations.length === 0) {
    throw new Error("Nenhuma orientação disponível para montar o caça-palavras.");
  }

  const uppercaseWords = [...words];
  const sortedWords = [...uppercaseWords].sort((a, b) => b.length - a.length);

  const longest = sortedWords[0].length;
  const totalLetters = sortedWords.reduce((sum, word) => sum + word.length, 0);
  const baseSize = Math.max(longest, Math.ceil(Math.sqrt(totalLetters)) + 1);
  const maxSize = Math.max(baseSize, longest + 4, 12);

  const preferOverlap = Boolean(behaviour.preferOverlap);
  const fillPool = prepareFillPool(behaviour.fillPool);

  for (let size = baseSize; size <= maxSize; size += 1) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const grid = createEmptyGrid(size);
      const placements = [];

      let failed = false;
      const workingWords = shuffle([...sortedWords]);

      for (const word of workingWords) {
        const placement = placeWord(word, grid, orientations, preferOverlap);
        if (!placement) {
          failed = true;
          break;
        }
        placements.push(placement);
        applyPlacement(grid, placement);
      }

      if (!failed) {
        const filledGrid = fillRemainingCells(grid, fillPool);
        const cellMatrix = buildCellMatrix(size);
        return {
          grid: filledGrid,
          size,
          wordPlacements: placements,
          cellMatrix
        };
      }
    }
  }

  throw new Error("N\u00e3o foi poss\u00edvel posicionar todas as palavras na grade.");
}

function prepareFillPool(pool) {
  const cleaned = typeof pool === "string" && pool.trim().length > 0 ? pool : DEFAULT_BEHAVIOUR.fillPool;
  const letters = cleaned
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return letters.length > 0 ? letters : DEFAULT_BEHAVIOUR.fillPool;
}

function createEmptyGrid(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}

function buildCellMatrix(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}

function fillRemainingCells(grid, pool) {
  const letters = grid.map((row) =>
    row.map((cell) => cell || pool[Math.floor(Math.random() * pool.length)])
  );
  return letters;
}

function placeWord(word, grid, orientations, preferOverlap) {
  const size = grid.length;
  const placements = [];

  for (const orientation of shuffle([...orientations])) {
    const [dr, dc] = orientation.delta;
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const candidate = evaluatePlacement(word, grid, row, col, dr, dc);
        if (candidate) {
          placements.push({ ...candidate, orientation: orientation.name });
        }
      }
    }
  }

  if (placements.length === 0) {
    return null;
  }

  let candidates = placements;

  if (preferOverlap) {
    const maxOverlap = Math.max(...placements.map((item) => item.overlap));
    candidates = placements.filter((item) => item.overlap === maxOverlap);
  }

  return randomChoice(candidates);
}

function evaluatePlacement(word, grid, startRow, startCol, dr, dc) {
  const size = grid.length;
  const endRow = startRow + dr * (word.length - 1);
  const endCol = startCol + dc * (word.length - 1);

  if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) {
    return null;
  }

  let overlap = 0;
  const path = [];

  for (let index = 0; index < word.length; index += 1) {
    const row = startRow + dr * index;
    const col = startCol + dc * index;
    const current = grid[row][col];
    const letter = word[index];

    if (current && current !== letter) {
      return null;
    }

    if (current === letter) {
      overlap += 1;
    }
    path.push({ row, col });
  }

  return {
    word,
    start: { row: startRow, col: startCol },
    end: { row: endRow, col: endCol },
    path,
    overlap
  };
}

function applyPlacement(grid, placement) {
  placement.path.forEach(({ row, col }, index) => {
    grid[row][col] = placement.word[index];
  });
}

function buildWordLookup(wordPlacements) {
  const lookup = new Map();
  wordPlacements.forEach((placement) => {
    placement.found = false;
    placement.solved = false;
    placement.listItem = null;
    const straight = placement.word;
    const reversed = reverseString(straight);
    lookup.set(straight, placement);
    lookup.set(reversed, placement);
  });
  return lookup;
}

function renderGrid(puzzle) {
  const { grid, size, cellMatrix } = puzzle;
  elements.grid.innerHTML = "";
  elements.grid.style.setProperty("--grid-size", String(size));
  elements.grid.setAttribute("aria-rowcount", String(size));
  elements.grid.setAttribute("aria-colcount", String(size));

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "grid__cell";
      cell.textContent = grid[row][col];
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.setAttribute("aria-label", `Linha ${row + 1}, Coluna ${col + 1}, letra ${grid[row][col]}`);
      elements.grid.append(cell);
      cellMatrix[row][col] = cell;
    }
  }
}

function renderVocabulary(wordPlacements) {
  elements.wordList.innerHTML = "";

  if (!state.behaviour.showVocabulary) {
    return;
  }

  wordPlacements
    .slice()
    .sort((a, b) => a.word.localeCompare(b.word))
    .forEach((placement) => {
      const item = elements.wordTemplate.content.firstElementChild.cloneNode(true);
      const label = item.querySelector(".word-item__label");
      label.textContent = placement.word;
      placement.listItem = item;
      elements.wordList.append(item);
    });
}

function handlePointerDown(event) {
  if (state.locked) {
    return;
  }

  const cell = event.target.closest(".grid__cell");
  if (!cell) {
    return;
  }

  event.preventDefault();
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);

  state.selection.active = true;
  state.selection.pointerId = event.pointerId;
  state.selection.start = { row, col };
  state.selection.path = [{ row, col }];
  state.selection.cells = [cell];

  applyPreview([cell]);

  window.addEventListener("pointermove", handlePointerMove, { passive: false });
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("pointercancel", handlePointerCancel);
}

function handlePointerMove(event) {
  if (!state.selection.active || event.pointerId !== state.selection.pointerId) {
    return;
  }

  event.preventDefault();
  const cell = getCellAtPoint(event.clientX, event.clientY);
  if (!cell) {
    updateSelectionPath(null);
    return;
  }
  updateSelectionPath(cell);
}

function handlePointerUp(event) {
  if (!state.selection.active || event.pointerId !== state.selection.pointerId) {
    return;
  }
  finalizeSelection();
}

function handlePointerCancel() {
  clearSelection();
}

function getCellAtPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  if (!element) {
    return null;
  }
  return element.classList.contains("grid__cell")
    ? element
    : element.closest(".grid__cell");
}

function updateSelectionPath(targetCell) {
  const start = state.selection.start;
  if (!start) {
    return;
  }

  if (!targetCell) {
    const fallback = getCellNode(start.row, start.col) || state.selection.cells[0];
    applyPreview(fallback ? [fallback] : []);
    state.selection.path = [start];
    return;
  }

  const row = Number(targetCell.dataset.row);
  const col = Number(targetCell.dataset.col);

  const path = computeStraightPath(start, { row, col });

  if (!path) {
    const fallback = getCellNode(start.row, start.col) || state.selection.cells[0];
    applyPreview(fallback ? [fallback] : []);
    state.selection.path = [start];
    return;
  }

  state.selection.path = path;
  const cells = path.map((position) => getCellNode(position.row, position.col));
  applyPreview(cells);
}

function computeStraightPath(start, end) {
  const dr = end.row - start.row;
  const dc = end.col - start.col;
  const absR = Math.abs(dr);
  const absC = Math.abs(dc);

  if (absR === 0 && absC === 0) {
    return [start];
  }

  const validLine =
    (absR === 0 && absC > 0) ||
    (absC === 0 && absR > 0) ||
    absR === absC;

  if (!validLine) {
    return null;
  }

  const stepR = Math.sign(dr);
  const stepC = Math.sign(dc);
  const length = Math.max(absR, absC);
  const path = [];

  for (let index = 0; index <= length; index += 1) {
    path.push({
      row: start.row + stepR * index,
      col: start.col + stepC * index
    });
  }

  return path;
}

function applyPreview(cells) {
  clearPreview();
  if (!Array.isArray(cells) || cells.length === 0) {
    return;
  }
  cells.forEach((cell) => {
    if (cell) {
      cell.classList.add("grid__cell--preview");
    }
  });
  state.selection.cells = cells;
}

function clearPreview() {
  state.selection.cells.forEach((cell) => {
    if (cell) {
      cell.classList.remove("grid__cell--preview");
    }
  });
  state.selection.cells = [];
}

function finalizeSelection() {
  const path = state.selection.path;
  clearSelectionListeners();
  if (!Array.isArray(path) || path.length === 0) {
    clearSelection();
    return;
  }

  const word = path.map((coords) => state.gridLetters[coords.row][coords.col]).join("");
  const candidate = state.wordLookup.get(word);

  if (candidate && !candidate.found) {
    markWordAsFound(candidate);
  }

  clearSelection();
}

function clearSelection() {
  clearPreview();
  state.selection = {
    active: false,
    pointerId: null,
    start: null,
    path: [],
    cells: []
  };
  clearSelectionListeners();
}

function clearSelectionListeners() {
  window.removeEventListener("pointermove", handlePointerMove);
  window.removeEventListener("pointerup", handlePointerUp);
  window.removeEventListener("pointercancel", handlePointerCancel);
}

function markWordAsFound(wordData) {
  wordData.found = true;
  state.foundCount += 1;

  highlightPath(wordData.path, "grid__cell--found");

  if (wordData.listItem) {
    wordData.listItem.classList.remove("word-item--solved");
    wordData.listItem.classList.add("word-item--found");
  }

  updateCounter();

  if (state.foundCount === state.wordData.length) {
    stopTimer();
    state.locked = true;
    toggleButtons(false);
    showScoreFeedback();
  }
}

function highlightPath(path, className) {
  path.forEach(({ row, col }) => {
    const cell = state.cellElements[row][col];
    if (cell) {
      cell.classList.add(className);
    }
  });
}

function updateCounter() {
  const label = state.l10n.found
    .replace("@found", String(state.foundCount))
    .replace("@totalWords", String(state.wordData.length));

  elements.counterLabel.textContent = label;
  elements.counterValue.textContent = "";
}

function resetTimer() {
  state.elapsedSeconds = 0;
  updateTimerUI();
}

function startTimer() {
  stopTimer();
  state.timerId = window.setInterval(() => {
    state.elapsedSeconds += 1;
    updateTimerUI();
  }, 1000);
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function updateTimerUI() {
  elements.timerValue.textContent = formatTime(state.elapsedSeconds);
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function handleCheck() {
  showScoreFeedback();
}

function showScoreFeedback() {
  const text = state.l10n.score
    .replace("@score", String(state.foundCount))
    .replace("@total", String(state.wordData.length));
  updateFeedback(text);
}

function handleShowSolution() {
  if (state.locked) {
    return;
  }
  stopTimer();
  state.locked = true;
  toggleButtons(false);

  state.wordData.forEach((wordData) => {
    if (!wordData.found) {
      highlightPath(wordData.path, "grid__cell--solved");
      if (wordData.listItem) {
        wordData.listItem.classList.add("word-item--solved");
      }
    } else {
      highlightPath(wordData.path, "grid__cell--found");
    }
    wordData.solved = true;
  });

  showScoreFeedback();
}

function handleRetry() {
  startNewGame();
}

function updateFeedback(message) {
  if (!message) {
    elements.feedback.dataset.visible = "false";
    elements.feedback.textContent = "";
    return;
  }
  elements.feedback.dataset.visible = "true";
  elements.feedback.textContent = message;
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function reverseString(value) {
  return value.split("").reverse().join("");
}

function getCellNode(row, col) {
  if (!state.cellElements[row]) {
    return null;
  }
  return state.cellElements[row][col] || null;
}
