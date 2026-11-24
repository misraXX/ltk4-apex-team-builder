const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../site/core.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../site/roster.js'), 'utf8'), context);
const roster = JSON.parse(JSON.stringify(context.window.LTK_ROSTER.players));
const ids = roster.map(p => p.id);
const date = '2026-11-24T00:00:00.000Z';

function stateWithAttendance(n = 6) {
  const state = C.createState(roster);
  ids.forEach((id, i) => { state.members[id].attending = i < n; });
  return state;
}
function legacyFixture() {
  const state = stateWithAttendance(6);
  state.version = 1;
  state.settings = { sameTeam: false, repeat: false };
  ids.forEach((id, i) => {
    delete state.members[id].organization;
    delete state.members[id].rank;
    state.members[id].rating = i < 10 ? i + 1 : null;
  });
  Object.assign(state.members[ids[0]], {
    social: 'required', friends: [ids[1], ids[12]], note: '旧設定のメモ', igl: 'yes'
  });
  state.draft = { id: 'legacy-draft', builtAt: date, teams: [ids.slice(0, 3), ids.slice(3, 6)] };
  state.history = [{
    id: 'legacy-confirmed', confirmedAt: date, teams: [ids.slice(0, 3)],
    scores: {
      [ids[0]]: { rating: 1, igl: 'yes', provisional: false },
      [ids[1]]: { rating: 10, igl: 'unknown', provisional: false },
      [ids[2]]: { rating: 5, igl: 'no', provisional: true }
    }
  }];
  return state;
}
function snapshot(scale = 5) {
  return { id: 'confirmed', confirmedAt: date, teams: [ids.slice(0, 2)], ratingScale: scale,
    scores: Object.fromEntries(ids.slice(0, 2).map(id => [id, { rating: scale, igl: 'unknown', provisional: false }])) };
}
function withUnknownHistoricalRanks(history) {
  return history.map(match => ({ ...match, scores: Object.fromEntries(Object.entries(match.scores).map(([id, score]) => [id, { ...score, rank: score.rank ?? 'unknown' }])) }));
}
function fivePointFixture() {
  const state = stateWithAttendance(6);
  state.version = 2;
  ids.forEach((id, i) => { delete state.members[id].rank; state.members[id].rating = i < 5 ? i + 1 : null; });
  Object.assign(state.members[ids[0]], {
    organization: '手動の所属', social: 'required', friends: [ids[1], ids[12]], note: '5段階のメモ', igl: 'yes'
  });
  state.settings = { sameTeam: false, pastTeam: false, sameOrganization: true, repeat: false };
  state.draft = { id: 'five-point-draft', builtAt: date, teams: [ids.slice(0, 3), ids.slice(3, 6)] };
  state.history = [snapshot(5), { ...snapshot(10), id: 'older-ten-point-match' }];
  return state;
}

test('v3 starts with ten-point research values and only verified current organizations', () => {
  const research = {
    [ids[0]]: { rank: 'predator', rating: 10, igl: 'yes', organization: '組織A', organizationStatus: 'verified' },
    [ids[1]]: { rating: null, organization: '過去の組織', organizationStatus: 'former' },
    [ids[2]]: { rating: 2, organization: '未確認組織', organizationStatus: 'unknown' }
  };
  const before = JSON.stringify(research);
  const state = C.createState(roster, research);
  assert.equal(state.version, 3);
  assert.equal(state.members[ids[0]].rating, 10);
  assert.equal(state.members[ids[0]].rank, 'predator');
  assert.equal(state.members[ids[0]].igl, 'yes');
  assert.equal(state.members[ids[0]].organization, '組織A');
  assert.equal(state.members[ids[1]].organization, '');
  assert.equal(state.members[ids[2]].organization, '');
  assert.equal(state.members[ids[3]].rating, null);
  assert.equal(state.members[ids[3]].rank, 'unknown');
  assert.deepEqual(state.settings, { sameTeam: true, pastTeam: true, sameOrganization: true, repeat: true });
  assert.equal(JSON.stringify(research), before);
});

test('manual organization, directed familiarity, absence and relationship toggles survive JSON validation', () => {
  const state = stateWithAttendance();
  Object.assign(state.members[ids[0]], { organization: '手動の所属', social: 'required', friends: [ids[1], ids[20]] });
  state.settings.pastTeam = false;
  state.settings.sameOrganization = false;
  assert.deepEqual(C.validateState(JSON.parse(JSON.stringify(state)), roster), state);
});

test('v3 rating boundaries accept all ten integer values and null', () => {
  for (const rating of [null, ...Array.from({ length: 10 }, (_, i) => i + 1)]) {
    const state = stateWithAttendance(); state.members[ids[0]].rating = rating;
    assert.equal(C.validateState(state, roster).members[ids[0]].rating, rating);
  }
  for (const rating of [0, 11, -1, 2.5, '5', undefined]) {
    const state = stateWithAttendance(); state.members[ids[0]].rating = rating;
    assert.throws(() => C.validateState(state, roster), /戦力点/);
  }
});

test('rank selection retains researched individual ability only for the same rank', () => {
  assert.deepEqual(Object.keys(C.ranks), ['unknown', 'rookie', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'predator']);
  const defaults = { unknown: null, rookie: 1, bronze: 2, silver: 3, gold: 4, platinum: 5, diamond: 6, master: 7, predator: 9 };
  for (const [rank, expected] of Object.entries(defaults)) {
    assert.equal(C.rankRating(rank), expected, rank);
    assert.equal(C.rankRating(rank, { rank: 'predator', rating: 10 }), rank === 'predator' ? 10 : expected, rank);
  }
  assert.equal(C.rankRating('predator', { rank: 'predator', rating: 8 }), 8);
  assert.equal(C.rankRating('predator', { rank: 'predator', rating: null }), 9);
  const research = { rank: 'unknown', rating: 2 };
  assert.equal(C.rankRating('unknown', research), 2, 'known beginner ability does not imply a verified rank');
  assert.deepEqual(research, { rank: 'unknown', rating: 2 });
});

test('all current ranks round-trip independently of internal ability, while invalid and missing current ranks are rejected', () => {
  for (const rank of Object.keys(C.ranks)) {
    const state = stateWithAttendance();
    state.members[ids[0]].rank = rank;
    state.members[ids[0]].rating = 10;
    assert.deepEqual(C.validateState(JSON.parse(JSON.stringify(state)), roster), state);
  }
  for (const rank of [undefined, null, '', 'Predator', 'emerald', 'grandmaster', 9, {}, ['predator'], '__proto__']) {
    const state = stateWithAttendance(); state.members[ids[0]].rank = rank;
    assert.throws(() => C.validateState(state, roster), /ランク/, String(rank));
  }
});

test('same Predator rank keeps individual 10 versus 8 ability in balancing and immutable confirmed history', () => {
  const state = stateWithAttendance(4);
  const [a, b, c, d] = ids;
  Object.assign(state.members[a], { rank: 'predator', rating: 10 });
  Object.assign(state.members[b], { rank: 'predator', rating: 8 });
  Object.assign(state.members[c], { rank: 'gold', rating: 4 });
  Object.assign(state.members[d], { rank: 'diamond', rating: 6 });
  assert.deepEqual(C.analyze([[a, c], [b, d]], roster, state).totals, [14, 14]);
  assert.deepEqual(C.analyze([[a, d], [b, c]], roster, state).totals, [16, 12]);
  state.settings = { sameTeam: false, pastTeam: false, sameOrganization: false, repeat: false };
  const generated = C.generate(roster, state, { seed: 17, iterations: 1000, restarts: 2 });
  assert.deepEqual(C.analyze(generated.teams, roster, state).totals, [14, 14]);
  state.draft = { id: 'individual-ability', builtAt: date, teams: [[a, c], [b, d]] };
  const confirmed = C.confirmMatch(state, roster);
  assert.equal(confirmed.history[0].ratingScale, 10);
  assert.deepEqual([confirmed.history[0].scores[a].rank, confirmed.history[0].scores[b].rank], ['predator', 'predator']);
  assert.deepEqual([confirmed.history[0].scores[a].rating, confirmed.history[0].scores[b].rating], [10, 8]);
  const snapshotBefore = C.clone(confirmed.history);
  Object.assign(confirmed.members[a], { rank: 'silver', rating: C.rankRating('silver') });
  Object.assign(confirmed.members[b], { rank: 'unknown', rating: null });
  assert.deepEqual(C.validateState(JSON.parse(JSON.stringify(confirmed)), roster).history, snapshotBefore);
  assert.equal(state.history.length, 0);
  assert.equal(state.members[a].rank, 'predator');
});

test('explicit historical ranks survive mixed scales, and invalid historical ranks are rejected', () => {
  const state = stateWithAttendance();
  state.history = [snapshot(5), { ...snapshot(10), id: 'ten-point-ranked-history' }];
  state.history[0].scores[ids[0]].rank = 'gold';
  state.history[1].scores[ids[0]].rank = 'predator';
  const expected = withUnknownHistoricalRanks(state.history);
  assert.deepEqual(C.validateState(state, roster).history, expected);
  for (const rank of [null, 'emerald', 'grandmaster', '', 'PREDATOR', 9, {}, ['gold'], '__proto__']) {
    const bad = C.clone(state); bad.history[0].scores[ids[0]].rank = rank;
    assert.throws(() => C.validateState(bad, roster), /履歴のランク/);
  }
});

test('unrated participants count as provisional five points, including newly confirmed history', () => {
  const state = stateWithAttendance(2);
  state.draft = { id: 'unrated', builtAt: date, teams: [ids.slice(0, 2)] };
  const report = C.analyze(state.draft.teams, roster, state);
  assert.equal(report.totals[0], 10);
  assert.equal(report.provisional, 2);
  const confirmed = C.confirmMatch(state, roster);
  assert.equal(confirmed.history[0].ratingScale, 10);
  assert.deepEqual(confirmed.history[0].scores[ids[0]], { rating: 5, igl: 'unknown', provisional: true, rank: 'unknown' });
  assert.equal(state.members[ids[0]].rating, null);
  confirmed.members[ids[0]].rating = 10;
  assert.equal(confirmed.history[0].scores[ids[0]].rating, 5);
});

test('v1 ten-point ratings are retained directly, while null remains unrated', () => {
  const migrated = C.migrateV1(legacyFixture(), roster);
  assert.equal(migrated.version, 3);
  assert.deepEqual(ids.slice(0, 10).map(id => migrated.members[id].rating), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(migrated.members[ids[10]].rating, null);
  assert.equal(migrated.members[ids[0]].organization, '');
  assert.ok(ids.every(id => migrated.members[id].rank === 'unknown'), 'legacy points cannot establish an Apex rank');
  assert.deepEqual(migrated.settings, { sameTeam: false, pastTeam: true, sameOrganization: true, repeat: false });
});

test('migration retains draft, absences, directional friends and ten-point historical scores without mutating input', () => {
  const legacy = legacyFixture();
  const before = C.clone(legacy);
  const migrated = C.migrateV1(legacy, roster);
  assert.deepEqual(legacy, before);
  assert.deepEqual(migrated.draft, legacy.draft);
  assert.deepEqual(migrated.history[0].scores, withUnknownHistoricalRanks(legacy.history)[0].scores);
  assert.equal(migrated.history[0].ratingScale, 10);
  assert.equal(migrated.members[ids[12]].attending, false);
  assert.deepEqual(migrated.members[ids[0]].friends, [ids[1], ids[12]]);
  assert.equal(migrated.members[ids[0]].social, 'required');
  assert.equal(migrated.members[ids[0]].note, '旧設定のメモ');
  assert.equal(migrated.members[ids[0]].igl, 'yes');
  migrated.members[ids[0]].friends.pop(); migrated.draft.teams[0].reverse();
  migrated.history[0].scores[ids[1]].rating = 1;
  assert.deepEqual(legacy, before, 'migration must not retain mutable references to the old state');
});

test('normal v3 validation rejects both legacy schemas, and v1 migration validates its own input', () => {
  assert.throws(() => C.validateState(legacyFixture(), roster), /対応していない/);
  assert.throws(() => C.validateState(fivePointFixture(), roster), /対応していない/);
  for (const version of [0, 2, 3, '1']) {
    const state = legacyFixture(); state.version = version;
    assert.throws(() => C.migrateV1(state, roster), /旧設定/);
  }
  for (const rating of [0, 11, 1.5]) {
    const state = legacyFixture(); state.members[ids[0]].rating = rating;
    assert.throws(() => C.migrateV1(state, roster), /戦力点/);
  }
});

test('v2 five-point ratings double only in the current configuration', () => {
  const raw = fivePointFixture();
  const before = C.clone(raw);
  const migrated = C.migrateV2(raw, roster);
  assert.equal(migrated.version, 3);
  assert.deepEqual(ids.slice(0, 5).map(id => migrated.members[id].rating), [2, 4, 6, 8, 10]);
  assert.equal(migrated.members[ids[5]].rating, null);
  assert.deepEqual(migrated.history, withUnknownHistoricalRanks(before.history), 'past five- and ten-point snapshots retain numbers and gain only unknown rank');
  assert.ok(ids.every(id => migrated.members[id].rank === 'unknown'), 'five-point ratings cannot establish an Apex rank');
  assert.deepEqual(migrated.draft, before.draft);
  assert.deepEqual(migrated.settings, before.settings);
  assert.equal(migrated.members[ids[0]].organization, '手動の所属');
  assert.equal(migrated.members[ids[0]].note, '5段階のメモ');
  assert.equal(migrated.members[ids[0]].igl, 'yes');
  assert.equal(migrated.members[ids[12]].attending, false);
  assert.deepEqual(migrated.members[ids[0]].friends, [ids[1], ids[12]]);
  assert.equal(migrated.members[ids[0]].social, 'required');
  assert.deepEqual(raw, before);
  assert.deepEqual(C.validateState(JSON.parse(JSON.stringify(migrated)), roster), migrated);
  migrated.members[ids[0]].friends.pop();
  migrated.draft.teams[0].reverse();
  migrated.history[0].scores[ids[0]].rating = 1;
  assert.deepEqual(raw, before, 'v2 migration must not retain mutable references');
});

test('v2 migration rejects unrelated versions, out-of-range current scores and inconsistent historical scales', () => {
  for (const version of [0, 1, 3, '2', undefined]) {
    const raw = fivePointFixture(); raw.version = version;
    assert.throws(() => C.migrateV2(raw, roster), /旧5段階/);
  }
  for (const rating of [0, 6, 10, 2.5, '5', undefined]) {
    const raw = fivePointFixture(); raw.members[ids[0]].rating = rating;
    assert.throws(() => C.migrateV2(raw, roster), /戦力点/);
  }
  for (const scale of [undefined, 0, 6, '10']) {
    const raw = fivePointFixture(); raw.history[0].ratingScale = scale;
    assert.throws(() => C.migrateV2(raw, roster), /評価段階/);
  }
  const raw = fivePointFixture(); raw.history[0].scores[ids[0]].rating = 6;
  assert.throws(() => C.migrateV2(raw, roster), /履歴の評価/);
});

test('v3 JSON can retain mixed historical rating scales and enforce each snapshot scale', () => {
  const state = stateWithAttendance();
  state.history = [snapshot(5), { ...snapshot(10), id: 'legacy' }];
  const before = C.clone(state);
  assert.deepEqual(C.validateState(state, roster).history, withUnknownHistoricalRanks(state.history));
  assert.deepEqual(state, before, 'normalizing an old history snapshot must not mutate the input');
  for (const [scale, rating] of [[5, 6], [10, 11], [5, 0], [10, 2.5]]) {
    const bad = stateWithAttendance(); bad.history = [snapshot(scale)];
    bad.history[0].scores[ids[0]].rating = rating;
    assert.throws(() => C.validateState(bad, roster), /履歴の評価/);
  }
  for (const scale of [undefined, 1, 6, '10']) {
    const bad = stateWithAttendance(); bad.history = [snapshot(scale)];
    if (scale === undefined) delete bad.history[0].ratingScale;
    assert.throws(() => C.validateState(bad, roster), /評価段階/);
  }
});

test('manual organization fields and new relationship settings validate their boundaries', () => {
  const state = stateWithAttendance(); state.members[ids[0]].organization = 'あ'.repeat(80);
  assert.equal(C.validateState(state, roster).members[ids[0]].organization.length, 80);
  for (const value of [null, 123, 'あ'.repeat(81)]) {
    const bad = C.clone(state); bad.members[ids[0]].organization = value;
    assert.throws(() => C.validateState(bad, roster), /所属組織/);
  }
  for (const key of ['pastTeam', 'sameOrganization']) for (const value of [undefined, null, 1, 'true']) {
    const bad = C.clone(state); bad.settings[key] = value;
    assert.throws(() => C.validateState(bad, roster), /関係性の編成方針/);
  }
});

test('unknown and independent labels never create a same-organization relationship', () => {
  for (const organization of ['', ' ', '個人', '個人勢', '無所属', '不明', '所属不明', '未確認', 'フリー', 'unknown', 'NONE']) {
    assert.equal(C.sameOrganization({ organization }, { organization }), false, organization);
  }
  assert.equal(C.sameOrganization({ organization: ' ZETA DIVISION ' }, { organization: 'zeta division' }), true);
  assert.equal(C.sameOrganization({ organization: 'ぶいすぽっ！' }, { organization: 'ネオポルテ' }), false);
});

test('past-team relationships require the same season and team, excluding current LTK4', () => {
  const a = { ltkHistory: [{ season: 1, team: 'A' }, { season: 2, team: 'B' }, { season: 3, team: 'C' }, { season: 4, team: 'D' }] };
  const b = { ltkHistory: [{ season: 1, team: 'B' }, { season: 2, team: 'B' }, { season: 3, team: 'C' }, { season: 4, team: 'D' }] };
  assert.deepEqual(C.pastTeamSeasons(a, b), [2, 3]);
  assert.deepEqual(C.pastTeamSeasons(a, {}), []);
});

test('past-team seasons are limited to LTK1 through LTK3 at both boundaries', () => {
  const member = { ltkHistory: [-1, 0, 1, 2, 3, 4, 5].map(season => ({ season, team: 'A' })) };
  assert.deepEqual(C.pastTeamSeasons(member, member), [1, 2, 3]);
});

test('past-team and organization preferences independently influence allocation when enabled', () => {
  const localRoster = C.clone(roster);
  localRoster.forEach((p, i) => {
    p.team = 'separate-' + i;
    p.ltkHistory = i < 4 ? [{ season: 1, team: i < 2 ? 'past-A' : 'past-B' }] : [];
  });
  const state = stateWithAttendance(4);
  state.settings.sameTeam = false; state.settings.repeat = false;
  ids.slice(0, 4).forEach((id, i) => { state.members[id].organization = i % 2 ? 'org-B' : 'org-A'; });
  const pairs = teams => teams.map(t => [...t].sort().join('|')).sort();
  const options = { seed: 531, iterations: 1000, restarts: 2 };
  state.settings.pastTeam = true; state.settings.sameOrganization = false;
  const past = C.generate(localRoster, state, options);
  assert.deepEqual(pairs(past.teams), pairs([ids.slice(0, 2), ids.slice(2, 4)]));
  assert.equal(C.analyze(past.teams, localRoster, state).details.reduce((s, d) => s + d.pastTeamPairs, 0), 2);
  state.settings.pastTeam = false; state.settings.sameOrganization = true;
  const organizations = C.generate(localRoster, state, options);
  assert.deepEqual(pairs(organizations.teams), pairs([[ids[0], ids[2]], [ids[1], ids[3]]]));
  assert.equal(C.analyze(organizations.teams, localRoster, state).details.reduce((s, d) => s + d.organizationPairs, 0), 2);
});
