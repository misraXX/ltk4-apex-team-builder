const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const C = require('../site/core.js');

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
const apexRankIds = ['unknown', 'rookie', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'predator', 'former-pro'];
// These were the unverified ranks before the follow-up research cycle.
const followupBaseline = ['maitake','mittiii','takaya-special','gonkane','regrush-lionheart','raizin','yunika','eugeo','zerost','enty','takamiya-rion','tatsumaki-chise','yutapon','rainbrain','ceros','yuhi','nemoh','mother3','amanogawa-neru','sakayori-soma','stanmi','kagura-mea','washidai','sharuru','tanukininja','day1','hetel','kohaku-uru','haruchya','nagisacchi','toko','sendo-yuuhi','apamen','nesty','recap','haretti','thinton'];
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

test('fixed FPS classifications separate former Apex pros from Predator without personal point adjustments', () => {
  assert.equal(research.ratingScale, 10);
  assert.equal(research.pointSystem, 'fps-evidence-v1');
  assert.deepEqual(research.rankPoints, C.rankPoints);
  for (const p of research.players) {
    assert.ok(Number.isInteger(p.rating) && p.rating >= 1 && p.rating <= 10, p.id);
    assert.equal(p.rating, C.rankRating(p.rank), `${p.id}: rating must follow rank`);
    assert.ok(p.ratingBasis.trim(), p.id);
    if (p.rank === 'unknown') assert.equal(p.rating, 2, `${p.id}: unverified experience uses the requested baseline`);
    else assert.ok(p.evidence.length > 0 || p.fpsResearch?.evidence?.length > 0, `${p.id}: positive achievement claim without evidence`);
  }
  assert.equal(players.get('yukio').rating, 10);
  assert.equal(players.get('yufuna').rating, 8);
  assert.equal(players.get('tachibana-hinano').rating, 8);
  assert.ok(players.get('yukio').rating > players.get('tachibana-hinano').rating);
});

test('researched ranks use fixed points and follow-up findings rather than subjective beginner assumptions', () => {
  for (const p of research.players) {
    assert.equal(typeof p.rank, 'string', `${p.id}: rank missing`);
    assert.ok(Object.hasOwn(C.ranks, p.rank), `${p.id}: invalid rank`);
    assert.ok(apexRankIds.includes(p.apexRank), `${p.id}: other-FPS evidence must not masquerade as an Apex rank`);
    if (p.apexRank !== 'unknown') assert.ok(typeof p.rankLabel === 'string' && p.rankLabel.trim(), `${p.id}: original Apex rank detail missing`);
    if (p.rank !== 'unknown') assert.ok(p.evidence.length > 0 || p.fpsResearch?.evidence?.length > 0, `${p.id}: rank without evidence`);
  }
  assert.equal(players.get('yukio').rank, 'former-pro');
  assert.equal(players.get('yufuna').rank, 'predator');
  assert.equal(players.get('tachibana-hinano').rank, 'predator');
  assert.deepEqual(['yukio', 'yufuna', 'tachibana-hinano'].map(id => players.get(id).rating), [10, 8, 8]);
  const beginner = players.get('takamiya-rion');
  assert.equal(beginner.apexRank, 'bronze', 'the follow-up found an actual historical Apex placement');
  assert.equal(beginner.rating, Math.max(2, beginner.fpsResearch?.points ?? 0));
  const state = C.createState(roster.players, Object.fromEntries(players));
  for (const p of research.players) {
    assert.equal(state.members[p.id].rank, p.rank, p.id);
    assert.equal(state.members[p.id].rating, p.rating, p.id);
  }
  assert.deepEqual(C.validateState(JSON.parse(JSON.stringify(state)), roster.players), state);
});

test('all eight delivered rank images match their documented official source crops and SHA256', () => {
  const attribution = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../docs/rank-icon-sources.json'), 'utf8'));
  const expected = apexRankIds.filter(rank => !['unknown', 'former-pro'].includes(rank));
  assert.deepEqual(attribution.assets.map(asset => asset.id), expected);
  assert.equal(new URL(attribution.source.pageUrl).hostname, 'help.ea.com');
  assert.equal(new URL(attribution.source.imageUrl).hostname, 'help.ea.com');
  assert.ok(attribution.rights.attribution.includes('Electronic Arts'));
  for (const asset of attribution.assets) {
    assert.equal(asset.path, `site/assets/ranks/${asset.id}.png`);
    const bytes = fs.readFileSync(path.resolve(__dirname, '..', asset.path));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.id);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', asset.id);
    assert.equal(bytes.readUInt32BE(16), asset.width, asset.id);
    assert.equal(bytes.readUInt32BE(20), asset.height, asset.id);
    assert.ok(asset.width > 20 && asset.height > 20, asset.id);
    assert.equal(asset.sourceUrl, attribution.source.imageUrl, asset.id);
    const [left, top, right, bottom] = asset.cropBox;
    assert.ok(left >= 0 && top >= 0 && right <= attribution.source.width && bottom <= attribution.source.height, asset.id);
    assert.equal(right - left, asset.width, asset.id);
    assert.equal(bottom - top, asset.height, asset.id);
  }
});

test('follow-up records cover all 37 originally unverified players and consistently reach the delivered research', () => {
  const documents = ['a', 'b', 'c'].map(group => JSON.parse(fs.readFileSync(path.resolve(__dirname, `../docs/rank-followup-${group}.json`), 'utf8')));
  const followups = documents.flatMap(document => {
    assert.ok(Number.isFinite(Date.parse(document.checkedAt)), 'follow-up date required');
    assert.ok(Array.isArray(document.players));
    return document.players;
  });
  assert.equal(followups.length, followupBaseline.length);
  assert.equal(new Set(followups.map(p => p.id)).size, followupBaseline.length, 'each person must be checked once');
  assert.deepEqual(sorted(followups.map(p => p.id)), sorted(followupBaseline));
  for (const p of followups) {
    const published = players.get(p.id);
    assert.equal(p.name, published.name, p.id);
    assert.equal(typeof p.rank, 'string', p.id);
    assert.ok(Object.hasOwn(C.ranks, p.rank), p.id);
    assert.equal(published.apexRank, p.rank, `${p.id}: follow-up not retained as the original Apex rank`);
    assert.ok(published.additionalResearch, `${p.id}: published follow-up detail missing`);
    for (const key of ['rank', 'queries', 'evidence', 'rejectedEvidence']) assert.deepEqual(published.additionalResearch[key], p[key], `${p.id}: follow-up ${key}`);
    assert.ok(Array.isArray(p.queries) && p.queries.length >= 2, `${p.id}: two or more follow-up searches required`);
    assert.ok(p.queries.every(query => typeof query === 'string' && query.trim()), p.id);
    assert.ok(new Set(p.queries).size >= 2, `${p.id}: duplicate queries do not count as additional research`);
    assert.ok(Array.isArray(p.evidence), p.id);
    assert.ok(Array.isArray(p.rejectedEvidence), p.id);
    for (const evidence of p.evidence) httpSource(evidence);
    for (const evidence of p.rejectedEvidence) if (evidence.url) httpSource(evidence);
    if (p.rank !== 'unknown') {
      assert.ok(p.evidence.length > 0, `${p.id}: rank finding requires evidence`);
      assert.ok(p.rankPeriod, `${p.id}: historical rank period missing`);
    } else if (published.rank === 'unknown') assert.equal(published.rating, 2, `${p.id}: uncertain skill uses the requested baseline without an invented achievement`);
    for (const query of p.queries) assert.ok(published.queries.includes(query), `${p.id}: follow-up query absent from distribution`);
  }
  const added = followups.filter(p => p.rank !== 'unknown').length;
  assert.equal(research.summary.followupSearched, followups.length);
  assert.equal(research.summary.followupAdded, added);
  assert.equal(research.summary.followupQueries, followups.reduce((total, player) => total + player.queries.length, 0));
  assert.equal(research.summary.apexUnknown, followups.length - added);
  assert.equal(research.summary.apexRanked, research.players.length - followups.length + added);
});

test('other-FPS research covers each player once and only improves initial points using evidence without inventing Apex achievements', () => {
  const documents = ['a', 'b', 'c'].map(group => JSON.parse(fs.readFileSync(path.resolve(__dirname, `../docs/fps-research-${group}.json`), 'utf8')));
  const fpsPlayers = documents.flatMap(document => {
    assert.ok(Number.isFinite(Date.parse(document.checkedAt)), 'FPS research date required');
    assert.equal(document.players.length, 20);
    return document.players;
  });
  assert.equal(fpsPlayers.length, roster.players.length);
  assert.equal(new Set(fpsPlayers.map(p => p.id)).size, roster.players.length);
  assert.deepEqual(sorted(fpsPlayers.map(p => p.id)), sorted(ids));
  const categoryByPoints = { 4: 'other-fps-diamond', 5: 'other-fps-master', 6: 'other-fps-top', 7: 'other-fps-pro' };
  for (const p of fpsPlayers) {
    const published = players.get(p.id);
    assert.equal(p.name, published.name, p.id);
    assert.ok(['pro', 'high', 'none'].includes(p.category), p.id);
    if (p.category === 'none') assert.equal(p.points, 0, p.id);
    if (p.category === 'pro') assert.equal(p.points, 7, p.id);
    if (p.category === 'high') assert.ok([4, 5, 6].includes(p.points), p.id);
    assert.ok(typeof p.achievement === 'string' && p.achievement.trim(), p.id);
    assert.ok(Array.isArray(p.queries) && p.queries.length > 0, `${p.id}: FPS investigation queries missing`);
    assert.ok(p.queries.every(query => typeof query === 'string' && query.trim()), p.id);
    assert.ok(Array.isArray(p.evidence) && Array.isArray(p.rejectedEvidence), p.id);
    for (const evidence of p.evidence) httpSource(evidence);
    for (const evidence of p.rejectedEvidence) if (evidence.url) httpSource(evidence);
    if (p.category !== 'none') {
      assert.ok(typeof p.game === 'string' && p.game.trim(), `${p.id}: game identity missing`);
      assert.ok(p.evidence.length > 0, `${p.id}: FPS achievement without evidence`);
    }
    assert.ok(published.fpsResearch, `${p.id}: FPS research absent from distribution`);
    for (const key of ['category', 'points', 'game', 'achievement', 'period', 'confidence', 'queries', 'evidence', 'rejectedEvidence']) assert.deepEqual(published.fpsResearch[key], p[key], `${p.id}: FPS ${key}`);
    const apexPoints = C.rankRating(published.apexRank);
    const expectedRank = p.points > apexPoints ? categoryByPoints[p.points] : published.apexRank;
    assert.equal(published.rank, expectedRank, `${p.id}: initial selection must keep Apex on equal or higher points`);
    assert.equal(published.rating, Math.max(apexPoints, p.points), p.id);
    if (apexPoints >= 7) assert.equal(published.rank, published.apexRank, `${p.id}: established Apex strength must not be downgraded`);
    if (published.rank.startsWith('other-fps-')) {
      assert.match(C.ranks[published.rank], /他FPS/, `${p.id}: classification must distinguish FPS evidence from an Apex rank`);
      assert.equal(published.fpsResearch.game, p.game, `${p.id}: the other game's identity must remain inspectable`);
    }
  }
  assert.equal(players.get('jasper').apexRank, 'diamond');
  assert.equal(players.get('jasper').rank, 'other-fps-pro');
  assert.equal(players.get('jasper').rating, 7);
  assert.equal(players.get('yutapon').apexRank, 'unknown');
  assert.equal(players.get('yutapon').rank, 'other-fps-top');
  assert.equal(players.get('yutapon').rating, 6);
  assert.equal(players.get('yutapon').fpsResearch.category, 'high', 'LoL professional status does not establish an FPS professional career');
  assert.equal(players.get('ceros').fpsResearch.category, 'high');
  assert.equal(players.get('ceros').fpsResearch.points, 6, 'national championship evidence is highest-tier evidence, not proof of a professional contract');
  assert.equal(players.get('killin9hit').apexRank, 'master');
  assert.equal(players.get('killin9hit').fpsResearch.category, 'pro');
  assert.equal(players.get('killin9hit').fpsResearch.points, 7);
  assert.equal(players.get('killin9hit').rank, 'master', 'an equal 7-point FPS career must retain the verified Apex Master classification');
  assert.equal(research.summary.fpsResearched, fpsPlayers.length);
  assert.equal(research.summary.fpsApplied, research.players.filter(p => p.rank.startsWith('other-fps-')).length);
  assert.equal(research.summary.fpsPro, fpsPlayers.filter(p => p.category === 'pro').length);
  assert.equal(research.summary.fpsHigh, fpsPlayers.filter(p => p.category === 'high').length);
  assert.equal(research.summary.fpsQueries, fpsPlayers.reduce((total, player) => total + player.queries.length, 0));
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
  assert.equal(players.get('shaka').rating, 8);
  assert.ok(players.get('shaka').evidence.some(e => e.kind === 'primary' && /プレデター/.test(`${e.title} ${e.note}`)));
});

test('research summary is calculated from the delivered records', () => {
  const rated = research.players.filter(p => p.rating !== null).length;
  assert.equal(research.summary.searched, research.players.length);
  assert.equal(research.summary.rated, rated);
  assert.equal(research.summary.unrated, research.players.length - rated);
  assert.equal(research.summary.ranked, research.players.filter(p => p.rank !== 'unknown').length);
  assert.equal(research.summary.rankUnknown, research.players.filter(p => p.rank === 'unknown').length);
  assert.equal(research.summary.apexRanked, research.players.filter(p => p.apexRank !== 'unknown').length);
  assert.equal(research.summary.apexUnknown, research.players.filter(p => p.apexRank === 'unknown').length);
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
