// The factions, and what their ports are called.
//
// [HC-39] A nation stores only three things: a treasury, its relations, and its
//         seat. Its holdings are DERIVED — every place stores its own faction,
//         so a nation's territory is a query, never a duplicated list.
// [HC-42] Character is fixed per crown and never drifts. It is configuration,
//         not state, so it lives in the table and not on the struct.
// [HC-51] A neutral faction takes no strategic action and dispatches nothing.
//         No treasury, no navy, no charters, no invasions, no expansion. The
//         neutral set is FIXED AT GENERATION, so the neutral share of the map
//         can only shrink.
// [HC-90] Five crowns, configured not generated. The generator decides only who
//         holds what on day one — so the identities are a table.
//
// WHAT IS NOT HERE: nations ACTING. No auction, no war, no peace, no dispatch,
// no relations. That is KAN-101 and KAN-105. This file is the cast list and the
// day-0 state, and the generator's whole job with it is to decide who holds what.

import { CHANNEL, rollOf } from "./chance";

// ---- The cast ([HC-91]: the type comes from the table) ---------------------
//
// `crown: true` is the whole of the difference that matters to the simulation: a
// crown taxes, dispatches and decides; a neutral does none of those things and
// therefore has no treasury and no seat. The `character` line is what [HC-42]
// fixes — recorded now so the auction that reads it later cannot quietly invent
// a different Spain.

export interface Faction {
  name: string; // how it reads in a sentence
  crown: boolean;
  character: string; // fixed, and never drifts
  opening: number; // day-0 treasury. Zero for a neutral — it has none.
  pool: PoolId;
}

export const FACTIONS = {
  spain: {
    name: "Spain", crown: true, opening: 9000, pool: "spanish",
    character: "holds what it has and fortifies it; slow to move, ruinous to cross",
  },
  england: {
    name: "England", crown: true, opening: 6000, pool: "english",
    character: "chases revenue, licenses its own pirates, and calls it policy",
  },
  france: {
    name: "France", crown: true, opening: 7000, pool: "french",
    character: "spends on prestige before profit; will fight for a name",
  },
  netherlands: {
    name: "the Netherlands", crown: true, opening: 8000, pool: "dutch",
    character: "trades with everyone, garrisons nothing it can insure instead",
  },
  portugal: {
    name: "Portugal", crown: true, opening: 5000, pool: "portuguese",
    character: "old reach, thin purse; defends the route rather than the ground",
  },
  brethren: {
    name: "the Brethren of the Coast", crown: false, opening: 0, pool: "haven",
    character: "no flag, no plans, and no reason to expand",
  },
  order: {
    name: "the Order of Saint Ursin", crown: false, opening: 0, pool: "abbey",
    character: "keeps a bell ringing and asks nothing of the sea",
  },
  maroons: {
    name: "the Free Camps", crown: false, opening: 0, pool: "camp",
    character: "wants to be left alone, and is armed about it",
  },
} as const satisfies Record<string, Faction>;

export type FactionId = keyof typeof FACTIONS;
export const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];
export const CROWN_IDS = FACTION_IDS.filter((f) => FACTIONS[f].crown);
export const NEUTRAL_IDS = FACTION_IDS.filter((f) => !FACTIONS[f].crown);

// ---- The name pools --------------------------------------------------------
//
// "The sea is invented every game — new coastlines, place names from per-nation
// name pools, five real crowns — and no real port is on it." So every root below
// is invented: it should read like a port a Spaniard or a Dutchman would have
// named, and be findable on no chart.
//
// A name is a head, a root and a tail, any of which may be absent. Three small
// lists per nation give a few thousand names, which is ample for fifty ports and
// keeps the content a table rather than a generator.

interface Pool {
  heads: readonly string[]; // "" means the root stands alone
  roots: readonly string[];
  tails: readonly string[];
  given: readonly string[]; // ...and the people who run the place
  family: readonly string[];
  titles: readonly string[];
}

export const NAME_POOLS = {
  spanish: {
    heads: ["", "", "Puerto", "Villa", "San", "Santa", "Bahía de", "Punta", "Nueva"],
    roots: ["Alcarón", "Bermeja", "Cardenal", "Corvina", "Escudo", "Galeón", "Herrera", "Loredo",
      "Maravilla", "Negrete", "Obispo", "Palancar", "Quejo", "Ravira", "Salinas", "Tordera",
      "Ulloa", "Verdugo", "Zarza", "Cabrillo", "Mirasol", "Peñasco", "Tibura", "Almadraba"],
    tails: ["", "", "", "el Viejo", "de Oro", "del Rey", "la Baja", "de los Muertos"],
    given: ["Don Alonso", "Don Íñigo", "Don Rodrigo", "Doña Beatriz", "Don Pedro", "Don Sancho"],
    family: ["Sarmiento", "Villalobos", "Ordoñez", "Peraza", "Quiñones", "Mendaña", "Barrasa"],
    titles: ["Governor", "Alcalde", "Castellan"],
  },
  english: {
    heads: ["", "", "Port", "New", "Saint", "Great", "Little"],
    roots: ["Ashcombe", "Bellhaven", "Cobbet", "Drayton", "Elsmere", "Fenwick", "Gorsely", "Harlow",
      "Ilminster", "Kettleby", "Loxley", "Marlowe", "Netherby", "Orwell", "Pemberton", "Quarles",
      "Redgrave", "Stanhope", "Thurloe", "Westhaven", "Yarrow", "Bramble", "Crowmarsh", "Dunwich"],
    tails: ["", "", "", "Bay", "Point", "Reach", "Hundred", "Landing"],
    given: ["Colonel", "Mr", "Captain", "Sir Henry", "Sir Thomas", "Alderman"],
    family: ["Fairbourne", "Wrexall", "Godolph", "Tresham", "Beckwith", "Swinnerton", "Halloway"],
    titles: ["Governor", "Deputy Governor", "Lieutenant Governor"],
  },
  french: {
    heads: ["", "", "Port-", "Saint-", "Anse-", "Baie de", "Petit-", "Grand-"],
    roots: ["Ancenis", "Bellefeuille", "Carnavelle", "Dauvray", "Estournel", "Frémont", "Gervaise",
      "Hauteville", "Joubert", "Lascour", "Montfort", "Noireau", "Ormeaux", "Pontcharde",
      "Quilleboeuf", "Rocheclair", "Sanguinet", "Thouars", "Vaudreuil", "Malmaison", "Cassard"],
    tails: ["", "", "", "le Vieux", "des Sables", "du Roi", "la Belle"],
    given: ["Monsieur", "le Sieur", "le Chevalier", "Madame", "Capitaine"],
    family: ["d'Ogeron", "de Cussy", "Ravenel", "Beauchamp", "du Casse", "Lavalette", "Poincy"],
    titles: ["Governor", "Lieutenant du Roi", "Intendant"],
  },
  dutch: {
    heads: ["", "", "Nieuw", "Fort", "Oost", "West"],
    roots: ["Aardenburg", "Bosveld", "Duinkerk", "Eemshoek", "Grietzand", "Hoogendam", "Kalkhaven",
      "Loosbeek", "Meerdijk", "Noordwijck", "Oostzand", "Prinsenhoek", "Rietvliet", "Slootkerk",
      "Terwiel", "Vlaardam", "Wolvenhoek", "Zoutkreek", "Ankersloot", "Bruinstrand"],
    tails: ["", "", "", "aan Zee", "de Kleine", "Reede"],
    given: ["Heer", "Commandeur", "Vrouwe", "Schipper"],
    family: ["van Ruyter", "Beeckman", "van Hoorn", "Stuyver", "de Graaff", "Coenraets", "Vinckboons"],
    titles: ["Governor", "Commandeur", "Opperhoofd"],
  },
  portuguese: {
    heads: ["", "", "Porto", "Vila", "Praia de", "São"],
    roots: ["Alcobrim", "Braganço", "Cabreira", "Douradinha", "Estremoro", "Faroleira", "Guimar",
      "Louriçal", "Mirandela", "Nazareira", "Ouriva", "Penichal", "Quintela", "Ribamar",
      "Sabugal", "Tavirinha", "Valverde", "Almadena", "Carrasqueira"],
    tails: ["", "", "", "Velho", "do Mar", "Novo"],
    given: ["Dom Fernão", "Dom Luís", "Dona Inês", "Capitão"],
    family: ["de Almeida", "Coutinho", "Vasconcelos", "Meireles", "Sequeira", "Tavares"],
    titles: ["Governor", "Capitão-mor", "Feitor"],
  },
  haven: {
    heads: ["", "", "", "Old", "Devil's"],
    roots: ["Gallows", "Cutthroat", "Rum", "Bones", "Widow's", "Hangman's", "Powder", "Dead Man's",
      "Thief's", "Blackwater", "Sharkbait", "Nogood", "Careen", "Slaughter"],
    tails: ["Bay", "Cay", "Cove", "Hole", "Key", "Reach", "Landing", "Point"],
    given: ["Quartermaster", "Captain", "Old", "One-Eyed"],
    family: ["Roche", "Bellamy", "Dupree", "Crane", "Vane", "Teach-that-was", "Meg"],
    titles: ["Quartermaster", "Captain of the Coast", "the Council"],
  },
  abbey: {
    heads: ["", "Priory of", "Abbey of", "Our Lady of"],
    roots: ["Saint Ursin", "Saint Cleve", "Saint Brendal", "the Reef", "the Wreck", "Sorrows",
      "the Lamp", "Saint Aveline", "the Quiet Water"],
    tails: ["", "", "", "on the Rock", "by the Sea"],
    given: ["Prior", "Abbot", "Brother", "Mother"],
    family: ["Anselm", "Cadoc", "Ignatius", "Perpetua", "Odile", "Fulbert"],
    titles: ["Prior", "Abbot", "Keeper of the Lamp"],
  },
  camp: {
    heads: ["", "", "the", "High"],
    roots: ["Freeman's", "Cudjoe's", "Nanny's", "Ironwood", "Hidden", "Palenque", "Longwater",
      "Ashanti", "Manjack", "Cockpit"],
    tails: ["Town", "Ground", "Camp", "Hollow", "Rise", "Water"],
    given: ["Colonel", "Captain", "Elder", "Mother"],
    family: ["Cudjoe", "Quao", "Accompong", "Nanny", "Tacky", "Bogle"],
    titles: ["Colonel", "Elder", "Speaker"],
  },
} as const satisfies Record<string, Pool>;

export type PoolId = keyof typeof NAME_POOLS;

// ---- Generating a name -----------------------------------------------------

const SLOT = { name: 5000, governor: 5600 } as const;

const pickOf = <T,>(xs: readonly T[], r: number): T => xs[Math.floor(r * xs.length)];

// A place's name, on its `attempt`-th try. The attempt index is how a collision
// is resolved, and the resolution is deliberately BACKWARD-LOOKING only: a place
// is renamed because an EARLIER place already had that name, never because of a
// later one. So adding a fifty-first port cannot rename the first fifty
// ([HC-10]'s guarantee, in the one place in the generator that is not a pure
// per-place function).
export function nameFor(seed: number, pool: PoolId, placeId: number, attempt: number): string {
  const p = NAME_POOLS[pool];
  const roll = (attr: number) => rollOf(seed, CHANNEL.worldgen, SLOT.name + placeId, attempt * 8 + attr);
  const head = pickOf(p.heads, roll(0));
  const root = pickOf(p.roots, roll(1));
  const tail = pickOf(p.tails, roll(2));
  const joined = head.endsWith("-") ? head + root : [head, root, tail].filter((s) => s.length > 0).join(" ");
  return head.endsWith("-") && tail.length > 0 ? `${joined} ${tail}` : joined;
}

// Who runs the place. A title, a given name and a family name from the holder's
// own pool, so a Dutch port is run by a Dutchman and a haven by a quartermaster.
export function governorFor(seed: number, pool: PoolId, placeId: number): string {
  const p = NAME_POOLS[pool];
  const roll = (attr: number) => rollOf(seed, CHANNEL.worldgen, SLOT.governor + placeId, attr);
  const given = pickOf(p.given, roll(0));
  const family = pickOf(p.family, roll(1));
  return `${given} ${family}`;
}

// ---- The nations, at day 0 -------------------------------------------------

export interface Nation {
  id: number; // index into world.nations
  faction: FactionId;
  crown: boolean;
  // [HC-39]: its seat. A crown's dispatches sail from here, which is what makes
  // neglect of far colonies emergent rather than scripted. A neutral has none.
  seat: number; // place id, or -1
  // [HC-40] A real stock, and it can be empty. A broke crown stops paying, and
  // everything interesting follows from that. Nothing spends it yet (KAN-101).
  treasury: number;
}

// One factory, every field present, same order ([P-26]).
export const makeNations = (): Nation[] =>
  FACTION_IDS.map((f, i) => ({
    id: i,
    faction: f,
    crown: FACTIONS[f].crown,
    seat: -1,
    treasury: FACTIONS[f].opening,
  }));

// [HC-39]: holdings are a QUERY, never a stored list. Kept here so nothing is
// tempted to cache it.
export const holdingsOf = <T extends { faction: number }>(places: T[], nation: number): T[] =>
  places.filter((p) => p.faction === nation);
