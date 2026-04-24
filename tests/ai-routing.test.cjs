"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const aiRouting = require("../src/shared/aiRouting.cjs");

function route(message, selectedPageMode = "ask", scopeTag = "@app") {
  return aiRouting.resolveAiRoute(message, selectedPageMode, scopeTag);
}

test("What class should I play for Kingmaker routes to player_build advice and excludes opening notes", () => {
  const result = route("What class should I play for Kingmaker?");
  assert.equal(result.intent, "player_build");
  assert.equal(result.answerMode, "advice");
  assert.ok(result.excludedBuckets.includes("opening_notes"));
});

test("Build me a level 1 goblin bard routes to player_build advice and excludes opening notes", () => {
  const result = route("Build me a level 1 goblin bard");
  assert.equal(result.intent, "player_build");
  assert.equal(result.answerMode, "advice");
  assert.ok(result.excludedBuckets.includes("opening_notes"));
});

test("Sorcerer shorthand pointer request routes to player_build advice", () => {
  const result = route("im going to be playing a sor can you give me some pointers.");
  assert.equal(result.intent, "player_build");
  assert.equal(result.answerMode, "advice");
  assert.ok(result.excludedBuckets.includes("opening_notes"));
  assert.ok(result.excludedBuckets.includes("gm_notes"));
});

test("How does hexploration work routes to rules_question rules", () => {
  const result = route("How does hexploration work?");
  assert.equal(result.intent, "rules_question");
  assert.equal(result.answerMode, "rules");
});

test("Prep Oleg's bandit attack for tonight routes to gm_prep prep", () => {
  const result = route("Prep Oleg's bandit attack for tonight");
  assert.equal(result.intent, "gm_prep");
  assert.equal(result.answerMode, "prep");
});

test("Recap last session routes to campaign_recall recall", () => {
  const result = route("Recap last session");
  assert.equal(result.intent, "campaign_recall");
  assert.equal(result.answerMode, "recall");
});

test("Write opening narration for the Jamandi feast routes to opening narration and includes opening notes", () => {
  const result = route("Write opening narration for the Jamandi feast");
  assert.equal(result.intent, "session_start_or_opening");
  assert.equal(result.answerMode, "narration");
  assert.ok(result.includedBuckets.includes("opening_notes"));
});

test("Create an NPC for Oleg's routes to create_or_update_content create when explicit create language is present", () => {
  const result = route("Create an NPC for Oleg's");
  assert.equal(result.intent, "create_or_update_content");
  assert.equal(result.answerMode, "create");
});

test("Create mode defaults ambiguous prompts to create_or_update_content", () => {
  const result = route("NPC for Oleg's", "create");
  assert.equal(result.intent, "create_or_update_content");
  assert.equal(result.answerMode, "create");
});
