import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_COLORS_DETAIL, getCat, getCatDetail } from '../../lib/categories';

describe('CATEGORIES', () => {
  it('is exactly the PRD set', () => {
    expect(CATEGORIES).toEqual(['Finance', 'Projects', 'Clients', 'Tasks', 'Operations', 'Marketing', 'Other']);
  });

  it('has colors for every category and no legacy entries', () => {
    for (const cat of CATEGORIES) {
      expect(CATEGORY_COLORS[cat]).toBeDefined();
      expect(CATEGORY_COLORS_DETAIL[cat].chart).toMatch(/^#/);
    }
    expect(CATEGORY_COLORS.Inventory).toBeUndefined();
    expect(CATEGORY_COLORS.Team).toBeUndefined();
  });
});

describe('getCat', () => {
  it('maps PRD colors: Operations cyan, Marketing pink, Other zinc', () => {
    expect(getCat('Operations').text).toBe('text-cyan-400');
    expect(getCat('Marketing').text).toBe('text-pink-400');
    expect(getCat('Other').text).toBe('text-zinc-400');
  });

  it('falls back to zinc for unknown categories', () => {
    expect(getCat('Bogus').text).toBe('text-zinc-400');
    expect(getCatDetail('Bogus').chart).toBe('#a1a1aa');
  });
});
