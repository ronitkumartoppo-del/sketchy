import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHistory, historyCommit, historyRedo, historyUndo } from "./history.ts";

describe("history", () => {
  it("undoes and redoes commits", () => {
    let history = createHistory("a");
    history = historyCommit(history, "b");
    history = historyCommit(history, "c");
    history = historyUndo(history);
    assert.equal(history.present, "b");
    history = historyRedo(history);
    assert.equal(history.present, "c");
  });

  it("drops the redo stack after a new commit", () => {
    let history = createHistory(1);
    history = historyCommit(history, 2);
    history = historyUndo(history);
    history = historyCommit(history, 3);
    assert.equal(history.present, 3);
    assert.deepEqual(history.future, []);
    assert.equal(historyUndo(history).present, 1);
  });

  it("caps the undo stack", () => {
    let history = createHistory(0, 2);
    history = historyCommit(history, 1);
    history = historyCommit(history, 2);
    history = historyCommit(history, 3);
    assert.deepEqual(history.past, [1, 2]);
    assert.equal(history.present, 3);
  });
});
