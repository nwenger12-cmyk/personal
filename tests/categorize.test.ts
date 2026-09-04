import { describe, expect, it } from 'vitest';
import { BUILT_IN_RULES, matchCount, matchRule } from '@/lib/categorize';
import type { CategorizationRule } from '@/lib/types';

function rule(overrides: Partial<CategorizationRule> = {}): CategorizationRule {
  return {
    id: 'r1',
    match: 'adobe',
    categoryId: 'software',
    entityId: null,
    deductiblePercent: null,
    builtIn: false,
    ...overrides,
  };
}

describe('matchRule', () => {
  it('files a merchant a built-in rule covers', () => {
    expect(matchRule('ADOBE CREATIVE CLOUD', '', [])?.categoryId).toBe('software');
    expect(matchRule('AMAZON WEB SERVICES', '', [])?.categoryId).toBe('cloud-hosting');
    expect(matchRule('LENSRENTALS.COM', '', [])?.categoryId).toBe('rent-equipment');
  });

  it('returns nothing for a merchant it does not know', () => {
    expect(matchRule('SQ *SOME LOCAL VENDOR', '', [])).toBeNull();
  });

  it('searches the description too', () => {
    expect(matchRule('SQ *VENDOR', 'adobe licence resold', [])?.categoryId).toBe('software');
  });

  it('lets a user rule override a built-in for the same merchant', () => {
    const match = matchRule('ADOBE CREATIVE CLOUD', '', [
      rule({ match: 'adobe', categoryId: 'office' }),
    ]);
    expect(match?.categoryId).toBe('office');
    expect(match?.rule.builtIn).toBe(false);
  });

  it('prefers the newest user rule when two of yours both match', () => {
    const match = matchRule('ADOBE CREATIVE CLOUD', '', [
      rule({ id: 'old', match: 'adobe', categoryId: 'office' }),
      rule({ id: 'new', match: 'adobe', categoryId: 'supplies' }),
    ]);
    expect(match?.rule.id).toBe('new');
  });

  it('carries the entity and percentage a rule sets', () => {
    const match = matchRule('ADOBE', '', [
      rule({ entityId: 'biz', deductiblePercent: 80 }),
    ]);
    expect(match?.entityId).toBe('biz');
    expect(match?.deductiblePercent).toBe(80);
  });

  it('ignores a rule pointing at a category that no longer exists', () => {
    expect(matchRule('ZZZ', '', [rule({ match: 'zzz', categoryId: 'deleted' })])).toBeNull();
  });

  it('ignores an empty match rather than matching everything', () => {
    expect(matchRule('ANYTHING', '', [rule({ match: '   ' })])).toBeNull();
  });

  it('is case-insensitive both ways', () => {
    expect(matchRule('adobe creative cloud', '', [])?.categoryId).toBe('software');
    expect(matchRule('ADOBE', '', [rule({ match: 'ADOBE' })])?.categoryId).toBe('software');
  });
});

describe('built-in rules', () => {
  it('all point at categories that exist', () => {
    // A rule naming a category that was renamed would silently stop firing.
    for (const r of BUILT_IN_RULES) {
      expect(matchRule(r.match, '', [])).not.toBeNull();
    }
  });

  it('meals rules inherit the 50% cap from the category, not the rule', () => {
    const match = matchRule('DOORDASH', '', []);
    expect(match?.categoryId).toBe('meals');
    expect(match?.deductiblePercent).toBeNull();
  });
});

describe('matchCount', () => {
  it('counts how many of a batch would be filed', () => {
    const rows = [
      { merchant: 'ADOBE', description: '' },
      { merchant: 'VERCEL INC', description: '' },
      { merchant: 'UNKNOWN LLC', description: '' },
    ];
    expect(matchCount(rows, [])).toBe(2);
  });
});
