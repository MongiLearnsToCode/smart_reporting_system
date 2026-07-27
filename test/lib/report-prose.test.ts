import { describe, expect, it } from 'vitest';
import {
  stripFiller,
  tightenProse,
  splitSentences,
  hasFiller,
  wordCount,
} from '../../lib/report-prose';

describe('stripFiller', () => {
  it('removes conversational openers', () => {
    expect(stripFiller('Certainly! Spend totalled USD 1,200.')).toBe('Spend totalled USD 1,200.');
    expect(stripFiller('Sure, the team closed four items.')).toBe('The team closed four items.');
    expect(stripFiller('Of course! Revenue held steady.')).toBe('Revenue held steady.');
  });

  it('removes stacked preambles', () => {
    expect(stripFiller("Certainly! Here's the executive summary: Spend rose."))
      .toBe('Spend rose.');
  });

  it('removes sign-offs and offers of further help', () => {
    expect(stripFiller('Four items shipped. Let me know if you need more detail.'))
      .toBe('Four items shipped.');
    expect(stripFiller('Spend was flat. I hope this helps!')).toBe('Spend was flat.');
    expect(stripFiller('Work continues. Feel free to ask any questions.'))
      .toBe('Work continues.');
  });

  it('removes hedges wherever they appear', () => {
    expect(stripFiller('It is worth noting that spend rose 12 percent.'))
      .toBe('Spend rose 12 percent.');
    expect(stripFiller('Two items shipped. It should be noted that one slipped.'))
      .toBe('Two items shipped. One slipped.');
    expect(stripFiller('Overall, the quarter closed well.')).toBe('The quarter closed well.');
    expect(stripFiller('In summary, spend was contained.')).toBe('Spend was contained.');
  });

  it('strips markdown so the PDF gets plain prose', () => {
    expect(stripFiller('## Progress\n\n**Four** items shipped.')).toBe('Progress Four items shipped.');
    expect(stripFiller('- Item one shipped.\n- Item two slipped.'))
      .toBe('Item one shipped. Item two slipped.');
    expect(stripFiller('Spend hit `USD 400` this week.')).toBe('Spend hit USD 400 this week.');
  });

  it('collapses whitespace and fixes spacing before punctuation', () => {
    expect(stripFiller('Spend   rose .  Income fell .')).toBe('Spend rose. Income fell.');
  });

  it('leaves clean prose untouched', () => {
    const clean = 'Spend totalled USD 1,500 against USD 5,000 of income. Four items completed.';
    expect(stripFiller(clean)).toBe(clean);
  });

  it('does not mangle words that merely contain filler substrings', () => {
    // "Notably" is filler; "Note the figure" and "noted" mid-sentence are not.
    expect(stripFiller('The client noted a delay.')).toBe('The client noted a delay.');
    expect(stripFiller('Summary figures were shared.')).toBe('Summary figures were shared.');
  });

  it('handles empty and whitespace input', () => {
    expect(stripFiller('')).toBe('');
    expect(stripFiller('   \n  ')).toBe('');
  });
});

describe('splitSentences', () => {
  it('splits on terminators without breaking decimals', () => {
    expect(splitSentences('Spend hit USD 1,500.50 this week. Income followed.'))
      .toEqual(['Spend hit USD 1,500.50 this week.', 'Income followed.']);
  });

  it('returns nothing for blank text', () => {
    expect(splitSentences('  ')).toEqual([]);
  });
});

describe('tightenProse', () => {
  it('caps length to keep sections brief', () => {
    const long = 'One happened. Two happened. Three happened. Four happened. Five happened.';
    expect(tightenProse(long, 3)).toBe('One happened. Two happened. Three happened.');
  });

  it('strips filler and caps in one pass', () => {
    const raw = 'Certainly! Spend rose. Income fell. Costs held. Margins thinned. Let me know if you need more.';
    expect(tightenProse(raw, 2)).toBe('Spend rose. Income fell.');
  });

  it('terminates a truncated fragment', () => {
    expect(tightenProse('Spend rose sharply', 2)).toBe('Spend rose sharply.');
  });

  it('returns empty when nothing survives stripping', () => {
    expect(tightenProse('Certainly! Let me know if you need anything else.')).toBe('');
    expect(tightenProse('')).toBe('');
  });

  it('always allows at least one sentence', () => {
    expect(tightenProse('Spend rose. Income fell.', 0)).toBe('Spend rose.');
  });
});

describe('hasFiller', () => {
  it('detects filler that survived, for prompt-quality assertions', () => {
    expect(hasFiller('Certainly! Spend rose.')).toBe(true);
    expect(hasFiller('It is worth noting that spend rose.')).toBe(true);
    expect(hasFiller('Spend rose. Let me know if you need more.')).toBe(true);
    expect(hasFiller('Spend totalled USD 1,500. Four items completed.')).toBe(false);
  });

  it('reports clean output for everything stripFiller produces', () => {
    const samples = [
      'Certainly! Here is the summary: spend rose. I hope this helps.',
      'Overall, it is worth noting that four items shipped.',
      '**Sure**, the numbers held.',
    ];
    for (const sample of samples) {
      expect(hasFiller(stripFiller(sample))).toBe(false);
    }
  });
});

describe('wordCount', () => {
  it('counts words, not whitespace', () => {
    expect(wordCount('Spend rose sharply')).toBe(3);
    expect(wordCount('   ')).toBe(0);
  });
});
