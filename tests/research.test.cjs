const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the exact static assets delivered to Pages, without browser globals.
const context = { window: {} };
for (const file of ['roster.js', 'research.js', 'ltk-relations.js']) {
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../site', file), 'utf8'), context, { filename: file });
}
const { LTK_ROSTER: roster, LTK_RESEARCH: research, LTK_RELATIONS: relations } = JSON.parse(JSON.stringify(context.window));
const ids = new Set(roster.players.map(p => p.id));
const players = new Map(research.players.map(p => [p.id, p]));
const sorted = values => [...values].sort();
const pairKey = (a, b) => [a, b].sort().join('|');
const sharedKey = shared => `${shared.season}|${shared.team}`;
const httpSource = source => {
  assert.ok(source && typeof source.url === 'string', 'source must have a URL');
  const url = new URL(source.url);
  assert.ok(['https:', 'http:'].includes(url.protocol), source.url);
};

test('research covers the exact 60-person roster once each', () => {
  assert.equal(roster.players.length, 60);
  assert.equal(ids.size, 60);
  assert.equal(research.players.length, 60);
  assert.equal(players.size, 60);
  assert.deepEqual(sorted(players.keys()), sorted(ids));
  for (const p of research.players) {
    assert.equal(p.name, roster.players.find(r => r.id === p.id).name, p.id);
    assert.ok(Array.isArray(p.queries) && p.queries.length > 0, `${p.id}: search missing`);
    assert.ok(p.queries.every(q => typeof q === 'string' && q.trim()), p.id);
  }
});

test('five-point ratings preserve unknowns and the two user-specified values', () => {
  assert.equal(research.ratingScale, 5);
  for (const p of research.players) {
    assert.ok(p.rating === null || (Number.isInteger(p.rating) && p.rating >= 1 && p.rating <= 5), p.id);
    if (p.researchStatus === 'insufficient') assert.equal(p.rating, null, `${p.id}: insufficient is not beginner`);
    if (p.rating !== null) {
      assert.ok(p.ratingBasis.trim(), p.id);
      assert.ok(p.evidence.length > 0, `${p.id}: rated without evidence`);
    }
    if (p.rating === 1) {
      assert.ok(p.evidence.some(e => e.kind === 'primary'), `${p.id}: beginner needs a primary source`);
      assert.match(p.ratingBasis, /初心者|未経験/, p.id);
    }
  }
  for (const id of ['yukio', 'yufuna']) {
    assert.equal(players.get(id).rating, 5, id);
    assert.equal(players.get(id).ratingSource, 'user', id);
  }
});

test('current organizations and positive IGL claims carry inspectable evidence', () => {
  for (const p of research.players) {
    assert.ok(['verified', 'unknown', 'former'].includes(p.organizationStatus), p.id);
    if (p.organizationStatus === 'verified') {
      assert.ok(typeof p.organization === 'string' && p.organization.trim(), p.id);
      assert.ok(p.organizationsEvidence.length > 0, `${p.id}: current organization without source`);
    }
    for (const e of [...p.organizationsEvidence, ...p.evidence]) httpSource(e);
    assert.ok(['yes', 'no', 'unknown'].includes(p.igl), p.id);
    if (p.igl === 'yes') {
      assert.ok(p.iglBasis.trim(), p.id);
      assert.ok(p.evidence.some(e => e.kind === 'primary' && /IGL|指揮|指示役/i.test(`${e.title} ${e.note}`)), `${p.id}: IGL lacks direct evidence`);
    }
  }
});

test('known historical facts do not become current affiliations or lose later achievements', () => {
  assert.equal(players.get('mother3').organizationStatus, 'former');
  assert.notEqual(players.get('mother3').organization, 'REJECT');
  assert.equal(players.get('shaka').rating, 5);
  assert.ok(players.get('shaka').evidence.some(e => e.kind === 'primary' && /プレデター/.test(`${e.title} ${e.note}`)));
});

test('research summary is calculated from the delivered records', () => {
  const rated = research.players.filter(p => p.rating !== null).length;
  assert.equal(research.summary.searched, research.players.length);
  assert.equal(research.summary.rated, rated);
  assert.equal(research.summary.unrated, research.players.length - rated);
  assert.equal(research.summary.organizationsVerified, research.players.filter(p => p.organizationStatus === 'verified').length);
  assert.equal(research.summary.iglVerified, research.players.filter(p => p.igl === 'yes').length);
});

test('historical memberships have unique seasons and LTK4 agrees with the roster', () => {
  assert.deepEqual(sorted(Object.keys(relations.memberships)), sorted(ids));
  const tiers = new Set(roster.players.map(p => p.tier));
  for (const p of roster.players) {
    const memberships = relations.memberships[p.id];
    assert.equal(new Set(memberships.map(m => m.season)).size, memberships.length, `${p.id}: duplicate season`);
    for (const m of memberships) {
      assert.ok(Number.isInteger(m.season) && m.season >= 1 && m.season <= 4, p.id);
      assert.ok(typeof m.team === 'string' && m.team.trim(), p.id);
      assert.ok(tiers.has(m.tier), `${p.id}: invalid tier ${m.tier}`);
    }
    const current = memberships.filter(m => m.season === 4);
    assert.equal(current.length, 1, `${p.id}: LTK4 missing`);
    for (const field of ['team', 'tier', 'role']) assert.equal(current[0][field], p[field], `${p.id}: ${field}`);
  }
});

test('every historical pair is supported by both memberships and the same-tier flag', () => {
  const seen = new Set();
  for (const pair of relations.pairs) {
    assert.ok(ids.has(pair.a) && ids.has(pair.b), `${pair.a}/${pair.b}`);
    assert.notEqual(pair.a, pair.b);
    const key = pairKey(pair.a, pair.b);
    assert.ok(!seen.has(key), `duplicate pair ${key}`);
    seen.add(key);
    assert.ok(pair.shared.length > 0, key);
    const sharedSeen = new Set();
    for (const shared of pair.shared) {
      const sourceKey = sharedKey(shared);
      assert.ok(!sharedSeen.has(sourceKey), `${key}: duplicate shared team`);
      sharedSeen.add(sourceKey);
      const left = relations.memberships[pair.a].find(m => m.season === shared.season && m.team === shared.team);
      const right = relations.memberships[pair.b].find(m => m.season === shared.season && m.team === shared.team);
      assert.ok(left && right, `${key}: unsubstantiated ${sourceKey}`);
      assert.equal(shared.sameTier, left.tier === right.tier, `${key}: wrong sameTier ${sourceKey}`);
    }
  }
});

test('pair data omits no shared season/team from the memberships', () => {
  const actual = new Map(relations.pairs.map(p => [pairKey(p.a, p.b), p.shared.map(sharedKey).sort()]));
  const rosterIds = [...ids];
  for (let a = 0; a < rosterIds.length; a++) {
    for (let b = a + 1; b < rosterIds.length; b++) {
      const leftId = rosterIds[a], rightId = rosterIds[b];
      const expected = relations.memberships[leftId]
        .filter(left => relations.memberships[rightId].some(right => right.season === left.season && right.team === left.team))
        .map(sharedKey).sort();
      assert.deepEqual(actual.get(pairKey(leftId, rightId)) || [], expected, `${leftId}/${rightId}`);
    }
  }
});

test('all four historical seasons have hashed sources and consistent coverage counts', () => {
  assert.deepEqual(relations.sources.map(s => s.season).sort(), [1, 2, 3, 4]);
  assert.deepEqual(relations.checks.map(s => s.season).sort(), [1, 2, 3, 4]);
  for (const source of relations.sources) {
    httpSource(source);
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(source.bytes) && source.bytes > 0);
    const memberships = Object.values(relations.memberships).flat().filter(m => m.season === source.season);
    const check = relations.checks.find(c => c.season === source.season);
    assert.equal(check.matchedCurrentPlayers, memberships.length, `season ${source.season}`);
    assert.ok(check.regularPlayers >= check.matchedCurrentPlayers);
    assert.equal(check.teams, new Set(memberships.map(m => m.team)).size);
  }
});
