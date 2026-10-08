import type { Gender } from '@/data/types'

/**
 * Hebrew verbs and adjectives agree with gender: "מבקש" / "מבקשת". Unknown or "other" uses the
 * slash form ("מבקש/ת"), the usual neutral way to write it.
 */
export function byGender(gender: Gender | undefined, forms: { male: string; female: string }): string {
  if (gender === 'male') return forms.male
  if (gender === 'female') return forms.female
  return `${forms.male}/${forms.female.slice(forms.male.length) || forms.female}`
}
