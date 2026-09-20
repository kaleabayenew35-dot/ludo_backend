const test = require('node:test');
const assert = require('node:assert/strict');
const { getColorOrderForPlayerCount } = require('../src/rooms/RoomManager');

test('2-player games use red/yellow or green/blue by room', () => {
  assert.deepEqual(getColorOrderForPlayerCount(2, '10-1'), ['red', 'yellow']);
  assert.deepEqual(getColorOrderForPlayerCount(2, '10-2'), ['green', 'blue']);
});

test('3-player games use yellow, red, green', () => {
  assert.deepEqual(getColorOrderForPlayerCount(3), ['yellow', 'red', 'green']);
});

test('4-player games use yellow, blue, green, red', () => {
  assert.deepEqual(getColorOrderForPlayerCount(4), ['yellow', 'blue', 'green', 'red']);
});
