import test from 'node:test';
import assert from 'node:assert/strict';
import { dayReminderPush, restTimerPush, testPush } from './push-messages.js';

test('formats server-generated notifications in English', () => {
  assert.deepEqual(restTimerPush('en'), {
    title: 'Rest over 💪',
    body: 'Time for your next set.',
    tag: 'rest-timer',
  });
  assert.deepEqual(testPush('en'), {
    title: 'SmiTriX',
    body: 'Test notification ✅ — this is what alerts look like.',
    tag: 'test',
  });
  assert.deepEqual(dayReminderPush('en', { name: 'Workout A', emoji: '💪' }), {
    title: '💪 Workout A today',
    body: "It's on your plan — let's go 💪",
    tag: 'day-reminder',
  });
});

test('keeps the existing English copy as the fallback', () => {
  assert.deepEqual(restTimerPush('fr'), restTimerPush('en'));
  assert.equal(dayReminderPush('unknown', null).title, 'Workout planned today');
  assert.equal(testPush(undefined).body, 'Test notification ✅ — this is what alerts look like.');
});

