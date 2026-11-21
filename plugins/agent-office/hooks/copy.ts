// Feedback window for `y` (copy the selected detail): the "copiado" note stays this long after the copy.
export const COPY_NOTE_MS = 2000
// True while the note set at `at` (ms, 0 = never copied) is still on at `now`. Pure: callers inject now.
export const copyNoteOn = (at: number, now: number): boolean => at > 0 && now - at >= 0 && now - at < COPY_NOTE_MS
