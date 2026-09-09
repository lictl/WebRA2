// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Explicit still-image policy; see docs/object-art.md.
import type { ProfileId } from '../../contracts/src/index.ts';
import type { RuntimeIni, IniOrigin } from './runtime-ini.ts';
import { createIniSourceView, findIniSourceSections, findIniSourceEntries, INI_SOURCE_VIEW_POLICY } from './ini-source-view.ts';
import { assembleScenarioDefinitions, SCENARIO_CONSTRUCTION_POLICY } from './scenario-construction.ts';
import type { PlacementKind, ScenarioObjects } from './scenario-objects.ts';
import type { TileTheater } from './theater-tiles.ts';

export const OBJECT_ART_POLICY = 'webra2-object-still-2' as const;
export const OBJECT_ART_LIMITS = Object.freeze({ placements: 32768, types: 2048, fields: 262144,
  work: 4_194_304, nodes: 3_000_000, characters: 96 * 1024 * 1024 });
type Limits = { -readonly [K in keyof typeof OBJECT_ART_LIMITS]: number };
export interface ObjectArtInput {
  readonly objects: ScenarioObjects; readonly rules: RuntimeIni; readonly art: RuntimeIni;
  readonly theater: TileTheater; readonly policy: typeof OBJECT_ART_POLICY;
}
export interface ObjectArtField {
  readonly source: 'rules' | 'art'; readonly section: string; readonly key: string; readonly value: string;
  readonly selected: IniOrigin; readonly shadowed: readonly IniOrigin[];
  /** Rule stages at which this art field was consulted; not a native object memory index. */
  readonly loadedAt: readonly string[];
}
export interface ObjectArtType {
  readonly id: string; readonly kind: PlacementKind; readonly name: string;
  readonly rulesImage: string; readonly image: string;
  readonly status: 'shp' | 'voxel' | 'unsupported'; readonly reasons: readonly string[];
  /** Ordered preview fallbacks within the requested theater; no archive winner is implied. */
  readonly paths: readonly string[]; readonly palettePath: string | null; readonly frame: 0;
  readonly transparency: 'source-index-zero'; readonly remap: 'original-palette';
  readonly foundation: Readonly<{ width: number; height: number }> | null;
  readonly fields: readonly ObjectArtField[];
}
export interface ObjectArtPlan {
  readonly policy: typeof OBJECT_ART_POLICY; readonly profile: ProfileId; readonly theater: TileTheater;
  readonly source: ScenarioObjects['source']; readonly nativeBehaviorVerified: false; readonly canStartCampaign: false;
  readonly sourceViewPolicy: typeof INI_SOURCE_VIEW_POLICY; readonly constructionPolicy: typeof SCENARIO_CONSTRUCTION_POLICY;
  readonly artLayerPolicy: 'exact-name-last-layer';
  readonly artLayers: RuntimeIni['layers']; readonly ruleLayers: RuntimeIni['layers'];
  readonly types: readonly ObjectArtType[];
  readonly placements: readonly Readonly<{ rowId: string; typeId: string }>[];
  readonly unsupportedPresentation: readonly string[];
}
export class ObjectArtError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'ObjectArtError'; }
}
function fail(code: string): never { throw new ObjectArtError(code); }
const fold = (s: string): string => s.replace(/[A-Z]/g, c => c.toLowerCase());
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const presets: Readonly<Record<TileTheater, readonly [string, string, string]>> = Object.freeze({
  TEMPERATE: ['t', 'tem', 'tem'], SNOW: ['a', 'sno', 'sno'], URBAN: ['u', 'urb', 'urb'],
  NEWURBAN: ['n', 'ubn', 'ubn'], DESERT: ['d', 'des', 'des'], LUNAR: ['l', 'lun', 'lun'],
});
const families = new Set<PlacementKind>(['infantry', 'unit', 'aircraft', 'structure', 'terrain', 'smudge']);
const plans = new WeakSet<object>();
/** The resource loader accepts a plan produced in this realm, not a reconstructed wire object. */
export function assertObjectArtPlan(value: ObjectArtPlan): void { if (!plans.has(value)) fail('art-plan'); }
function plain(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('art-record');
}
function limits(input: Partial<Limits>): Limits {
  plain(input); const cap: Limits = { ...OBJECT_ART_LIMITS };
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !Object.hasOwn(cap, key)) fail('art-limit');
    const d = Object.getOwnPropertyDescriptor(input, key)!;
    if (!('value' in d) || !Number.isSafeInteger(d.value) || Object.is(d.value, -0) || d.value < 0 || d.value > cap[key as keyof Limits]) fail('art-limit');
    cap[key as keyof Limits] = d.value;
  }
  return cap;
}
function immutable(inputs: readonly unknown[], cap: Limits): void {
  const seen = new Set<object>(), active = new Set<object>(); let nodes = 0, chars = 0;
  function visit(value: unknown, depth: number): void {
    if (++nodes > cap.nodes || depth > 32) fail('art-structure-limit');
    if (typeof value === 'string') { chars += value.length; if (chars > cap.characters) fail('art-character-limit'); return; }
    if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0))) return;
    if (!value || typeof value !== 'object' || !Object.isFrozen(value)) fail('art-immutable');
    if (active.has(value)) fail('art-cycle'); if (seen.has(value)) return;
    const array = Array.isArray(value);
    if (array) { if (Object.getPrototypeOf(value) !== Array.prototype || value.length > cap.nodes - nodes) fail('art-array'); }
    else plain(value);
    const keys = Reflect.ownKeys(value);
    if (keys.length > cap.nodes - nodes || (array && keys.length !== value.length + 1)) fail('art-structure-limit');
    active.add(value); seen.add(value);
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length))) fail('art-key');
      chars += key.length; if (chars > cap.characters) fail('art-character-limit');
      const d = Object.getOwnPropertyDescriptor(value, key)!;
      if (!('value' in d) || !d.enumerable) fail('art-property'); visit(d.value, depth + 1);
    }
    active.delete(value);
  }
  for (const value of inputs) visit(value, 0);
}

/** Selects explicit still resources from verified compiler data; it does not construct native entities. */
export function compileObjectArt(input: ObjectArtInput, options: Partial<Limits> = {}): ObjectArtPlan {
  const cap = limits(options); plain(input);
  const keys = ['objects', 'rules', 'art', 'theater', 'policy'];
  if (Reflect.ownKeys(input).length !== keys.length || !keys.every(key => {
    const d = Object.getOwnPropertyDescriptor(input, key); return d && 'value' in d;
  })) fail('art-input');
  const { objects, rules, art, theater } = input;
  immutable([objects, rules, art], cap);
  if (input.policy !== OBJECT_ART_POLICY || typeof theater !== 'string' || !Object.hasOwn(presets, theater) ||
    objects.policy !== 'webra2-objects-1' || !objects.placementsComplete || objects.schemaVersion !== 1 ||
    (objects.profile !== 'ra2' && objects.profile !== 'yr') || objects.source.profile !== objects.profile ||
    rules.profile !== objects.profile || art.profile !== objects.profile ||
    rules.policy !== 'webra2-ini-1' || art.policy !== 'webra2-ini-1' || rules.schemaVersion !== 1 || art.schemaVersion !== 1) fail('art-profile');
  if (objects.profile === 'ra2' && ['NEWURBAN', 'DESERT', 'LUNAR'].includes(theater)) fail('art-profile');
  const maps = rules.layers.filter(layer => layer.kind === 'map');
  if (maps.length !== 1 || maps[0]!.sourceSha256 !== objects.source.sha256 || !/^[a-f0-9]{64}$/.test(objects.source.sha256)) fail('art-map-identity');
  if (objects.placements.length > cap.placements || rules.entries.length + art.entries.length > cap.fields) fail('art-count-limit');
  const construction = assembleScenarioDefinitions({ objects, rules });
  const constructed = new Map(construction.registries.flatMap(r => r.entries).map(t => [t.id, t]));
  const bindings = new Map(construction.placements.map(p => [p.rowId, p]));
  const view = createIniSourceView(art);
  const [letter, extension, paletteSuffix] = presets[theater];
  const definitions = new Map<string, ObjectArtType>(), rowIds = new Set<string>();
  let work = 0, fieldCount = 0;
  const charge = () => { if (++work > cap.work) fail('art-work-limit'); };
  type ArtLookup = { entries: readonly { value: string; origin: IniOrigin }[]; ambiguous: boolean; present: boolean };
  const cache = new Map<string, ArtLookup>();
  function lookup(section: string, key: string): ArtLookup {
    if (!/^[A-Za-z0-9_-]{1,24}$/.test(section)) return { entries: [], ambiguous: false, present: false };
    const id = section + '\0' + key, old = cache.get(id); if (old) return old;
    const entries: { value: string; origin: IniOrigin }[] = []; let ambiguous = false, present = false;
    for (const stage of view.stages) {
      charge(); const matches = findIniSourceSections(view, stage.layer.id, section);
      if (matches.length > 1) ambiguous = true;
      for (const match of matches) {
        charge(); present = true; const rows = findIniSourceEntries(match, key);
        if (rows.length > 1) ambiguous = true;
        for (const row of rows) { charge(); entries.push(row); }
      }
    }
    const result = { entries, ambiguous, present }; cache.set(id, result); return result;
  }
  const placements = objects.placements.map(p => {
    if (!families.has(p.kind) || typeof p.type !== 'string' || !p.type || p.type.length > 255 || rowIds.has(p.row.id)) fail('art-placement');
    rowIds.add(p.row.id); const name = fold(p.type), id = `type:${p.kind}:${name}`;
    if (!definitions.has(id)) {
      if (definitions.size >= cap.types) fail('art-type-limit');
      const fields = new Map<string, ObjectArtField>(), reasons: string[] = [];
      const binding = bindings.get(p.row.id), definition = binding?.typeId ? constructed.get(binding.typeId) : undefined;
      if (!definition || definition.id !== id) reasons.push('unresolved-constructed-type');
      if (definition && !definition.definitionStages.length) reasons.push('unloaded-type-definition');
      const record = (field: Omit<ObjectArtField, 'loadedAt'>, stage: string): void => {
        const key = field.source + '\0' + field.section + '\0' + field.key, prior = fields.get(key);
        if (!prior && ++fieldCount > cap.fields) fail('art-field-limit');
        fields.set(key, Object.freeze({ ...field, loadedAt: Object.freeze([...new Set([...(prior?.loadedAt ?? []), stage])]) }));
      };
      const read = (section: string, key: string, stage: string): string | undefined => {
        const found = lookup(section, key);
        if (found.ambiguous) reasons.push('ambiguous-art-source');
        const selected = found.entries.at(-1);
        if (selected) record({ source: 'art', section, key, value: selected.value, selected: selected.origin,
          shadowed: Object.freeze(found.entries.slice(0, -1).map(e => e.origin)) }, stage);
        return selected?.value;
      };
      const baseName = (value: string, label: string, maximum = 24): string => {
        if (!new RegExp(`^[A-Za-z0-9_-]{1,${maximum}}$`).test(value)) reasons.push(`unsupported-${label}`); return value;
      };
      let rulesImage = baseName(definition?.name ?? p.type, 'rules-image');
      const flags: Record<'Theater' | 'NewTheater' | 'Voxel', boolean> = { Theater: false, NewTheater: false, Voxel: false };
      function boolean(value: string | undefined, key: string, fallback: boolean): boolean {
        if (value === undefined) return fallback;
        if (/^(yes|true|1)$/i.test(value)) return true;
        if (/^(no|false|0)$/i.test(value)) return false;
        reasons.push(`unsupported-${fold(key)}`); return fallback;
      }
      // ImageFile starts with the first allocated spelling. Each visited rule section
      // changes it only through its exact Image key; art flags keep their prior defaults.
      const imageOrigins: IniOrigin[] = [];
      for (const stage of definition?.definitionStages ?? []) {
        charge(); const image = stage.origins.find(o => o.keySpelling === 'Image');
        if (image) {
          imageOrigins.push(image); rulesImage = baseName(image.rawValue.split(';', 1)[0]!.replace(/^[ \t]+|[ \t]+$/g, ''), 'rules-image');
          record({ source: 'rules', section: definition!.name, key: 'Image', value: rulesImage, selected: image,
            shadowed: Object.freeze(imageOrigins.slice(0, -1)) }, stage.layerId);
        }
        // Invalid basename cannot be passed to an indexed source lookup.
        if (!/^[A-Za-z0-9_-]{1,24}$/.test(rulesImage)) continue;
        for (const key of ['Theater', 'NewTheater', 'Voxel'] as const)
          flags[key] = boolean(read(rulesImage, key, stage.layerId), key, flags[key]);
      }
      const artName = rulesImage;
      if (!lookup(artName, 'Image').present) reasons.push('missing-art-section');
      const lastStage = definition?.definitionStages.at(-1)?.layerId ?? 'constructor';
      const alias = read(artName, 'Image', lastStage);
      // The pinned building theater loader implements this redirect. Other families'
      // generic SHP loader consumes ImageFile directly; the old generic alias was a preview choice.
      if (alias !== undefined && p.kind !== 'structure') reasons.push('unsupported-art-image-for-family');
      const image = baseName(p.kind === 'structure' && alias ? alias : rulesImage, 'art-image', p.kind === 'structure' ? 48 : 24);
      const voxel = flags.Voxel, isTheater = flags.Theater, newTheater = flags.NewTheater;
      const terrainPalette = boolean(read(artName, 'TerrainPalette', lastStage), 'TerrainPalette', false);
      // These presentation fields remain recorded intent, not native frame/remap selection.
      read(artName, 'Remapable', lastStage); read(artName, 'Sequence', lastStage);
      const palette = read(artName, 'Palette', lastStage);
      let palettePath: string | null = isTheater || terrainPalette || p.kind === 'terrain' || p.kind === 'smudge' ? `iso${paletteSuffix}.pal` : `unit${paletteSuffix}.pal`;
      if (palette !== undefined) {
        // Native custom Palette is a prefix, followed by the current theater suffix and .PAL.
        if (/^[A-Za-z0-9_-]{1,31}$/.test(palette)) palettePath = fold(palette) + paletteSuffix + '.pal';
        else { reasons.push('unsupported-palette'); palettePath = null; }
      }
      let foundation: { width: number; height: number } | null = null;
      if (p.kind === 'structure') {
        const value = read(artName, 'Foundation', lastStage), match = value && /^(\d{1,2})x(\d{1,2})$/i.exec(value);
        if (match && Number(match[1]) > 0 && Number(match[1]) <= 32 && Number(match[2]) > 0 && Number(match[2]) <= 32) foundation = Object.freeze({ width: Number(match[1]), height: Number(match[2]) });
        else if (value !== undefined) reasons.push('unsupported-foundation');
      }
      const paths: string[] = [], stem = fold(image);
      if (isTheater) paths.push(`${stem}.${extension}`);
      if (newTheater) {
        if (/^[gncy]./.test(stem)) paths.push(stem[0] + letter + stem.slice(2) + '.shp', stem[0] + 'g' + stem.slice(2) + '.shp');
        else reasons.push('unsupported-newtheater-name');
      }
      paths.push(`${stem}.${voxel ? 'vxl' : 'shp'}`);
      const uniqueReasons = Object.freeze([...new Set(reasons)]);
      definitions.set(id, Object.freeze({ id, name, kind: p.kind, rulesImage, image, status: reasons.length ? 'unsupported' : voxel ? 'voxel' : 'shp',
        reasons: uniqueReasons, paths: Object.freeze([...new Set(paths)]), palettePath, frame: 0,
        transparency: 'source-index-zero', remap: 'original-palette', foundation, fields: Object.freeze([...fields.values()]) }));
    }
    return Object.freeze({ rowId: p.row.id, typeId: id });
  }).sort((a, b) => compare(a.rowId, b.rowId));
  const result: ObjectArtPlan = Object.freeze({ policy: OBJECT_ART_POLICY, profile: objects.profile, theater, source: objects.source,
    nativeBehaviorVerified: false, canStartCampaign: false, sourceViewPolicy: INI_SOURCE_VIEW_POLICY, constructionPolicy: SCENARIO_CONSTRUCTION_POLICY,
    artLayerPolicy: 'exact-name-last-layer', artLayers: art.layers, ruleLayers: rules.layers,
    types: Object.freeze([...definitions.values()].sort((a, b) => compare(a.id, b.id))), placements: Object.freeze(placements),
    unsupportedPresentation: Object.freeze(['native-family-defaults', 'native-foundation', 'native-art-layer-merging', 'arctic-variants', 'native-frame-selection', 'facing', 'animation', 'house-remap', 'shadows', 'lighting', 'voxel-composition', 'attached-art']) });
  plans.add(result); return result;
}
