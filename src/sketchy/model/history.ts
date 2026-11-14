export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  limit: number;
}

export function createHistory<T>(present: T, limit = 80): History<T> {
  return { past: [], present, future: [], limit };
}

export function historyCommit<T>(history: History<T>, present: T): History<T> {
  if (Object.is(history.present, present)) return history;
  return {
    ...history,
    past: [...history.past, history.present].slice(-history.limit),
    present,
    future: [],
  };
}

export function historyUndo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history;
  const present = history.past[history.past.length - 1]!;
  return {
    ...history,
    past: history.past.slice(0, -1),
    present,
    future: [history.present, ...history.future],
  };
}

export function historyRedo<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;
  const present = history.future[0]!;
  return {
    ...history,
    past: [...history.past, history.present],
    present,
    future: history.future.slice(1),
  };
}
