export const DEFAULT_STORY_PHASE_ID = "chapter-1-opening";

export const KINGMAKER_STORY_PHASES = Object.freeze([
  {
    id: "chapter-1-opening",
    label: "Chapter 1 - A Call for Heroes",
    shortLabel: "Call for Heroes",
    chapter: "Chapter 1: A Call for Heroes",
    lane: "Opening",
    sourcePageStart: 16,
    summary: "Restov, Jamandi's charter, the Swordlord's feast, the opening attack, and the first proof that the party deserves a charter.",
    dmBrief: "Use this chapter to establish patronage, public stakes, and why the charter party is being trusted with dangerous work.",
    runBeats: [
      "Show Restov politics through pressure, rivals, and visible judgment.",
      "Turn the opening crisis into a competence test, not a passive intro.",
      "End with a clear charter handoff and one question the party must answer next.",
    ],
    keepHandy: ["Jamandi Aldori", "Restov", "charter authority", "opening rivals", "party introductions"],
    focusTerms: [
      "chapter 1",
      "a call for heroes",
      "opening",
      "swordlord",
      "feast",
      "blood and blades",
      "into the fire",
      "charter",
      "restov",
      "aldori",
      "jamandi",
      "manor",
    ],
  },
  {
    id: "chapter-2-into-the-wild",
    label: "Chapter 2 - Into the Wild",
    shortLabel: "Into the Wild",
    chapter: "Chapter 2: Into the Wild",
    lane: "Hexcrawl",
    sourcePageStart: 44,
    summary: "Hexploration procedures, Greenbelt hex encounters, Old Sycamore, Sootscale Caverns, Candlemere, and other early wilderness sites.",
    dmBrief: "Use this chapter as the sandbox engine: travel choices, rumors, hex discoveries, and local factions should teach that the Stolen Lands are already alive.",
    runBeats: [
      "Make the route choice matter before the encounter starts.",
      "Tie each discovery to a rumor, faction, future kingdom consequence, or map decision.",
      "Keep Old Sycamore and Sootscale as political problems, not only dungeons.",
    ],
    keepHandy: ["hexploration rules", "rumor list", "Old Sycamore", "Sootscale Caverns", "Candlemere", "wilderness discoveries"],
    focusTerms: [
      "chapter 2",
      "into the wild",
      "hexploration",
      "hexploring",
      "hex encounter",
      "greenbelt",
      "old sycamore",
      "sootscale",
      "tartuk",
      "kobold",
      "mite",
      "lonely barrow",
      "lizard king",
      "candlemere",
      "forgotten keep",
      "m'botuu",
      "temple of the elk",
      "bokken",
      "old beldame",
    ],
  },
  {
    id: "chapter-3-stolen-lands",
    label: "Chapter 3 - Stolen Lands",
    shortLabel: "Stolen Lands",
    chapter: "Chapter 3: Stolen Lands",
    lane: "Bandit Front",
    sourcePageStart: 162,
    summary: "Oleg's Trading Post, the Thorn River bandits, the Stag Lord's network, and the victory that clears the way for founding a kingdom.",
    dmBrief: "Use this chapter to make the charter prove itself against visible predatory rule: Oleg, the bandit chain, and the Stag Lord should all point at legitimacy.",
    runBeats: [
      "Start from what the bandits have cost real people.",
      "Let captured clues reveal the network instead of handing over the whole map.",
      "Make the Stag Lord's defeat feel like the right to found something better.",
    ],
    keepHandy: ["Oleg and Svetlana", "Thorn River bandits", "Stag Lord", "bandit clues", "frontier trust"],
    focusTerms: [
      "chapter 3",
      "stolen lands",
      "oleg",
      "svetlana",
      "trading post",
      "greenbelt",
      "trouble at oleg",
      "thorn river",
      "bandit",
      "stag lord",
      "kressle",
      "happs",
      "akiros",
      "nugrah",
      "nettles",
    ],
  },
  {
    id: "kingdom-founding",
    label: "Kingdom Founding",
    shortLabel: "Founding",
    chapter: "Kingdom Founding",
    lane: "Kingdom",
    sourcePageStart: 507,
    summary: "Capital choice, charter package, leadership slate, first kingdom turn, and the handoff from expedition to statecraft.",
    dmBrief: "Use this app phase to bridge AP play into table governance: the players should choose what their realm visibly stands for.",
    runBeats: [
      "Ask what promise the first settlement makes to people living there.",
      "Assign leadership roles only after the table understands what each role means in play.",
      "Record the first law, first project, first risk, and first public disappointment.",
    ],
    keepHandy: ["kingdom rules", "leadership roles", "capital site", "first settlement", "turn sequence"],
    focusTerms: ["kingdom founding", "founding", "capital", "leadership", "charter", "government", "heartland", "settlement"],
  },
  {
    id: "chapter-4-rivers-run-red",
    legacyIds: ["chapter-2-trolls-bloom"],
    label: "Chapter 4 - Rivers Run Red",
    shortLabel: "Rivers Run Red",
    chapter: "Chapter 4: Rivers Run Red",
    lane: "Kingdom Pressure",
    sourcePageStart: 186,
    summary: "Home Sweet Home, Troll Trouble, Hunting the Beast, settlement pressure, and the first major tests of a young kingdom's protection promise.",
    dmBrief: "Use this chapter to prove the kingdom is not just founded, but responsible. Threats should pressure citizens, borders, and ruler choices.",
    runBeats: [
      "Show a local problem that only a functioning kingdom can answer.",
      "Escalate the trolls from monster attacks into organized rival power.",
      "Use settlement needs to make protection and infrastructure feel personal.",
    ],
    keepHandy: ["Troll Trouble", "Hargulka", "settlement pressure", "kingdom turns", "Tatzlford"],
    focusTerms: ["chapter 4", "rivers run red", "home sweet home", "troll", "hargulka", "hunting the beast", "narlmarches", "tatzlford"],
  },
  {
    id: "chapter-5-cult-of-the-bloom",
    label: "Chapter 5 - Cult of the Bloom",
    shortLabel: "Cult of the Bloom",
    chapter: "Chapter 5: Cult of the Bloom",
    lane: "Bloom",
    sourcePageStart: 216,
    summary: "Seeds of Ruin, Full Bloom, the Cradle of Lamashtu, and the escalation from kingdom problem to supernatural outbreak.",
    dmBrief: "Use this chapter to shift from normal kingdom pressure into supernatural crisis response without making the threat feel random.",
    runBeats: [
      "Begin with symptoms and witnesses before naming the cause.",
      "Make every delay visible through settlement fear, illness, or public disorder.",
      "Point clues toward a source so the party can act decisively.",
    ],
    keepHandy: ["Bloom symptoms", "cult clues", "Cradle of Lamashtu", "settlement fallout", "public panic"],
    focusTerms: ["chapter 5", "cult of the bloom", "seeds of ruin", "full bloom", "cradle of lamashtu", "bloom", "lamashtu"],
  },
  {
    id: "chapter-6-varnhold",
    legacyIds: ["chapter-3-varnhold"],
    label: "Chapter 6 - The Varnhold Vanishing",
    shortLabel: "Varnhold Vanishing",
    chapter: "Chapter 6: The Varnhold Vanishing",
    lane: "Mystery",
    sourcePageStart: 250,
    summary: "Varnhold's silence, Nomen relations, lost expeditions, ancient history, and Vordakai's tomb.",
    dmBrief: "Use this chapter as an absence mystery: the missing settlement should feel like a warning about what can happen to any frontier kingdom.",
    runBeats: [
      "Let abandoned routines make Varnhold frightening before combat starts.",
      "Make Nomen contact a diplomatic investigation, not an obstacle course.",
      "Treat Vordakai as old history becoming politically relevant again.",
    ],
    keepHandy: ["Varnhold clues", "Maegar Varn", "Nomen centaurs", "Vordakai", "survivor testimony"],
    focusTerms: ["chapter 6", "varnhold", "vanishing", "vordakai", "nomen", "centaur", "maegar", "gunderson", "tomb"],
  },
  {
    id: "chapter-7-blood-for-blood",
    legacyIds: ["chapter-4-drelev-armag"],
    label: "Chapter 7 - Blood for Blood",
    shortLabel: "Blood for Blood",
    chapter: "Chapter 7: Blood for Blood",
    lane: "War Pressure",
    sourcePageStart: 288,
    summary: "Trouble in Tatzlford, Fort Drelev, the Twice-Born Warlord, Tiger Lords pressure, Armag's legend, and Hooktongue threats.",
    dmBrief: "Use this chapter to test the kingdom against bad rulership, war pressure, refugees, and mythic identity.",
    runBeats: [
      "Contrast the party's rule with Fort Drelev's failures.",
      "Give every military problem a civilian or diplomatic cost.",
      "Separate Armag the person, Armag the legend, and the pressure using that name.",
    ],
    keepHandy: ["Fort Drelev", "refugees", "Tiger Lords", "Armag", "Hooktongue Slough"],
    focusTerms: ["chapter 7", "blood for blood", "drelev", "armag", "tiger lord", "hooktongue", "glenebon", "barony", "twice-born"],
  },
  {
    id: "chapter-8-war-river-kings",
    legacyIds: ["chapter-5-pitax"],
    label: "Chapter 8 - War of the River Kings",
    shortLabel: "Pitax",
    chapter: "Chapter 8: War of the River Kings",
    lane: "Intrigue",
    sourcePageStart: 332,
    summary: "Pitax, Irovetti, sabotage, cultural pressure, tournament politics, and the road toward open conflict.",
    dmBrief: "Use this chapter as legitimacy warfare. Pitax should attack reputation, confidence, and public story before armies settle anything.",
    runBeats: [
      "Frame early problems as local until one detail points to Pitax.",
      "Make public performance and rumor control matter as much as combat wins.",
      "Let Irovetti's charm stay useful and dangerous until the mask breaks.",
    ],
    keepHandy: ["Pitax", "Irovetti", "Rushlight", "Whiterose Abbey", "sabotage", "diplomacy"],
    focusTerms: ["chapter 8", "war of the river kings", "pitax", "irovetti", "rushlight", "whiterose", "liacenza", "infiltration"],
  },
  {
    id: "chapter-9-they-lurk-below",
    label: "Chapter 9 - They Lurk Below",
    shortLabel: "They Lurk Below",
    chapter: "Chapter 9: They Lurk Below",
    lane: "Dread",
    sourcePageStart: 398,
    summary: "Threshold of Dread, the Depth of Fear, and the deep threat that rises before the First World endgame.",
    dmBrief: "Use this chapter as dread between political war and mythic finale: something below the kingdom should force rulers to answer fear itself.",
    runBeats: [
      "Start with missing people, impossible signs, or ground-level panic.",
      "Keep goals clear even when the tone becomes claustrophobic.",
      "Tie the deep threat back to public confidence in the kingdom's protection.",
    ],
    keepHandy: ["Threshold of Dread", "Depth of Fear", "underground threat", "public fear", "deep exploration"],
    focusTerms: ["chapter 9", "they lurk below", "threshold of dread", "depth of fear", "below", "dread"],
  },
  {
    id: "chapter-10-thousand-screams",
    legacyIds: ["chapter-6-first-world"],
    label: "Chapter 10 - Sound of a Thousand Screams",
    shortLabel: "First World",
    chapter: "Chapter 10: Sound of a Thousand Screams",
    lane: "Endgame",
    sourcePageStart: 424,
    summary: "A Month of Destruction, Thousandbreaths, the House at the Edge of Time, Nyrissa, and the hidden pattern behind the Stolen Lands.",
    dmBrief: "Use this chapter to reveal pattern and consequence. Earlier fey pressure should become readable without turning the finale into exposition.",
    runBeats: [
      "Show the kingdom suffering before the route to the source becomes clear.",
      "Make surreal scenes goal-driven so players can still make tactical choices.",
      "Use the House to make earlier promises, losses, and relationships matter.",
    ],
    keepHandy: ["Nyrissa", "Thousandbreaths", "House at the Edge of Time", "First World logic", "kingdom damage"],
    focusTerms: ["chapter 10", "sound of a thousand screams", "nyrissa", "first world", "house at the edge", "thousandbreaths", "thousand breaths"],
  },
  {
    id: "chapter-11-lantern-king",
    label: "Chapter 11 - Curse of the Lantern King",
    shortLabel: "Lantern King",
    chapter: "Chapter 11: Curse of the Lantern King",
    lane: "Finale",
    sourcePageStart: 480,
    summary: "A Broken Apology, the Lantern Kingdom, the Lantern King, and the campaign's final answer to rulership, consequence, and mythic mockery.",
    dmBrief: "Use this chapter as the final argument about what the kingdom means after mythic powers try to turn it into a joke.",
    runBeats: [
      "Keep the emotional stakes clear under the mythic weirdness.",
      "Make public mockery and reality distortion challenge legitimacy, not only safety.",
      "Close with what the rulers choose to preserve, forgive, punish, or rebuild.",
    ],
    keepHandy: ["Lantern King", "Lantern Kingdom", "Broken Apology", "final rulership choices", "campaign epilogue"],
    focusTerms: ["chapter 11", "curse of the lantern king", "lantern king", "lantern kingdom", "broken apology", "finale"],
  },
]);

export const STORY_PHASE_SELECT_OPTIONS = KINGMAKER_STORY_PHASES.map((phase) => ({
  value: phase.id,
  label: phase.label,
}));

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeText(value) {
  return stringValue(value)
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/[^a-z0-9'/: -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getStoryPhaseById(phaseId) {
  return (
    KINGMAKER_STORY_PHASES.find((phase) => phase.id === phaseId || (phase.legacyIds || []).includes(phaseId)) ||
    KINGMAKER_STORY_PHASES[0]
  );
}

export function normalizeStoryFocus(raw = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const activePhase = getStoryPhaseById(stringValue(source.activePhaseId) || DEFAULT_STORY_PHASE_ID);
  return {
    activePhaseId: activePhase.id,
    includeReferenceInAi: source.includeReferenceInAi === false ? false : true,
    updatedAt: stringValue(source.updatedAt),
  };
}

export function getActiveStoryPhase(campaign = {}) {
  return getStoryPhaseById(campaign?.meta?.storyFocus?.activePhaseId || DEFAULT_STORY_PHASE_ID);
}

export function isKingmakerReferenceRecord(record = {}) {
  return stringValue(record?.recordSource) === "kingmaker-reference" || record?.confirmed === false;
}

export function isLiveCampaignRecord(record = {}) {
  if (!record || typeof record !== "object") return false;
  if (isKingmakerReferenceRecord(record)) return record.confirmed === true;
  return true;
}

export function recordMatchesStoryPhase(record = {}, phase = getStoryPhaseById(DEFAULT_STORY_PHASE_ID)) {
  if (!record || typeof record !== "object") return false;
  const haystack = normalizeText(
    [
      record.title,
      record.name,
      record.chapter,
      record.folder,
      record.arc,
      record.location,
      record.linkedQuest,
      record.linkedEvent,
      record.linkedNpc,
      record.faction,
      record.notes,
    ]
      .map(stringValue)
      .filter(Boolean)
      .join(" ")
  );
  if (!haystack) return false;
  if (phase.chapter && haystack.includes(normalizeText(phase.chapter))) return true;
  return (phase.focusTerms || []).some((term) => haystack.includes(normalizeText(term)));
}

export function recordMatchesActiveStoryPhase(record = {}, campaign = {}) {
  return recordMatchesStoryPhase(record, getActiveStoryPhase(campaign));
}

export function shouldSurfaceRecordForFocus(record = {}, campaign = {}, { includeReference = true } = {}) {
  if (isLiveCampaignRecord(record)) return true;
  return includeReference && recordMatchesActiveStoryPhase(record, campaign);
}

export function filterRecordsForStoryFocus(records = [], campaign = {}, options = {}) {
  return (Array.isArray(records) ? records : []).filter((record) => shouldSurfaceRecordForFocus(record, campaign, options));
}
