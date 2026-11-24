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

test('v2 starts with five-point research values and only verified current organizations', () => {
  const research = {
    [ids[0]]: { rating: 5, igl: 'yes', organization: '組織A', organizationStatus: 'verified' },
    [ids[1]]: { rating: null, organization: '過去の組織', organizationStatus: 'former' },
    [ids[2]]: { rating: 2, organization: '未確認組織', organizationStatus: 'unknown' }
  };
  const before = JSON.stringify(research);
  const state = C.createState(roster, research);
  assert.equal(state.version, 2);
  assert.equal(state.members[ids[0]].rating, 5);
  assert.equal(state.members[ids[0]].igl, 'yes');
  assert.equal(state.members[ids[0]].organization, '組織A');
  assert.equal(state.members[ids[1]].organization, '');
  assert.equal(state.members[ids[2]].organization, '');
  assert.equal(state.members[ids[3]].rating, null);
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

test('v2 rating boundaries accept 1 through 5 and null, rejecting former ten-point values', () => {
  for (const rating of [null, 1, 2, 3, 4, 5]) {
    const state = stateWithAttendance(); state.members[ids[0]].rating = rating;
    assert.equal(C.validateState(state, roster).members[ids[0]].rating, rating);
  }
  for (const rating of [0, 6, 10, -1, 2.5, '5', undefined]) {
    const state = stateWithAttendance(); state.members[ids[0]].rating = rating;
    assert.throws(() => C.validateState(state, roster), /戦力点/);
  }
});

test('unrated participants count as provisional three points, including newly confirmed history', () => {
  const state = stateWithAttendance(2);
  state.draft = { id: 'unrated', builtAt: date, teams: [ids.slice(0, 2)] };
  const report = C.analyze(state.draft.teams, roster, state);
  assert.equal(report.totals[0], 6);
  assert.equal(report.provisional, 2);
  const confirmed = C.confirmMatch(state, roster);
  assert.equal(confirmed.history[0].ratingScale, 5);
  assert.deepEqual(confirmed.history[0].scores[ids[0]], { rating: 3, igl: 'unknown', provisional: true });
  assert.equal(state.members[ids[0]].rating, null);
  confirmed.members[ids[0]].rating = 5;
  assert.equal(confirmed.history[0].scores[ids[0]].rating, 3);
});

test('legacy ratings 1 through 10 use ceiling conversion, while null remains unrated', () => {
  const migrated = C.migrateV1(legacyFixture(), roster);
  assert.equal(migrated.version, 2);
  assert.deepEqual(ids.slice(0, 10).map(id => migrated.members[id].rating), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.equal(migrated.members[ids[10]].rating, null);
  assert.equal(migrated.members[ids[0]].organization, '');
  assert.deepEqual(migrated.settings, { sameTeam: false, pastTeam: true, sameOrganization: true, repeat: false });
});

test('migration retains draft, absences, directional friends and ten-point historical scores without mutating input', () => {
  const legacy = legacyFixture();
  const before = C.clone(legacy);
  const migrated = C.migrateV1(legacy, roster);
  assert.deepEqual(legacy, before);
  assert.deepEqual(migrated.draft, legacy.draft);
  assert.deepEqual(migrated.history[0].scores, legacy.history[0].scores);
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

test('normal v2 validation rejects v1 and migration rejects unrelated versions and invalid legacy ratings', () => {
  assert.throws(() => C.validateState(legacyFixture(), roster), /対応していない/);
  for (const version of [0, 2, 3, '1']) {
    const state = legacyFixture(); state.version = version;
    assert.throws(() => C.migrateV1(state, roster), /旧設定/);
  }
  for (const rating of [0, 11, 1.5]) {
    const state = legacyFixture(); state.members[ids[0]].rating = rating;
    assert.throws(() => C.migrateV1(state, roster), /戦力点/);
  }
});

test('v2 JSON can retain mixed historical rating scales and enforce each snapshot scale', () => {
  const state = stateWithAttendance();
  state.history = [snapshot(5), { ...snapshot(10), id: 'legacy' }];
  assert.deepEqual(C.validateState(state, roster).history, state.history);
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
