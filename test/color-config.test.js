const test = require('node:test');
const assert = require('node:assert/strict');
const { getColorOrderForPlayerCount } = require('../src/rooms/RoomManager');

test('2-player games use red and yellow only', () => {
  assert.deepEqual(getColorOrderForPlayerCount(2), ['red', 'yellow']);
});

test('3-player games use yellow, red, green', () => {
  assert.deepEqual(getColorOrderForPlayerCount(3), ['yellow', 'red', 'green']);
});

test('4-player games use yellow, blue, green, red', () => {
  assert.deepEqual(getColorOrderForPlayerCount(4), ['yellow', 'blue', 'green', 'red']);
});
