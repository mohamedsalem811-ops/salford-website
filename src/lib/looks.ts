/**
 * The 9 occasion looks the owner picked from the template gallery (docs/feature-plan.md, "Occasion templates").
 * A look is only colours, layout, ornaments and default wording; the %, dates, words and products are set per offer.
 * Fonts that only one look uses (Reem Kufi, Aref Ruqaa) load only while that offer is live.
 */
import type { Lang } from './i18n'

export type LookId = 'ind' | 'ny' | 'rm' | 'ef' | 'md' | 'ea' | 'wf' | 'bf' | 'flash'
type Copy = { strip: string; kick: string; ttl: string; sub: string; btn: string; name: string }
export type Look = {
  id: LookId
  occasion: { ar: string; en: string }
  pick: string // which gallery design this is, for the admin
  layout: 'center' | 'photo'
  kick?: 'huge' | 'lat'
  emb?: 'flag'
  dark?: boolean
  stripCd?: boolean
  noDays?: boolean
  pct: number // suggested %
  pt?: number
  font?: 'kufi' | 'ruqaa'
  v: Record<string, string>
  orn: string
  copy: { ar: Copy; en: Copy }
}

const KU = "'Reem Kufi','Alexandria',sans-serif", RQ = "'Aref Ruqaa','Alexandria',serif", AL = "'Alexandria',sans-serif"

/* ---------- ornaments (same drawings as the gallery) ---------- */
const svg = (vb: string, body: string) => `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`
function starPts(cx: number, cy: number, R: number, r: number, n = 5) {
  const p: string[] = []
  for (let i = 0; i < 2 * n; i++) {
    const a = ((-90 + (i * 180) / n) * Math.PI) / 180, rr = i % 2 ? r : R
    p.push((cx + rr * Math.cos(a)).toFixed(2) + ',' + (cy + rr * Math.sin(a)).toFixed(2))
  }
  return p.join(' ')
}
let uid = 0
const S = {
  sparkle: (c: string) => svg('0 0 24 24', `<path fill="${c}" d="M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z"/>`),
  star: (c: string) => svg('0 0 24 24', `<polygon fill="${c}" points="${starPts(12, 12, 11.5, 4.8)}"/>`),
  crescent: (c: string) => {
    const id = 'om' + ++uid
    return svg('0 0 32 32', `<mask id="${id}"><rect width="32" height="32" fill="#fff"/><circle cx="20.5" cy="11.5" r="11" fill="#000"/></mask><circle cx="14" cy="17" r="13" fill="${c}" mask="url(#${id})"/>`)
  },
  lantern: (c: string, len: number) =>
    svg(`0 0 24 ${len + 36}`, `<path d="M12 0v${len}" stroke="${c}" stroke-width="1"/><g transform="translate(0 ${len})" stroke="${c}" stroke-width="1.3" stroke-linejoin="round"><circle cx="12" cy="2" r="1.6" fill="none"/><path d="M6 9 12 4l6 5z" fill="${c}"/><path d="M6 9h12l-1.6 17H7.6z" fill="${c}" fill-opacity=".16"/><path d="M10 9v17M14 9v17" opacity=".55"/><path d="M7.6 26h8.8l-2 4H9.6z" fill="${c}"/><path d="M12 30v4"/></g>`),
  flower: (c: string, cc: string) => svg('0 0 24 24', [0, 72, 144, 216, 288].map((a) => `<ellipse cx="12" cy="6.6" rx="3.7" ry="5.3" fill="${c}" transform="rotate(${a} 12 12)"/>`).join('') + `<circle cx="12" cy="12" r="2.8" fill="${cc}"/>`),
  bolt: (c: string) => svg('0 0 24 24', `<path fill="${c}" d="M13.5 1 3.5 13.6h6.6L8.9 23 20.5 9.6h-6.9z"/>`),
  libyaFlag: () => svg('0 0 48 24', `<rect width="48" height="6" fill="#E70013"/><rect y="6" width="48" height="12" fill="#000"/><rect y="18" width="48" height="6" fill="#239E46"/><circle cx="22.4" cy="12" r="3.6" fill="#fff"/><circle cx="23.4" cy="12" r="3" fill="#000"/><polygon fill="#fff" points="${starPts(27.2, 12, 1.8, 0.72)}"/>`),
}
type At = { top?: string; left?: string; right?: string; bottom?: string; s: number; o?: number; r?: number }
const at = (html: string, o: At) => {
  const st: string[] = []
  for (const k of ['top', 'left', 'right', 'bottom'] as const) if (o[k] != null) st.push(`${k}:${o[k]}`)
  st.push(`width:${o.s}px`)
  if (o.o != null) st.push(`opacity:${o.o}`)
  if (o.r) st.push(`transform:rotate(${o.r}deg)`)
  return `<span style="${st.join(';')}">${html}</span>`
}
const ORN = {
  sparkles: (c: string) => [at(S.sparkle(c), { top: '14px', left: '14px', s: 16, o: 0.95 }), at(S.sparkle(c), { top: '34px', right: '18px', s: 22, o: 0.85 }), at(S.sparkle(c), { bottom: '40px', left: '20px', s: 11, o: 0.7 }), at(S.sparkle(c), { bottom: '22px', right: '26px', s: 13, o: 0.75 }), at(S.sparkle(c), { top: '52%', left: '8px', s: 8, o: 0.55 }), at(S.sparkle(c), { top: '12px', right: '56px', s: 7, o: 0.6 })].join(''),
  lanterns2: (c: string) => [at(S.lantern(c, 6), { top: '0', left: '16px', s: 18, o: 0.9 }), at(S.lantern(c, 22), { top: '0', right: '20px', s: 15, o: 0.8 })].join(''),
  crescentStars: (c: string) => [at(S.crescent(c), { top: '14px', right: '16px', s: 30 }), at(S.star(c), { top: '18px', right: '52px', s: 8, o: 0.85 }), at(S.star(c), { top: '46px', right: '44px', s: 6, o: 0.7 }), at(S.star(c), { top: '22px', left: '22px', s: 7, o: 0.6 }), at(S.star(c), { bottom: '26px', left: '18px', s: 9, o: 0.7 })].join(''),
  stars: (c: string) => [at(S.star(c), { top: '16px', left: '18px', s: 14, o: 0.9 }), at(S.star(c), { top: '40px', right: '20px', s: 10, o: 0.8 }), at(S.star(c), { bottom: '28px', left: '24px', s: 8, o: 0.7 }), at(S.star(c), { bottom: '48px', right: '18px', s: 12, o: 0.8 }), at(S.star(c), { top: '14px', right: '60px', s: 6, o: 0.6 }), at(S.star(c), { top: '50%', left: '10px', s: 6, o: 0.5 })].join(''),
  flowers: (c: string, cc: string) => [at(S.flower(c, cc), { top: '-8px', left: '-8px', s: 46, o: 0.9, r: 12 }), at(S.flower(c, cc), { top: '30px', left: '34px', s: 18, o: 0.7 }), at(S.flower(c, cc), { bottom: '-10px', right: '-6px', s: 52, o: 0.85, r: -18 }), at(S.flower(c, cc), { bottom: '40px', right: '40px', s: 14, o: 0.6 })].join(''),
  bolts: (c: string) => [at(S.bolt(c), { top: '10px', left: '10px', s: 44, o: 0.22, r: -10 }), at(S.bolt(c), { bottom: '16px', right: '14px', s: 22, o: 0.6, r: 12 }), at(S.bolt(c), { top: '30px', right: '22px', s: 14, o: 0.8 })].join(''),
}
export const flagSvg = S.libyaFlag

const btnAr = 'تسوّقي الآن', btnEn = 'Shop now'
export const LOOKS: Record<LookId, Look> = {
  ind: {
    id: 'ind', occasion: { ar: 'عيد الاستقلال', en: 'Independence Day' }, pick: 'C · Salford colours + small flag', layout: 'center', emb: 'flag', pct: 24,
    v: { bg: '#FDF6F7', ink: '#33292C', sbg: '#8B4A53', sink: '#FFFFFF', hbg: 'linear-gradient(160deg,#FFF4F7,#F6D7DF)', hink: '#33292C', tink: '#8B4A53', acc: '#C27886', bbg: '#8B4A53', bink: '#FFFFFF', gbg: '#C27886', gink: '#FFFFFF', pr: '#8B4A53', cdbg: '#FFFFFF', cdink: '#8B4A53', tf: AL },
    orn: ORN.stars('#C27886'),
    copy: {
      ar: { name: 'عيد الاستقلال', strip: 'عيد الاستقلال · خصم {pct}% على كل المجوهرات', kick: '24 ديسمبر', ttl: 'عيد الاستقلال المجيد', sub: 'خصم {pct}% احتفالاً بليبيا', btn: btnAr },
      en: { name: 'Independence Day', strip: 'Independence Day · {pct}% off all jewelry', kick: '24 December', ttl: 'Happy Independence Day', sub: '{pct}% off to celebrate Libya', btn: btnEn },
    },
  },
  ny: {
    id: 'ny', occasion: { ar: 'رأس السنة', en: 'New Year' }, pick: 'A · Midnight and gold', layout: 'center', kick: 'huge', dark: true, pct: 20,
    v: { bg: '#0D1430', ink: '#EDE6D8', sbg: '#D4AF63', sink: '#0D1430', hbg: 'radial-gradient(120% 80% at 50% 0%,#1F2B5C,#0D1430 72%)', hink: '#EDE6D8', tink: '#F3E3BE', acc: '#D4AF63', bbg: '#D4AF63', bink: '#0D1430', gbg: '#D4AF63', gink: '#0D1430', pr: '#8B4A53', cdbg: 'rgba(212,175,99,.15)', cdink: '#F3E3BE', tf: AL },
    orn: ORN.sparkles('#D4AF63'),
    copy: {
      ar: { name: 'رأس السنة', strip: 'عروض رأس السنة · خصم {pct}% على كل المجوهرات', kick: '{year}', ttl: 'سنة جديدة… لمعة جديدة', sub: 'ابدئي {year} بخصم {pct}%', btn: btnAr },
      en: { name: 'New Year', strip: 'New Year offers · {pct}% off all jewelry', kick: '{year}', ttl: 'New year, new sparkle', sub: 'Start {year} with {pct}% off', btn: btnEn },
    },
  },
  rm: {
    id: 'rm', occasion: { ar: 'رمضان', en: 'Ramadan' }, pick: 'C · Cream and gold', layout: 'center', font: 'ruqaa', pct: 15,
    v: { bg: '#FBF6EC', ink: '#3B2A1A', sbg: '#B08440', sink: '#FFFFFF', hbg: 'linear-gradient(170deg,#FBF3E4,#F1E2C6)', hink: '#3B2A1A', tink: '#8A6420', acc: '#A57A35', bbg: '#3B2A1A', bink: '#FBF3E4', gbg: '#B08440', gink: '#FFFFFF', pr: '#8A6420', cdbg: '#FFFFFF', cdink: '#8A6420', tf: RQ },
    orn: ORN.crescentStars('#B08440'),
    copy: {
      ar: { name: 'رمضان', strip: 'رمضان كريم · خصم {pct}% على هدايا رمضان', kick: 'هدايا الشهر الفضيل', ttl: 'رمضان كريم', sub: 'خصم {pct}% على كل المجوهرات', btn: 'اختاري هديتك' },
      en: { name: 'Ramadan', strip: 'Ramadan Kareem · {pct}% off Ramadan gifts', kick: 'Gifts for the holy month', ttl: 'Ramadan Kareem', sub: '{pct}% off all jewelry', btn: 'Choose a gift' },
    },
  },
  ef: {
    id: 'ef', occasion: { ar: 'عيد الفطر', en: 'Eid al-Fitr' }, pick: 'A · Cream and gold stars', layout: 'center', font: 'ruqaa', pct: 20,
    v: { bg: '#FFFBF3', ink: '#3A2C17', sbg: '#8A6420', sink: '#FFF6E3', hbg: 'linear-gradient(170deg,#FFF6E6,#F3E0BB)', hink: '#3A2C17', tink: '#8A6420', acc: '#A47A2C', bbg: '#8A6420', bink: '#FFFFFF', gbg: '#B88A35', gink: '#FFFFFF', pr: '#8A6420', cdbg: 'rgba(255,255,255,.75)', cdink: '#8A6420', tf: RQ },
    orn: ORN.stars('#C49A45'),
    copy: {
      ar: { name: 'عيد الفطر', strip: 'عيد مبارك · خصم {pct}% على هدايا العيد', kick: 'عيد الفطر المبارك', ttl: 'عيدكم مبارك', sub: 'هدية العيد بخصم {pct}%', btn: btnAr },
      en: { name: 'Eid al-Fitr', strip: 'Eid Mubarak · {pct}% off Eid gifts', kick: 'Eid al-Fitr', ttl: 'Eid Mubarak', sub: 'Your Eid gift, {pct}% off', btn: btnEn },
    },
  },
  md: {
    id: 'md', occasion: { ar: 'عيد الأم', en: "Mother's Day" }, pick: 'A · Blush flowers', layout: 'center', font: 'ruqaa', pct: 15,
    v: { bg: '#FFF7F8', ink: '#4B2730', sbg: '#A2475B', sink: '#FFFFFF', hbg: 'linear-gradient(170deg,#FFF0F3,#FAD9E1)', hink: '#4B2730', tink: '#A2475B', acc: '#A85068', bbg: '#A2475B', bink: '#FFFFFF', gbg: '#C27886', gink: '#FFFFFF', pr: '#A2475B', cdbg: 'rgba(255,255,255,.78)', cdink: '#A2475B', tf: RQ },
    orn: ORN.flowers('#F3B6C3', '#E9D08A'),
    copy: {
      ar: { name: 'عيد الأم', strip: 'عيد الأم · خصم {pct}% على هدايا أمي', kick: '21 مارس', ttl: 'لأجمل أم', sub: 'هدية تليق بها — خصم {pct}%', btn: 'اختاري هديتها' },
      en: { name: "Mother's Day", strip: "Mother's Day · {pct}% off gifts for Mum", kick: '21 March', ttl: 'For the best mum', sub: 'A gift worthy of her, {pct}% off', btn: 'Choose her gift' },
    },
  },
  ea: {
    id: 'ea', occasion: { ar: 'عيد الأضحى', en: 'Eid al-Adha' }, pick: 'C · Salford colours + lanterns', layout: 'center', pt: 52, pct: 15,
    v: { bg: '#FDF6F7', ink: '#33292C', sbg: '#C27886', sink: '#FFFFFF', hbg: 'linear-gradient(160deg,#FFF4F7,#F3D2DB)', hink: '#33292C', tink: '#8B4A53', acc: '#B0606F', bbg: '#8B4A53', bink: '#FFFFFF', gbg: '#8B4A53', gink: '#FFFFFF', pr: '#8B4A53', cdbg: '#FFFFFF', cdink: '#8B4A53', tf: AL },
    orn: ORN.lanterns2('#C27886'),
    copy: {
      ar: { name: 'عيد الأضحى', strip: 'أضحى مبارك · خصم {pct}% على كل المجوهرات', kick: 'عيد الأضحى المبارك', ttl: 'أضحى مبارك', sub: 'كل عام وأنتم بخير — خصم {pct}%', btn: btnAr },
      en: { name: 'Eid al-Adha', strip: 'Eid al-Adha Mubarak · {pct}% off all jewelry', kick: 'Eid al-Adha', ttl: 'Eid al-Adha Mubarak', sub: 'Happy Eid, {pct}% off', btn: btnEn },
    },
  },
  wf: {
    id: 'wf', occasion: { ar: 'الجمعة البيضاء', en: 'White Friday' }, pick: 'C · White and mauve with photo', layout: 'photo', kick: 'lat', pct: 25,
    v: { bg: '#FFFFFF', ink: '#33292C', sbg: '#8B4A53', sink: '#FFFFFF', hbg: '#FFFFFF', hink: '#33292C', tink: '#8B4A53', acc: '#B0606F', bbg: '#8B4A53', bink: '#FFFFFF', gbg: '#8B4A53', gink: '#FFFFFF', pr: '#8B4A53', cdbg: '#FBEAEE', cdink: '#8B4A53', tf: AL },
    orn: '',
    copy: {
      ar: { name: 'الجمعة البيضاء', strip: 'الجمعة البيضاء · خصم {pct}% على كل شيء', kick: 'White Friday', ttl: 'الجمعة البيضاء', sub: 'أكبر خصم في السنة — {pct}%', btn: btnAr },
      en: { name: 'White Friday', strip: 'White Friday · {pct}% off everything', kick: 'White Friday', ttl: 'White Friday', sub: 'Our biggest sale of the year: {pct}% off', btn: btnEn },
    },
  },
  bf: {
    id: 'bf', occasion: { ar: 'بلاك فرايدي', en: 'Black Friday' }, pick: 'A · Black and gold', layout: 'center', kick: 'lat', dark: true, pct: 30,
    v: { bg: '#0E0C0D', ink: '#F3EDE3', sbg: '#CBA65E', sink: '#0E0C0D', hbg: 'radial-gradient(120% 90% at 50% 0%,#26211F,#0E0C0D 75%)', hink: '#F3EDE3', tink: '#F3EDE3', acc: '#CBA65E', bbg: '#CBA65E', bink: '#0E0C0D', gbg: '#CBA65E', gink: '#0E0C0D', pr: '#8B4A53', cdbg: 'rgba(203,166,94,.15)', cdink: '#E6CB8F', tf: AL },
    orn: ORN.sparkles('#CBA65E'),
    copy: {
      ar: { name: 'بلاك فرايدي', strip: 'بلاك فرايدي · خصم {pct}% لفترة محدودة', kick: 'Black Friday', ttl: 'بلاك فرايدي', sub: 'خصم {pct}% على كل المجوهرات', btn: btnAr },
      en: { name: 'Black Friday', strip: 'Black Friday · {pct}% off for a limited time', kick: 'Black Friday', ttl: 'Black Friday', sub: '{pct}% off all jewelry', btn: btnEn },
    },
  },
  flash: {
    id: 'flash', occasion: { ar: 'عرض 24 ساعة', en: '24-hour flash sale' }, pick: 'A · Pink alert', layout: 'center', stripCd: true, noDays: true, pct: 30,
    v: { bg: '#FFFFFF', ink: '#33292C', sbg: '#C27886', sink: '#FFFFFF', hbg: 'linear-gradient(165deg,#FFF3F6,#FBDDE5)', hink: '#33292C', tink: '#8B4A53', acc: '#A0525F', bbg: '#C27886', bink: '#FFFFFF', gbg: '#C27886', gink: '#FFFFFF', pr: '#B4566B', cdbg: '#B4566B', cdink: '#FFFFFF', tf: AL },
    orn: ORN.bolts('#C27886'),
    copy: {
      ar: { name: 'عرض 24 ساعة', strip: 'عرض 24 ساعة فقط · ينتهي قريباً', kick: 'عرض خاطف', ttl: '24 ساعة فقط', sub: 'أسعار خاصة على قطع مختارة', btn: 'الحقي العرض' },
      en: { name: '24-hour flash sale', strip: '24 hours only · ends soon', kick: 'Flash sale', ttl: '24 hours only', sub: 'Special prices on selected pieces', btn: 'Shop the sale' },
    },
  },
}
export const LOOK_IDS = Object.keys(LOOKS) as LookId[]
export const lookOf = (id: string): Look => LOOKS[(LOOK_IDS as string[]).includes(id) ? (id as LookId) : 'flash']

/** Fills {pct} and {year} in default wording. */
export const fill = (s: string, pct: number, year: number) => s.replace(/\{pct\}/g, String(pct)).replace(/\{year\}/g, String(year))

/** The offer's own words, or the look's default wording in that language. */
export function offerWords(o: { template: string; percent: number; starts_at: string; ends_at?: string; banner_ar: string; banner_en: string; sub_ar: string; sub_en: string; kicker_ar: string; kicker_en: string; caption_ar: string; caption_en: string; badge_ar: string; badge_en: string; name_ar: string; name_en: string }, lang: Lang) {
  const look = lookOf(o.template)
  const d = look.copy[lang]
  const when = o.starts_at || o.ends_at || new Date().toISOString()
  const year = Number(when.slice(0, 4)) || new Date().getUTCFullYear()
  // New Year offers often run in late December: the banner should show the coming year
  const y = look.id === 'ny' && when.slice(5, 7) === '12' ? year + 1 : year
  const pick = (ar: string, en: string, def: string) => (lang === 'ar' ? ar : en) || fill(def, o.percent, y)
  return {
    name: (lang === 'ar' ? o.name_ar : o.name_en) || (lang === 'ar' ? o.name_en : o.name_ar) || d.name,
    strip: pick(o.caption_ar, o.caption_en, d.strip),
    kick: pick(o.kicker_ar, o.kicker_en, d.kick),
    ttl: pick(o.banner_ar, o.banner_en, d.ttl),
    sub: pick(o.sub_ar, o.sub_en, d.sub),
    badge: (lang === 'ar' ? o.badge_ar : o.badge_en) || `−${o.percent}%`,
    btn: d.btn,
  }
}

/** The look's colours as CSS variables, plus the special font when it has one. */
export function lookCss(look: Look) {
  const vars = Object.entries(look.v).map(([k, x]) => `--o-${k}:${x}`).join(';')
  return `:root{${vars}}`
}
export const lookFontHref = (look: Look) =>
  look.font === 'kufi' ? 'https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@500;700&display=swap'
  : look.font === 'ruqaa' ? 'https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@700&display=swap'
  : ''
