import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("reply-waiting ask paths attach rejection handlers immediately", () => {
  const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  const lines = source.split("\n");
  const waitAssignments = lines
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => line === "replyPromise = waitForReply(sendTo, questionId, signal);" ||
      line === "replyPromise = waitForReply(sendTo, questionId, _signal);");

  assert.ok(waitAssignments.length > 0, "expected at least one reply waiter assignment");

  for (const assignment of waitAssignments) {
    const nextLine = lines[assignment.lineNumber]?.trim();
    assert.equal(
      nextLine,
      "replyPromise.catch(() => undefined);",
      `line ${assignment.lineNumber} must attach a rejection handler before any await`,
    );
  }
});

test("regular ask rechecks reply waiter after target resolution", () => {
  const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  const start = source.indexOf('case "ask": {', source.indexOf('name: "intercom"'));
  assert.notEqual(start, -1, "expected regular intercom ask case");
  const end = source.indexOf('case "reply": {', start);
  const askCase = source.slice(start, end);
  const resolveIndex = askCase.indexOf("const sendTo = await resolveSessionTarget(connectedClient, to) ?? to;");
  const questionIndex = askCase.indexOf("const questionId = randomUUID();", resolveIndex);
  assert.ok(resolveIndex > -1, "expected async target resolution");
  assert.ok(questionIndex > resolveIndex, "expected question id after target resolution");

  const between = askCase.slice(resolveIndex, questionIndex);
  assert.ok(
    between.includes("if (replyWaiter) {") &&
      between.includes("Already waiting for a reply") &&
      between.includes("return"),
    "ask must recheck replyWaiter after await and before sending",
  );
});
