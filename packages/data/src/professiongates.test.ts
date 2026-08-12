import { expect, test } from 'bun:test';
import { professionMinPlayerLevel } from './professiongates.js';

test('resolves Vanilla profession gates', () => {
  expect(professionMinPlayerLevel('vanilla', 202, 75)).toBe(5);
  expect(professionMinPlayerLevel('vanilla', 202, 76)).toBe(10);
  expect(professionMinPlayerLevel('vanilla', 202, 226)).toBe(35);
  expect(professionMinPlayerLevel('vanilla', 182, 150)).toBe(1);
  expect(professionMinPlayerLevel('vanilla', 182, 151)).toBe(10);
  expect(professionMinPlayerLevel('vanilla', 356, 226)).toBe(35);
  expect(professionMinPlayerLevel('vanilla', 129, 225)).toBe(1);
  expect(professionMinPlayerLevel('vanilla', 129, 226)).toBe(35);
});

test('resolves TBC profession gates', () => {
  expect(professionMinPlayerLevel('tbc', 202, 340)).toBe(50);
  expect(professionMinPlayerLevel('tbc', 182, 340)).toBe(25);
  expect(professionMinPlayerLevel('tbc', 356, 300)).toBe(35);
  expect(professionMinPlayerLevel('tbc', 356, 301)).toBe(45);
  expect(professionMinPlayerLevel('tbc', 185, 301)).toBe(35);
  expect(professionMinPlayerLevel('tbc', 129, 225)).toBe(1);
  expect(professionMinPlayerLevel('tbc', 129, 226)).toBe(35);
});

test('resolves WotLK profession gates', () => {
  expect(professionMinPlayerLevel('wotlk', 202, 375)).toBe(50);
  expect(professionMinPlayerLevel('wotlk', 202, 376)).toBe(65);
  expect(professionMinPlayerLevel('wotlk', 186, 350)).toBe(40);
  expect(professionMinPlayerLevel('wotlk', 186, 376)).toBe(55);
  expect(professionMinPlayerLevel('wotlk', 356, 301)).toBe(45);
  expect(professionMinPlayerLevel('wotlk', 185, 425)).toBe(1);
  expect(professionMinPlayerLevel('wotlk', 185, 426)).toBe(65);
  expect(professionMinPlayerLevel('wotlk', 129, 225)).toBe(1);
  expect(professionMinPlayerLevel('wotlk', 129, 226)).toBe(35);
});

test('returns null for absent or unresolved requirements', () => {
  expect(professionMinPlayerLevel('tbc', 0, 0)).toBeNull();
  expect(professionMinPlayerLevel('vanilla', 755, 1)).toBeNull();
  expect(professionMinPlayerLevel('tbc', 202, 376)).toBeNull();
});
