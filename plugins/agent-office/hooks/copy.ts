// Feedback window for `y` (copy the selected detail): the "copiado" note stays this long after the copy.
export const COPY_NOTE_MS = 2000
// True while the note set at `at` (ms, 0 = never copied) is still on at `now`. Pure: callers inject now.
export const copyNoteOn = (at: number, now: number): boolean => at > 0 && now - at >= 0 && now - at < COPY_NOTE_MS
// Host answer to $.ui.copy: the plugin sees {isCopied, reason}; the app's own answer is {copied}. Accept either.
export const copyOk = (r: unknown): boolean => typeof r === 'object' && r !== null && ((r as { isCopied?: unknown }).isCopied === true || (r as { copied?: unknown }).copied === true)
