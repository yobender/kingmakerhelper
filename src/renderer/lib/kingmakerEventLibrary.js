export const KINGMAKER_EVENT_LIBRARY_VERSION = "kingmaker-events-v1";

export const KINGMAKER_STARTER_EVENT_IDS = Object.freeze(["km-evt-001", "km-evt-002"]);

function createKingmakerEvent(number, input = {}) {
  const id = `km-evt-${String(number).padStart(3, "0")}`;
  const title = input.title || `Kingmaker Event ${number}`;
  const status = input.status || "library";
  const category = input.category || "story";
  const hex = input.hex || "";

  return {
    id,
    title,
    status,
    category,
    urgency: input.urgency ?? 3,
    clock: input.clock ?? 0,
    clockMax: input.clockMax ?? 4,
    advancePerTurn: input.advancePerTurn ?? 1,
    advanceOn: input.advanceOn || (status === "active" || status === "escalated" ? "turn" : "manual"),
    impactScope: input.impactScope || (category === "kingdom" ? "always" : hex ? "claimed-hex" : "none"),
    folder: input.folder || "Library / General",
    hex,
    linkedQuest: input.linkedQuest || "",
    linkedCompanion: input.linkedCompanion || "",
    trigger: input.trigger || "",
    fallout: input.fallout || "",
    consequenceSummary: input.consequenceSummary || "",
    notes: input.notes || "",
    rpImpact: input.rpImpact ?? 0,
    unrestImpact: input.unrestImpact ?? 0,
    renownImpact: input.renownImpact ?? 0,
    fameImpact: input.fameImpact ?? 0,
    infamyImpact: input.infamyImpact ?? 0,
    foodImpact: input.foodImpact ?? 0,
    lumberImpact: input.lumberImpact ?? 0,
    luxuriesImpact: input.luxuriesImpact ?? 0,
    oreImpact: input.oreImpact ?? 0,
    stoneImpact: input.stoneImpact ?? 0,
    corruptionImpact: input.corruptionImpact ?? 0,
    crimeImpact: input.crimeImpact ?? 0,
    decayImpact: input.decayImpact ?? 0,
    strifeImpact: input.strifeImpact ?? 0,
  };
}

function createGroup(defaults, entries) {
  return entries.map(({ id, ...input }) => createKingmakerEvent(id, { ...defaults, ...input }));
}

const STARTER_EVENTS = [
  createKingmakerEvent(1, {
    title: "First Bandit Collection Run",
    category: "threat",
    status: "active",
    urgency: 4,
    hex: "D4",
    advancePerTurn: 1,
    advanceOn: "turn",
    impactScope: "claimed-hex",
    linkedQuest: "Secure Oleg's Trading Post",
    trigger: "The bandits expect tribute soon and will escalate if the outpost resists.",
    fallout: "If ignored, supply pressure, local fear, and the party's reputation all worsen.",
    consequenceSummary: "Bandit pressure hits the fledgling charter's supply line and local trust.",
    clock: 1,
    clockMax: 4,
    unrestImpact: 1,
    renownImpact: -1,
    foodImpact: -1,
    notes: "Use this as the first frontier clock the players can feel.",
    folder: "Travel Pressure",
  }),
  createKingmakerEvent(2, {
    title: "Jamandi Wants Results",
    category: "kingdom",
    status: "active",
    urgency: 3,
    hex: "A1",
    advancePerTurn: 1,
    advanceOn: "turn",
    impactScope: "always",
    linkedCompanion: "Linzi",
    trigger: "The charter only stays politically valuable if the expedition produces visible progress.",
    fallout: "Slow movement weakens support, raises scrutiny, and reframes later diplomacy.",
    consequenceSummary: "If the charter stalls, Restov's support cools and the kingdom starts from a weaker political position.",
    clock: 0,
    clockMax: 3,
    renownImpact: -1,
    fameImpact: -1,
    infamyImpact: 1,
    notes: "Tie political support to visible results, not vague goodwill.",
    folder: "Kingdom Pressure",
  }),
];

const CHARTER_AND_OPENING_PRESSURE = createGroup(
  {
    folder: "Library / Charter And Opening Pressure",
    notes: "Source cue: Adventure Path chapter 1 opening pressure around Restov, Oleg's, and the early charter.",
  },
  [
    { id: 3, title: "Black Tears Survivor Knows Too Much", category: "story", urgency: 4, hex: "D4", trigger: "A half-broken merchant from the Black Tears route reaches Oleg's with names, prices, and one accusation that points at organized protection.", fallout: "If ignored, frightened settlers stop talking to the charter and start assuming the bandits own the road.", consequenceSummary: "A living witness can turn rumor into evidence before the next raid lands." },
    { id: 4, title: "Feast Rumor Turns Into Rival Claim", category: "quest", urgency: 3, hex: "A1", trigger: "One tale from Jamandi's feast resurfaces as a rival claimant insists the Greenbelt charter was promised twice.", fallout: "If the party cannot answer the rumor, later Brevic politics gain an easy way to diminish their authority.", consequenceSummary: "A courtly rumor threatens to become a legal challenge against the expedition's legitimacy." },
    { id: 5, title: "Castruccio's Agent Tests the Charter", category: "kingdom", urgency: 4, hex: "A1", trigger: "A polished envoy asks pointed questions about supply, leadership, and whether Restov sent amateurs into the Greenbelt.", fallout: "A weak answer gives Brevic rivals a clean story about a failed charter.", consequenceSummary: "The charter is being evaluated as much in salons as on the frontier.", renownImpact: -1, infamyImpact: 1 },
    { id: 6, title: "Oleg Refuses Another Humiliation", category: "threat", urgency: 4, hex: "D4", trigger: "Oleg decides he would rather fight than pay one more round of tribute, whether the party is ready or not.", fallout: "If nobody helps him channel that anger, the next bandit visit becomes bloodier and less controlled.", consequenceSummary: "The trading post's fear turns into action before the party has full control of the situation." },
    { id: 7, title: "Svetlana Quietly Stocks an Escape Cache", category: "story", urgency: 2, hex: "D4", trigger: "Svetlana begins hiding food, medicines, and keepsakes where Oleg will not see them unless the worst happens.", fallout: "If the party notices too late, morale at the post is already past reassurance and into evacuation thinking.", consequenceSummary: "The outpost's emotional state becomes visible through what people are preparing to abandon." },
    { id: 8, title: "Moon Radish Goodwill Opportunity", category: "quest", urgency: 2, hex: "D4", trigger: "A small ask tied to Svetlana's moon radishes becomes the safest possible first proof that the charter helps real people.", fallout: "Passing on it wastes a low-risk way to build goodwill before the hard choices arrive.", consequenceSummary: "A modest favor can become the party's first true local victory." },
    { id: 9, title: "Bokken Needs Rare Reagents", category: "quest", urgency: 3, hex: "E5", trigger: "Bokken needs strange roots and monster traces that only an active expedition can retrieve safely.", fallout: "Ignoring him closes off potions, rumors, and one of the Greenbelt's strangest early informants.", consequenceSummary: "Helping Bokken buys practical aid and a different angle on the wilderness." },
    { id: 10, title: "Restov Courier Demands Proof", category: "kingdom", urgency: 3, hex: "A1", trigger: "A courier arrives wanting lists, witnesses, and one undeniable piece of frontier progress to carry back to Restov.", fallout: "Without evidence, the expedition sounds expensive, slow, and dangerously romantic.", consequenceSummary: "Restov wants proof that the charter has become more than a promise.", renownImpact: -1, fameImpact: -1 },
  ]
);

const HEXPLORATION_AND_RUMOR_TRAILS = createGroup(
  {
    folder: "Library / Hexploration And Rumor Trails",
    notes: "Source cue: Adventure Path hexploration, Old Sycamore rumors, Candlemere dread, and wilderness discoveries.",
  },
  [
    { id: 11, title: "Unmapped Ford After Rain", category: "travel", urgency: 3, hex: "E5", trigger: "Heavy rain turns a once-manageable crossing into a choice between delay, danger, or a costly detour.", fallout: "Pressing through can cost gear and confidence before the real encounter even begins.", consequenceSummary: "The land itself starts charging a price for careless speed." },
    { id: 12, title: "Old Sycamore Smoke at Dusk", category: "threat", urgency: 4, hex: "F5", trigger: "Thin smoke curls from the Old Sycamore when no camp should be there at all.", fallout: "If the party delays, the local factions set their own story about who moved first and why.", consequenceSummary: "A known trouble site begins shifting before the party can control the narrative." },
    { id: 13, title: "Sootscale Border Markers Moved", category: "story", urgency: 3, hex: "F4", trigger: "Stone markers near kobold territory have been dragged overnight into a more confrontational line.", fallout: "If ignored, the next meeting starts from insult instead of curiosity or leverage.", consequenceSummary: "A silent territorial signal threatens to become an avoidable diplomatic error." },
    { id: 14, title: "Lonely Barrow Dream Omen", category: "story", urgency: 2, hex: "H6", trigger: "One party member dreams of a barrow door opening to a voice that knows their charter by name.", fallout: "Treating it as nonsense may cost the party a clue that only feels supernatural until it becomes immediate.", consequenceSummary: "A dream points toward old dead things that still care about the living frontier." },
    { id: 15, title: "Candlemere Lights on Still Water", category: "threat", urgency: 4, hex: "J5", trigger: "Cold lights bloom over still water where no honest lantern should survive the wind.", fallout: "If pursued incautiously, curiosity becomes exposure to a place built to punish certainty.", consequenceSummary: "Candlemere announces itself before the party is truly ready to answer it." },
    { id: 16, title: "Forgotten Keep Scavengers Seen", category: "quest", urgency: 3, hex: "H4", trigger: "Scavengers with rope, sledges, and very bad luck start circling a ruined keep that should have been left alone.", fallout: "If ignored, they awaken trouble, spread false rumors, or die carrying useful clues into the mud.", consequenceSummary: "A ruin is about to be disturbed by people with no sense of what sleeps there." },
    { id: 17, title: "M'Botuu Hunters Shadow the Trail", category: "threat", urgency: 3, hex: "I6", trigger: "Predatory hunters use the party's camp rhythm to test how alert these newcomers really are.", fallout: "If missed, the wilderness learns that the charter party can be watched without consequence.", consequenceSummary: "Something intelligent is studying the expedition rather than simply stalking prey." },
    { id: 18, title: "Rumor Map Contradicts the Terrain", category: "travel", urgency: 2, hex: "G6", trigger: "A local sketch map points to a road, hollow, or spring that the actual land refuses to acknowledge.", fallout: "Following it blindly burns time and trust, but dismissing it may skip the hidden thing the map is really about.", consequenceSummary: "Bad cartography hides a real mystery instead of merely bad memory." },
    { id: 19, title: "Predator Sign Near a Safe Route", category: "threat", urgency: 3, hex: "E6", trigger: "Tracks, droppings, and torn brush appear on the safest known road, not out in the wild margins.", fallout: "If unanswered, the party's dependable route stops being dependable at all.", consequenceSummary: "A supposedly safe line of travel is being contested by something that hunts boldly." },
    { id: 20, title: "Friendly Hermit Gives Bad Directions", category: "story", urgency: 2, hex: "G4", trigger: "A hermit offers warm food, odd advice, and directions that are either wrong, outdated, or intentionally incomplete.", fallout: "Trusting the gift too easily wastes daylight and makes the wilderness feel smarter than the party.", consequenceSummary: "Hospitality on the frontier comes with the risk that kindness and danger are sharing a face." },
  ]
);

const CAMP_AND_WEATHER = createGroup(
  {
    folder: "Library / Camp And Weather",
    notes: "Source cue: Companion Guide camping activities and Stolen Lands weather tables.",
  },
  [
    { id: 21, title: "Campsite on Poor Ground", category: "travel", urgency: 3, hex: "E4", trigger: "The available campsite looks fine until boots sink, bedrolls tilt, and every watch rotation gets worse.", fallout: "A bad camp steals recovery, frays patience, and lowers the party's readiness before dawn trouble arrives.", consequenceSummary: "The expedition pays for taking the easy-looking campsite." },
    { id: 22, title: "Cookfire Smoke Draws Eyes", category: "threat", urgency: 3, hex: "F6", trigger: "A needed fire makes a visible column and the wrong watchers notice before the meal is even done.", fallout: "If the party stays put, they meet the next danger on terms chosen by whoever spotted them.", consequenceSummary: "Comfort at camp becomes a beacon rather than a break." },
    { id: 23, title: "Favorite Meal Opens a Companion Beat", category: "companion", urgency: 2, hex: "D5", linkedCompanion: "Linzi", trigger: "Someone cooks with care, and one companion unexpectedly lets down a layer of performance or armor.", fallout: "Passing over the moment wastes one of the Companion Guide's best low-stakes openings for influence.", consequenceSummary: "A good meal creates emotional access that combat never could." },
    { id: 24, title: "Subsistence Comes Up Short", category: "travel", urgency: 3, hex: "E7", trigger: "Foraging, hunting, or trail discipline fails just enough to make tomorrow's food a real question.", fallout: "A hungry party stops making bold choices for the right reasons.", consequenceSummary: "Logistics pressure turns small mistakes into bigger strategic caution.", foodImpact: -1 },
    { id: 25, title: "Cold Snap on Morning Watch", category: "travel", urgency: 3, hex: "D6", trigger: "The night temperature plunges between watches, leaving numb fingers and half-secured gear at the worst possible time.", fallout: "If not managed, the first challenge of the day starts with slow hands and bad tempers.", consequenceSummary: "A routine watch becomes a test of preparation and morale." },
    { id: 26, title: "Thunderstorm Splits the Column", category: "travel", urgency: 4, hex: "F7", trigger: "Rain and thunder break line of sight just long enough for mounts, scouts, or companions to drift out of safe formation.", fallout: "A divided party invites encounter trouble and delayed decision-making.", consequenceSummary: "Storm weather turns one expedition into several vulnerable pieces." },
    { id: 27, title: "River Fog Hides a Hazard", category: "travel", urgency: 3, hex: "G5", trigger: "Fog clings to the river and hides a snag, drop, ford, or waiting enemy until the party is already committed.", fallout: "The wrong movement in thick fog turns a normal crossing into a scramble.", consequenceSummary: "Low visibility converts ordinary terrain into a surprise encounter." },
    { id: 28, title: "High Winds Ruin Prepared Gear", category: "travel", urgency: 2, hex: "H5", trigger: "Winds catch tarps, maps, cook setups, and drying gear with perfect contempt for careful packing.", fallout: "If the party shrugs it off, the cost shows up later as spoiled supplies and worsened readiness.", consequenceSummary: "The weather attacks the expedition's competence rather than its hit points." },
    { id: 29, title: "Double Weather Front", category: "travel", urgency: 4, hex: "G7", trigger: "One ugly front arrives before the damage of the first has even been cleaned up.", fallout: "Assumptions about safe rest, safe roads, or safe timing stop being true all at once.", consequenceSummary: "The land applies pressure by refusing to return to normal when expected." },
    { id: 30, title: "Animal Panic Before the Storm", category: "story", urgency: 2, hex: "F8", trigger: "Game animals, birds, and even mounts react before the weather turns, as if the land knows the storm is personal.", fallout: "Ignoring the warning can cost the party one of the few chances to prepare without a hard roll.", consequenceSummary: "Nature telegraphs danger, but only to those willing to listen." },
  ]
);

const STAG_LORD_AND_EARLY_GREENBELT = createGroup(
  {
    folder: "Library / Stag Lord And Early Greenbelt Threats",
    notes: "Source cue: Thorn River bandits, Kesten pressure, Oleg's survival, and the road to the Stag Lord.",
  },
  [
    { id: 31, title: "Thorn River Scouts Shift Camp", category: "threat", urgency: 4, hex: "E4", trigger: "Bandit scouts quietly move their pickets, changing who they can hit and how quickly they can vanish.", fallout: "If the party relies on old intel, the next response lands in the wrong place.", consequenceSummary: "The bandits stop being stationary enough to solve with one bold charge." },
    { id: 32, title: "Missing Trapper on the Thorn", category: "quest", urgency: 3, hex: "E5", trigger: "A trapper fails to arrive on schedule and his route overlaps with bandit movement and hungry wildlife.", fallout: "Every day of delay narrows the rescue window and worsens local trust.", consequenceSummary: "A small missing-person job becomes a referendum on whether the charter protects anyone yet." },
    { id: 33, title: "Supply Mule Never Arrives", category: "threat", urgency: 3, hex: "D4", trigger: "A pack animal and driver vanish between safe points that should have been routine.", fallout: "Short supplies make the outpost feel mortal long before walls actually fail.", consequenceSummary: "The bandits can win simply by teaching the frontier that nothing dependable stays dependable.", foodImpact: -1, lumberImpact: -1 },
    { id: 34, title: "Stag Lord's Name Spreads Fear", category: "story", urgency: 3, hex: "F4", trigger: "The Stag Lord's title starts doing more work than his arrows as frightened locals fill in the worst possible details.", fallout: "Unchecked fear turns every minor setback into evidence that he cannot be opposed.", consequenceSummary: "Reputation becomes one of the Stag Lord's strongest weapons." },
    { id: 35, title: "Bandit Hostage Offer", category: "threat", urgency: 4, hex: "E3", trigger: "A messenger offers a clean exchange and a dirty compromise while a hostage's life buys the bandits time.", fallout: "Whatever the party chooses, the decision teaches the Greenbelt what kind of justice this charter means.", consequenceSummary: "Mercy, intimidation, and practicality all point in different directions at once." },
    { id: 36, title: "Kesten's Patience Runs Out", category: "kingdom", urgency: 4, hex: "D4", trigger: "Kesten stops asking for patience and begins pressing for direct action that prioritizes order over nuance.", fallout: "If the party cannot answer him, the military face of the charter hardens without their consent.", consequenceSummary: "Force becomes the easiest available answer, whether or not it is the best one.", unrestImpact: 1, renownImpact: -1 },
    { id: 37, title: "Trading Post Copycat Theft", category: "story", urgency: 2, hex: "D4", trigger: "Someone local imitates the bandits, stealing small and claiming the frontier has no room for honest restraint.", fallout: "If unanswered, every future crime can hide behind bandit chaos.", consequenceSummary: "Lawlessness starts becoming cultural instead of purely external." },
    { id: 38, title: "Bandit Map Fragment Recovered", category: "quest", urgency: 3, hex: "F4", trigger: "A single recovered scrap shows routes, dead drops, or hide sites, but only part of the picture.", fallout: "If mishandled, the fragment creates false confidence instead of usable strategy.", consequenceSummary: "Hard evidence opens a path to the Stag Lord but not a simple one." },
    { id: 39, title: "Night Watch Spots Creekside Fire", category: "threat", urgency: 3, hex: "E4", trigger: "A small nighttime fire burns where disciplined scouts would never allow themselves to be seen unless they wanted a reaction.", fallout: "Charging blindly makes the party predictable; ignoring it cedes the initiative.", consequenceSummary: "The frontier presents bait and asks the party what kind of hunters they really are." },
    { id: 40, title: "Borderland Refugees Bring Grim News", category: "story", urgency: 3, hex: "C4", trigger: "A handful of exhausted newcomers arrive with bad wounds, contradictory stories, and nothing left to lose.", fallout: "If dismissed, the charter gains a reputation for speeches instead of shelter.", consequenceSummary: "Human fallout reaches the party before strategic fallout is even fully visible." },
  ]
);

const TROLLS_BEASTS_AND_BLOOM = createGroup(
  {
    folder: "Library / Trolls Beasts And Bloom",
    notes: "Source cue: Troll Trouble, beast hunts, Cult of the Bloom, and Season of Bloom pressure.",
  },
  [
    { id: 41, title: "Troll Raid on Outlying Farm", category: "threat", urgency: 5, hex: "H7", trigger: "A farm on the edge of claimed land is hit hard enough that survivors stop asking for help and start asking to leave.", fallout: "If the kingdom answers too slowly, trolls teach every settlement what abandonment feels like.", consequenceSummary: "One raid becomes a test of whether the kingdom protects the people it wants to count.", unrestImpact: 1, foodImpact: -1 },
    { id: 42, title: "Hargulka Demands Recognition", category: "threat", urgency: 4, hex: "I7", trigger: "A message arrives that is half ultimatum and half royal claim from a creature who thinks the frontier is his by strength alone.", fallout: "Treating it as a joke buys time for trolls to organize instead of merely rampage.", consequenceSummary: "A monster threat takes on the shape of politics rather than simple violence." },
    { id: 43, title: "Beast of the Narlmarches Cull", category: "quest", urgency: 3, hex: "G7", trigger: "Reports of livestock kills and torn patrols cluster around one moving predator line.", fallout: "If ignored, every small holding near the forest edge starts reading the kingdom as absent.", consequenceSummary: "A hunt becomes statecraft because protected land must feel protected." },
    { id: 44, title: "Tatzlwyrm Trail Reappears", category: "threat", urgency: 3, hex: "F7", trigger: "A previously cold trail comes hot again with fresh venom signs and the wrong kind of silence around it.", fallout: "If the party does not move, the creature chooses the next victim instead.", consequenceSummary: "An old problem returns just when the frontier wanted to believe it had moved on." },
    { id: 45, title: "Fortified Ruin Hidden in the South", category: "quest", urgency: 2, hex: "J8", trigger: "Locals mention a place too defensible to ignore if hostile forces claim it first.", fallout: "Leaving it untouched invites the next chapter's enemies to decide what the ruin is for.", consequenceSummary: "A strategic site exists in limbo until someone stronger gives it meaning." },
    { id: 46, title: "Bloom-Touched Hunter Collapses", category: "story", urgency: 4, hex: "G8", trigger: "A competent hunter returns feverish, floral, and wrong in ways mundane healing does not quite solve.", fallout: "If dismissed as sickness alone, the kingdom misses the first soft signs of Bloom corruption.", consequenceSummary: "The Season of Bloom announces itself in bodies before it announces itself in doctrine." },
    { id: 47, title: "Cult Seed Cache Found", category: "threat", urgency: 4, hex: "H8", trigger: "A buried cache of prepared seeds, ritual scraps, and coded notes turns one odd clue into a network.", fallout: "If mishandled, the cult learns it was discovered and changes tempo before the party can trace it.", consequenceSummary: "What looked like isolated strangeness is actually organized preparation." },
    { id: 48, title: "Sudden Riot of Emotion", category: "story", urgency: 4, hex: "G6", trigger: "A crowd turns from ordinary disagreement to frightening collective frenzy without any proportional cause.", fallout: "If the party solves only the surface fight, the deeper Bloom pressure remains free to spread.", consequenceSummary: "The kingdom experiences the emotional contagion of the Bloom before understanding its source.", unrestImpact: 1 },
    { id: 49, title: "Lamashtan Omen in the Fields", category: "threat", urgency: 3, hex: "I8", trigger: "The sort of omen that peasants remember for generations appears in worked land that should have felt safe.", fallout: "If left unexplained, fear does more damage than the omen itself.", consequenceSummary: "Faith, superstition, and monstrous influence all pull the same people at once." },
    { id: 50, title: "Cradle of Lamashtu Whisper Network", category: "story", urgency: 4, hex: "J7", trigger: "Low-voiced invitations and furtive meetings show that the cult has learned to recruit through grievance rather than spectacle.", fallout: "A kingdom that only hunts open monsters misses the human doors the Bloom is using.", consequenceSummary: "The cult spreads because it offers belonging before it demands devotion." },
  ]
);

const VARNHOLD_AND_EASTERN_FRONTIER = createGroup(
  {
    folder: "Library / Varnhold And Eastern Frontier",
    notes: "Source cue: Varnhold Vanishing, Nomen centaurs, Vordakai, and the widening eastern frontier mystery.",
  },
  [
    { id: 51, title: "Missing Couriers from Varnhold", category: "story", urgency: 4, hex: "J6", trigger: "Couriers expected from Varnhold simply stop arriving, and the silence lasts long enough to become suspicious.", fallout: "If the kingdom waits for certainty, certainty arrives as absence rather than information.", consequenceSummary: "Trade silence becomes the first clue that Varnhold is no longer functioning normally." },
    { id: 52, title: "Gundarson's Treasure Clue Surfaces", category: "quest", urgency: 2, hex: "I6", trigger: "A half-believable clue points toward lost wealth, buried routes, and exactly the sort of bait ambitious explorers love.", fallout: "Chasing it carelessly can hand the real threat an easier set of victims.", consequenceSummary: "Treasure gossip drags people toward the same mystery that is already swallowing them." },
    { id: 53, title: "Silent Farmstead on the Frontier", category: "story", urgency: 4, hex: "J7", trigger: "A farmstead stands intact with chores unfinished, doors open, and no people where people should be.", fallout: "If the party cannot explain it, every isolated household starts feeling one mile away from being next.", consequenceSummary: "The eastern mystery feels wrong because nothing obvious is broken except the absence of human life." },
    { id: 54, title: "Nomen Scout Demands Respect", category: "story", urgency: 3, hex: "K6", trigger: "A centaur scout makes it clear that trespass and diplomacy are now separated only by the party's next sentence.", fallout: "A foolish answer closes doors that should stay open until Vordakai is understood.", consequenceSummary: "The frontier introduces a proud culture that will not tolerate being treated as scenery." },
    { id: 55, title: "Centaur Warning at Dawn", category: "quest", urgency: 3, hex: "K7", trigger: "A Nomen warning arrives just early enough to matter and just vague enough to demand trust.", fallout: "If the party ignores it, they prove they value control more than local wisdom.", consequenceSummary: "An offered warning becomes a test of cultural humility." },
    { id: 56, title: "Ancient Tablet Translation Error", category: "story", urgency: 2, hex: "J8", trigger: "A half-correct translation points the party toward the right history through the wrong assumptions.", fallout: "If nobody revisits the meaning, false confidence makes the tomb problem harder instead of easier.", consequenceSummary: "The past can mislead even when it is technically being read correctly." },
    { id: 57, title: "Vordakai Dream Intrusion", category: "threat", urgency: 4, hex: "L8", trigger: "Someone dreams with the distinct sense that another mind is testing their fear, memory, and boundaries.", fallout: "Shrugging it off leaves psychic pressure free to intensify before anyone raises proper defenses.", consequenceSummary: "The tomb reaches outward before the party reaches inward." },
    { id: 58, title: "Varnhold Trade Caravan Never Returns", category: "kingdom", urgency: 4, hex: "J6", trigger: "A caravan that should have linked two frontier powers simply disappears from the shared map.", fallout: "If the kingdom cannot answer what happened, markets price in fear and distance immediately.", consequenceSummary: "Trade becomes the first institution to acknowledge the eastern crisis.", rpImpact: -1, unrestImpact: 1 },
    { id: 59, title: "Border Families Panic Over Vanishing", category: "kingdom", urgency: 4, hex: "J7", trigger: "Families near the eastern edge start packing as stories of unexplained disappearances outrun official information.", fallout: "If the kingdom cannot reassure them, abandonment becomes rational.", consequenceSummary: "Fear of vanishing people begins to reshape settlement behavior.", unrestImpact: 1, renownImpact: -1 },
    { id: 60, title: "Tomb Approach Left Unguarded", category: "quest", urgency: 3, hex: "L9", trigger: "A dangerous approach to an ancient site remains strangely unclaimed, as if whatever dwells beyond does not fear intruders yet.", fallout: "Delay gives the site time to set its own conditions for the final approach.", consequenceSummary: "An open road to the tomb is itself a warning sign, not a gift." },
  ]
);

const DRELEV_TIGER_LORDS_AND_PITAX = createGroup(
  {
    folder: "Library / Drelev Tiger Lords And Pitax",
    notes: "Source cue: Blood for Blood, Drelev, Tiger Lords, Armag, Pitax, and the turn toward interstate conflict.",
  },
  [
    { id: 61, title: "Drelev Refugees Beg Asylum", category: "kingdom", urgency: 4, hex: "K5", trigger: "Refugees arrive asking not for charity but for a place beyond the reach of Drelev's failures.", fallout: "Turning them away protects short-term stores but harms legitimacy and future alliances.", consequenceSummary: "The kingdom is asked whether its borders stand for anything larger than convenience.", unrestImpact: 1, renownImpact: 1, foodImpact: -1 },
    { id: 62, title: "Hooktongue Raid Leaves Trophies", category: "threat", urgency: 4, hex: "K6", trigger: "A raid leaves deliberate trophies behind, signaling that the violence was meant to send a message as much as seize goods.", fallout: "If the kingdom does not answer the symbolism, fear outruns the actual material damage.", consequenceSummary: "The enemy is waging psychological war, not merely border violence." },
    { id: 63, title: "Sacred Barrow Desecration", category: "story", urgency: 3, hex: "K7", trigger: "A burial place important to local allies is defiled in a way that demands either redress or disgrace.", fallout: "Failure to answer it teaches allies that the kingdom values peace over honor.", consequenceSummary: "The frontier war becomes spiritual and cultural rather than purely territorial." },
    { id: 64, title: "Tiger Lord Challenge Ride", category: "quest", urgency: 3, hex: "L6", trigger: "A mounted challenge is issued in a form that treats refusal as weakness and acceptance as risk.", fallout: "However the party responds, the Tiger Lords will build a story around the choice.", consequenceSummary: "Prestige combat and political signaling merge into one dangerous invitation." },
    { id: 65, title: "Armag's Prophecy Recruiters Arrive", category: "threat", urgency: 4, hex: "L7", trigger: "Hard-eyed riders start collecting the angry, the displaced, and the glory-hungry under a prophetic banner.", fallout: "If unopposed, Armag's myth grows faster than his actual armies.", consequenceSummary: "A war leader begins winning before battle through recruitment and legend." },
    { id: 66, title: "Pitaxian Envoy Offers Poisoned Peace", category: "kingdom", urgency: 3, hex: "J4", trigger: "A cultured envoy offers terms so reasonable on the surface that only a paranoid ruler would refuse them.", fallout: "Accepting blindly gives Pitax leverage; refusing clumsily makes the kingdom look belligerent.", consequenceSummary: "Pitax turns diplomacy into a trap designed to stain either answer.", renownImpact: -1, infamyImpact: 1 },
    { id: 67, title: "Fort Drelev Double Agent", category: "story", urgency: 3, hex: "K5", trigger: "An informant offers help that is either extraordinarily brave or exquisitely false.", fallout: "Trusting the wrong source can cost lives and strategic surprise in equal measure.", consequenceSummary: "Information from Drelev is valuable precisely because it may be poisoned." },
    { id: 68, title: "Smugglers Flying Pitax Colors", category: "threat", urgency: 3, hex: "J5", trigger: "River smugglers start using Pitax colors and courtly credentials to blur the line between crime and policy.", fallout: "If the kingdom cannot separate them, trade law and foreign relations become tangled together.", consequenceSummary: "Pitax pressure arrives disguised as commerce and plausible deniability." },
    { id: 69, title: "Border Tollhouse Sabotage", category: "kingdom", urgency: 3, hex: "J6", trigger: "A useful chokepoint is sabotaged just enough to cause pain without enough evidence to point cleanly at the culprit.", fallout: "Merchants blame weakness first and facts later.", consequenceSummary: "Infrastructure becomes the battlefield before armies do.", rpImpact: -1, unrestImpact: 1, stoneImpact: -1 },
    { id: 70, title: "Rushlight Invitation With Teeth", category: "story", urgency: 3, hex: "J4", trigger: "A formal invitation arrives wrapped in prestige, audience pressure, and every assumption that the kingdom must perform under hostile eyes.", fallout: "If the invitation is ignored, Pitax writes the story first; if accepted carelessly, Pitax still writes it first.", consequenceSummary: "Public spectacle becomes a front in the war for legitimacy." },
  ]
);

const RIVER_KINGS_FIRST_WORLD_AND_ENDGAME = createGroup(
  {
    folder: "Library / River Kings First World And Endgame",
    notes: "Source cue: Sound of a Thousand Screams, First World breaches, Pitax fallout, and Nyrissa-facing late-campaign pressure.",
  },
  [
    { id: 71, title: "Behind Enemy Lines Messenger", category: "story", urgency: 3, hex: "I4", trigger: "A courier reaches the party from hostile ground with information that matters only if acted on quickly.", fallout: "If delayed, the message becomes a sad explanation instead of a meaningful opportunity.", consequenceSummary: "Timing matters more than certainty when the kingdom is already inside the larger war." },
    { id: 72, title: "Ghost of Whiterose Demands Redress", category: "story", urgency: 3, hex: "H4", trigger: "A dead voice tied to ruined nobility refuses to stay quiet until an old wrong is acknowledged properly.", fallout: "Ignoring the haunting invites a feud with memory itself, not just one spirit.", consequenceSummary: "The campaign's political dead insist on being part of the ending." },
    { id: 73, title: "Palace Informant Requests Extraction", category: "quest", urgency: 4, hex: "J4", trigger: "Someone close enough to dangerous power offers information only if the kingdom can get them out alive.", fallout: "Hesitation burns the informant and the knowledge together.", consequenceSummary: "Court intrigue finally asks for fieldwork rather than clever talk." },
    { id: 74, title: "Thousandbreaths Map Fragment Appears", category: "quest", urgency: 2, hex: "I5", trigger: "A fragment tied to an old monster-haunted forest route surfaces in the hands of someone who does not know its worth.", fallout: "If lost, the party gives away one of the cleanest paths into a late-campaign secret.", consequenceSummary: "A small scrap points toward a place where legends are still ecological facts." },
    { id: 75, title: "First World Breach in Farmland", category: "threat", urgency: 5, hex: "H5", trigger: "Reality slips in cultivated land, turning ordinary fields into something beautiful, wrong, and impossible to harvest safely.", fallout: "If unanswered, the people living there stop trusting the kingdom to define what is normal.", consequenceSummary: "The First World invades not as an army, but as reality erosion.", foodImpact: -1, unrestImpact: 1 },
    { id: 76, title: "Bloom-Touched Beast Returns", category: "threat", urgency: 4, hex: "G8", trigger: "A creature once thought solved returns altered by later magic, proving earlier victories were only partial.", fallout: "Old solutions fail publicly and shake confidence in the kingdom's memory.", consequenceSummary: "Past threats re-enter the story transformed by later supernatural pressure." },
    { id: 77, title: "Jabberwock Sign at the Tree Line", category: "threat", urgency: 5, hex: "I7", trigger: "The landscape carries impossible damage that only makes sense if something legendary has already passed through.", fallout: "If the signs are ignored, the next sighting happens where civilians can witness it first.", consequenceSummary: "A nursery terror becomes a state problem the instant its tracks are real." },
    { id: 78, title: "Belinda Houten Wants Her Legacy", category: "story", urgency: 3, hex: "J4", trigger: "Belinda Houten or her legacy returns to demand that past ambition be judged in present political terms.", fallout: "If mishandled, old loyalties complicate already fragile alliances.", consequenceSummary: "A prior claimant to meaning in the River Kingdoms re-enters the campaign's moral ledger." },
    { id: 79, title: "Broken Apology Dream", category: "story", urgency: 3, hex: "H6", trigger: "A dream offers sorrow, blame, and almost-forgiveness without making any of them easy to trust.", fallout: "Ignoring it throws away a chance to understand the emotional logic behind the campaign's deepest grievance.", consequenceSummary: "The story's central wound starts speaking in symbols before it fully speaks in words." },
    { id: 80, title: "Lantern King Mockery in Public", category: "kingdom", urgency: 4, hex: "H5", trigger: "Public reality twists into embarrassing, dangerous mockery that targets the kingdom's dignity as much as its safety.", fallout: "If the rulers cannot answer with poise and force, ridicule becomes a political weapon.", consequenceSummary: "The Lantern King attacks morale and legitimacy through spectacle.", unrestImpact: 1, renownImpact: -1, fameImpact: -1 },
  ]
);

const COMPANION_BEATS = createGroup(
  {
    folder: "Library / Companion Beats",
    notes: "Source cue: Companion Guide relationship pressure, influence scenes, travel friction, and personal quests.",
  },
  [
    { id: 81, title: "Amiri Demands a Worthy Hunt", category: "companion", urgency: 3, hex: "G6", linkedCompanion: "Amiri", trigger: "Amiri grows restless with politics and wants proof the frontier still respects strength more than titles.", fallout: "If ignored, her influence scenes flatten into impatience instead of honest investment.", consequenceSummary: "A hunt becomes a referendum on what the kingdom values." },
    { id: 82, title: "Ekundayo Spots Familiar Tracks", category: "companion", urgency: 3, hex: "H7", linkedCompanion: "Ekundayo", trigger: "Tracks in mud or ash pull Ekundayo abruptly from steady professionalism into focused personal danger.", fallout: "If the party misses the emotional weight, they lose a chance to deepen trust through action.", consequenceSummary: "The wilderness opens an old wound that only pursuit can answer." },
    { id: 83, title: "Jubilost Wants Proof, Not Legends", category: "companion", urgency: 2, hex: "F5", linkedCompanion: "Jubilost", trigger: "Jubilost insists the party stop speaking in wonder long enough to gather actual evidence worth preserving.", fallout: "If dismissed, his skepticism curdles into disengagement instead of useful friction.", consequenceSummary: "A companion scene pivots on whether truth or excitement leads the expedition." },
    { id: 84, title: "Linzi Reframes Disaster as Story", category: "companion", urgency: 2, hex: "D4", linkedCompanion: "Linzi", trigger: "After a rough setback, Linzi tries to save morale by turning failure into narrative momentum.", fallout: "If the party snaps at her, they lose one of their best tools for converting fear into shared purpose.", consequenceSummary: "Morale rises or falls on whether the group lets a bard make meaning out of pain." },
    { id: 85, title: "Nok-Nok Wants a Heroic Stage", category: "companion", urgency: 2, hex: "G5", linkedCompanion: "Nok-Nok", trigger: "Nok-Nok wants a situation big enough to prove he is not a joke and dangerous enough to prove why that matters.", fallout: "If denied repeatedly, he creates his own stage at the worst possible time.", consequenceSummary: "Comic energy asks to become mythic energy before it turns destructive." },
    { id: 86, title: "Tristian Sees an Ill Omen", category: "companion", urgency: 3, hex: "E6", linkedCompanion: "Tristian", trigger: "Tristian reads a sign as genuinely holy, and his calm certainty makes everyone else more uneasy instead of less.", fallout: "If the party blows it off, they train him not to share the warnings that matter most.", consequenceSummary: "Faith becomes operational rather than decorative." },
    { id: 87, title: "Valerie Rejects a Dishonorable Offer", category: "companion", urgency: 3, hex: "D5", linkedCompanion: "Valerie", trigger: "Someone offers Valerie status, leverage, or tactical ease at the cost of a principle she refuses to bend.", fallout: "If the party pushes pragmatism too hard, they force the relationship into a colder shape.", consequenceSummary: "Honor is tested in a way that exposes what the kingdom expects from its people." },
    { id: 88, title: "Harrim and Jaethal Read Different Omens", category: "companion", urgency: 2, hex: "F6", linkedCompanion: "Harrim", trigger: "The same strange sign gives Harrim and Jaethal opposite conclusions, both unsettling in different directions.", fallout: "Ignoring the disagreement wastes a chance to use ideology as roleplay pressure rather than simple conflict.", consequenceSummary: "Two grim worldviews collide over what the frontier is actually becoming." },
    { id: 89, title: "Kalikke and Kanerah Want Opposite Solutions", category: "companion", urgency: 3, hex: "E7", linkedCompanion: "Kalikke", trigger: "One problem invites compassion and opportunism at the same time, and the sisters separate the two into competing plans.", fallout: "If the party dodges the tension, the twins conclude the rulers want their gifts without understanding their lives.", consequenceSummary: "A single event forces the group to pick what kind of cleverness it rewards." },
    { id: 90, title: "Octavia and Regongar Smell a Slaver's Chain", category: "companion", urgency: 4, hex: "F7", linkedCompanion: "Octavia", trigger: "Something in a camp, caravan, or noble entourage sets off memories of bondage and violently different instincts about response.", fallout: "If the rulers hesitate too long, the companions act on their own terms.", consequenceSummary: "Past captivity turns a normal investigation into an emotional detonation point." },
  ]
);

const KINGDOM_TURNS_AND_CIVIC_PRESSURE = createGroup(
  {
    folder: "Library / Kingdom Turns And Civic Pressure",
    category: "kingdom",
    notes: "Source cue: Player's Guide kingdom event cadence, Kingdom Tracker event sheets, and the civic loops of running a PF2e kingdom.",
  },
  [
    { id: 91, title: "Tax Dispute at Market Day", urgency: 3, hex: "D4", trigger: "Merchants and settlers openly disagree over who should carry the first serious tax burden of a growing realm.", fallout: "A clumsy ruling feeds resentment faster than the treasury grows.", consequenceSummary: "The kingdom has to decide whether fairness means equal pain or strategic pain.", rpImpact: 1, unrestImpact: 1 },
    { id: 92, title: "Granary Spoilage Scandal", urgency: 4, hex: "E4", trigger: "Spoiled stores reveal either negligence, sabotage, or a supply officer too proud to admit the warning signs.", fallout: "If nobody owns the failure quickly, hunger and rumor fuse into political poison.", consequenceSummary: "Food security becomes a test of competence rather than abundance.", foodImpact: -2, unrestImpact: 1 },
    { id: 93, title: "Missing Lumber Shipment", urgency: 3, hex: "F4", trigger: "A needed lumber shipment fails to reach a build site that was already promised to the public.", fallout: "The missed delivery weakens both construction schedules and faith in official promises.", consequenceSummary: "Infrastructure delays start becoming political rather than merely logistical.", lumberImpact: -2, renownImpact: -1 },
    { id: 94, title: "Stone Wall Petition", urgency: 2, hex: "E5", trigger: "Settlers petition for more visible fortification, arguing that feeling defended matters almost as much as being defended.", fallout: "Ignoring them saves resources but tells vulnerable citizens to interpret every shadow alone.", consequenceSummary: "Security spending becomes a public trust question.", stoneImpact: -1, renownImpact: 1 },
    { id: 95, title: "Trade Route Opportunity", urgency: 2, hex: "F5", trigger: "A new route opens if the kingdom is willing to commit escorts, repairs, and political attention quickly.", fallout: "Delay lets a rival claim the profit and the narrative of initiative.", consequenceSummary: "Growth arrives as an opportunity window rather than a certainty.", rpImpact: 2, fameImpact: 1 },
    { id: 96, title: "Noble Patron Wants a Monument", urgency: 2, hex: "D4", trigger: "A patron offers funding that is generous in coin and dangerous in symbolism, because the monument would define what the kingdom publicly honors.", fallout: "Accepting carelessly creates a lasting stone argument about whose story owns the realm.", consequenceSummary: "Public art becomes a constitutional choice disguised as a gift.", rpImpact: 1, renownImpact: 1, infamyImpact: 1 },
    { id: 97, title: "University Scholars Request Funding", urgency: 2, hex: "E6", trigger: "Scholars want support for surveys, archives, and dangerous field research that could raise prestige or stir sleeping problems.", fallout: "Refusing them narrows the kingdom's future; funding them blindly may import trouble with the books.", consequenceSummary: "Knowledge asks the kingdom whether it wants to be merely stable or genuinely significant.", rpImpact: -1, fameImpact: 1 },
    { id: 98, title: "Border Charter Dispute", urgency: 4, hex: "F6", trigger: "Old promises, vague maps, and ambitious neighbors collide over who may lawfully hold the next useful stretch of land.", fallout: "A poor ruling can create enemies faster than a war does because it looks civilized while breeding grievance.", consequenceSummary: "Legitimacy at the border depends on law, force, and story aligning at once.", renownImpact: -1, infamyImpact: 1 },
    { id: 99, title: "Mercenary Drill Ends in Brawl", urgency: 3, hex: "E7", trigger: "A training exercise spills into an ugly brawl that exposes tension between discipline, pay, and local resentment.", fallout: "If the kingdom answers too harshly, it breeds desertion; too softly, it breeds contempt.", consequenceSummary: "The state learns whether its monopoly on force is respected or merely tolerated.", unrestImpact: 1, strifeImpact: 1 },
    { id: 100, title: "Harvest Festival Builds or Burns Trust", urgency: 3, hex: "D5", trigger: "A seasonal celebration creates a rare public stage where generosity, exclusion, security, and culture all become visible at once.", fallout: "A bad festival lingers in memory longer than a well-run policy memo ever could.", consequenceSummary: "A civic celebration decides whether the people feel like subjects, neighbors, or founders.", renownImpact: 1, fameImpact: 1, unrestImpact: -1 },
  ]
);

export const KINGMAKER_EVENT_LIBRARY = Object.freeze([
  ...STARTER_EVENTS,
  ...CHARTER_AND_OPENING_PRESSURE,
  ...HEXPLORATION_AND_RUMOR_TRAILS,
  ...CAMP_AND_WEATHER,
  ...STAG_LORD_AND_EARLY_GREENBELT,
  ...TROLLS_BEASTS_AND_BLOOM,
  ...VARNHOLD_AND_EASTERN_FRONTIER,
  ...DRELEV_TIGER_LORDS_AND_PITAX,
  ...RIVER_KINGS_FIRST_WORLD_AND_ENDGAME,
  ...COMPANION_BEATS,
  ...KINGDOM_TURNS_AND_CIVIC_PRESSURE,
]);
