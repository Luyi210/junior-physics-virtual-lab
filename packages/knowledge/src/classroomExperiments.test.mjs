import assert from 'node:assert/strict';
import test from 'node:test';
import { classroomExperiments, getClassroomExperiment } from '@physics-lab/knowledge/classroom';
import { highSchoolExperiments } from '@physics-lab/knowledge/high-school';

test('classroom routes retain all twenty-one junior IDs and their mode/module selectors', () => {
  const junior = classroomExperiments.filter((entry) => entry.stage === 'junior');
  assert.equal(junior.length, 21);
  assert.deepEqual(junior.slice(0, 7).map((entry) => entry.id), ['light', 'lens', 'mechanics', 'circuit', 'sound', 'thermal', 'measurement']);
  for (const entry of junior) {
    const url = new URL(entry.path, 'http://classroom.local');
    if (entry.id === 'lens') assert.equal(url.pathname, '/lab/lens');
    else if (entry.id === 'reflection') assert.equal(url.searchParams.get('mode'), 'reflection');
    else if (entry.id.includes('-')) assert.equal(url.searchParams.get('module'), entry.id);
    else assert.equal(url.pathname, `/student/explore/${entry.id}`);
  }
});

test('only ready senior-high experiments become classroom choices', () => {
  const senior = classroomExperiments.filter((entry) => entry.stage === 'high-school');
  const ready = highSchoolExperiments.filter((entry) => entry.status === 'ready');
  assert.equal(senior.length, 24);
  assert.deepEqual(senior.map((entry) => entry.id), ready.map((entry) => entry.id));
  for (const entry of ready) assert.deepEqual(getClassroomExperiment(entry.id), {
    id: entry.id, stage: 'high-school', path: `/high-school/experiments/${entry.id}`, title: entry.name,
  });
  for (const entry of highSchoolExperiments.filter((item) => item.status === 'planned')) assert.equal(getClassroomExperiment(entry.id), undefined);
});

test('the shared whitelist has unique immutable entries and contains no task or session identity', () => {
  assert.equal(new Set(classroomExperiments.map((entry) => entry.id)).size, classroomExperiments.length);
  assert.ok(Object.isFrozen(classroomExperiments));
  for (const entry of classroomExperiments) {
    assert.ok(Object.isFrozen(entry));
    assert.ok(entry.title.trim());
    const url = new URL(entry.path, 'http://classroom.local');
    assert.equal(url.origin, 'http://classroom.local');
    assert.equal(url.hash, '');
    assert.deepEqual([...url.searchParams.keys()].filter((key) => !['mode', 'module'].includes(key)), []);
  }
  for (const id of ['', 'unknown', '__proto__', 'spring-force?taskId=other']) assert.equal(getClassroomExperiment(id), undefined);
});
