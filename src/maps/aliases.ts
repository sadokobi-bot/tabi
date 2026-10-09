/**
 * How Israelis write well-known places and areas in Japan, and the name Google Maps knows them by.
 * Hebrew transliterations rarely match Google's own entries, so these are searched in English.
 */
const ALIASES: [RegExp, string][] = [
  [/יוניברס(ל|אל)( סטודיו[סז]?)?( יפן)?/, 'Universal Studios Japan'],
  [/דיסני ?סי/, 'Tokyo DisneySea'],
  [/דיסני(לנד)?/, 'Tokyo Disneyland'],
  [/מוזיאון ג['׳]?יבלי|ג['׳]?יבלי/, 'Ghibli Museum'],
  [/טים ?לאב|טימלאב/, 'teamLab'],
  [/שיבויה סקיי/, 'Shibuya Sky'],
  [/שיבו?יה/, 'Shibuya'],
  [/שינג['׳]?וקו/, 'Shinjuku'],
  [/הרג['׳]?וקו/, 'Harajuku'],
  [/אסקוסה|אסאקוסה/, 'Asakusa'],
  [/סנסו[- ]?ג['׳]?י/, 'Senso-ji'],
  [/אקיהב[א]?רה/, 'Akihabara'],
  [/גינזה/, 'Ginza'],
  [/רופונגי/, 'Roppongi'],
  [/אודאיבה|אודייבה/, 'Odaiba'],
  [/אואנו/, 'Ueno'],
  [/צוקיג['׳]?י/, 'Tsukiji Outer Market'],
  [/טוקיו סקייטרי|סקייטרי/, 'Tokyo Skytree'],
  [/מגדל טוקיו/, 'Tokyo Tower'],
  [/מייג['׳]?י( ג['׳]?ינגו)?/, 'Meiji Jingu'],
  [/פושימי( אינארי)?/, 'Fushimi Inari Taisha'],
  [/קיומיזו(-?דרה)?/, 'Kiyomizu-dera'],
  [/קינקאקו(-?ג['׳]?י)?|מקדש הזהב/, 'Kinkaku-ji'],
  [/גינקאקו(-?ג['׳]?י)?/, 'Ginkaku-ji'],
  [/ארשיאמה|אראשיאמה|אראשייאמה|יער הבמבוק/, 'Arashiyama Bamboo Grove'],
  [/גיון/, 'Gion'],
  [/נישיקי/, 'Nishiki Market'],
  [/דוטונבורי/, 'Dotonbori'],
  [/טירת אוסקה/, 'Osaka Castle'],
  [/פארק נארה|נארה פארק/, 'Nara Park'],
  [/טודאי(-?ג['׳]?י)?/, 'Todai-ji'],
  [/הר פוג['׳]?י|פוג['׳]?י/, 'Mount Fuji'],
  [/קוואגוצ['׳]?יקו/, 'Lake Kawaguchiko'],
  [/הקונה/, 'Hakone'],
  [/מיאג['׳]?ימה|איצוקושימה/, 'Itsukushima Shrine'],
  [/פארק השלום/, 'Hiroshima Peace Memorial Park'],
  [/איצ['׳]?יראן/, 'Ichiran'],
  [/שבעה? ?אחת עשרה|סבן ?אילבן/, '7-Eleven'],
  [/דון קיחוטה|דון קישוט/, 'Don Quijote'],
  [/יודובאשי/, 'Yodobashi Camera'],
  [/ביק קמרה/, 'Bic Camera'],
  [/פוקמון סנטר|מרכז פוקימון|פוקימון סנטר/, 'Pokemon Center'],
  [/נינטנדו/, 'Nintendo Tokyo'],
  [/חב['׳״"]ד/, 'Chabad House'],
  [/נמל התעופה נריטה|נריטה/, 'Narita International Airport'],
  [/הנדה/, 'Haneda Airport'],
  [/קנסאי|נמל התעופה קנסאי/, 'Kansai International Airport'],
]

/** The English search for a Hebrew query that names a well-known place, or null. */
export function englishAlias(query: string): string | null {
  for (const [pattern, english] of ALIASES) {
    const match = query.match(pattern)
    if (match)
      return (
        query
          .replace(match[0], english)
          .replace(/[֐-׿"'׳״]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim() || english
      )
  }
  return null
}

export const hasHebrew = (text: string) => /[א-ת]/.test(text)
