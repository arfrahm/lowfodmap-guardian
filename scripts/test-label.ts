import { cleanLabelText } from '../src/lib/ocrCleanup';
import { analyzeLabelText } from '../src/lib/classify';
import { parseIngredientText } from '../src/lib/parseIngredients';

const garbage =
  'vent ty LCALS CLUE Bt . VMK lo FRE / - ody LN y | nt s0 dang complicated, Yi digin at lundberg.com';
const goodish =
  "INGREDIEX'TS: *Regenerative Organic Certified ysrown Rice, Sea Salt. *Organic ingredient Manufactured & Distributed by: Lundberg Family Farms";
const paste =
  'Ingredients: Regenerative Organic Certified Brown Rice, Sea Salt. (*Organic ingredient)';

for (const [label, t] of [
  ['garbage', garbage],
  ['goodish', goodish],
  ['paste', paste],
] as const) {
  const c = cleanLabelText(t);
  console.log('\n', label, 'quality=', c.quality, 'garbage=', c.looksLikeGarbage);
  console.log('cleaned:', c.text);
  console.log('warnings:', c.warnings);
  console.log('parsed:', parseIngredientText(c.text || t));
  const a = analyzeLabelText(t);
  console.log(
    'verdict',
    a.overall,
    a.ingredients.map((i) => `${i.raw}=>${i.matchedName}/${i.level}`),
  );
}
