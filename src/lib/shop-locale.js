import { isRussianLocale } from './marketing-locale.js'

const phraseReplacementsRu = [
  ['Nospieduma paraugs', 'Образец оттиска'],
  ['paštintējošs', 'автоматический'],
  ['paškrāsojošs', 'автоматический'],
  ['taisnstūra zīmogs', 'прямоугольный штамп'],
  ['kvadrātveida zīmogs', 'квадратный штамп'],
  ['apaļais zīmogs', 'круглый штамп'],
  ['ovālu nospiedumu izmēru', 'овальным размером оттиска'],
  ['ovālu teksta plāksni', 'овальной текстовой пластиной'],
  ['nospieduma izmēru', 'размером оттиска'],
  ['nospieduma laukumu', 'площадью оттиска'],
  ['diametra nospiedumu', 'оттиск диаметром'],
  ['diametru', 'диаметром'],
  ['ar vietu', 'с местом для'],
  ['līdz pat', 'до'],
  ['līdz ', 'до '],
  ['rindām,', 'строк,'],
  ['rindiņām', 'строк'],
  ['rindām', 'строк'],
  ['teksta rindām', 'строк текста'],
  ['teksta rindu', 'строк текста'],
  ['teksta', 'текста'],
  ['ideāli piemērots', 'идеально подходит'],
  ['piemērots', 'подходит'],
  ['adrešu zīmogu', 'адресных штампов'],
  ['adresēm', 'адресов'],
  ['maziem logo', 'небольших логотипов'],
  ['simboliem', 'символов'],
  ['mazām logo', 'небольших логотипов'],
  ['pielāgotiem dizainiem', 'индивидуальных дизайнов'],
  ['uzņēmuma zīmogs', 'штамп компании'],
  ['uzņēmuma nosaukumiem', 'названий компаний'],
  ['logotipiem', 'логотипов'],
  ['logotipa', 'логотипа'],
  ['notāru zīmogiem', 'нотариальных штампов'],
  ['biedrībām', 'ассоциаций'],
  ['vispārējai biznesa lietošanai', 'повседневного делового использования'],
  ['pielāgojams', 'настраиваемый'],
  ['pietiekami daudz vietas', 'достаточно места'],
  ['svarīgāko ziņu', 'самой важной информации'],
  ['kontaktinformācijas datiem', 'контактных данных'],
  ['lielākais teksta zīmogs savā kategorijā', 'один из самых вместительных текстовых штампов в своей категории'],
  ['paštintējošais zīmogs', 'автоматический штамп'],
  ['automātiskā zīmoga nospieduma paraugs', 'образец оттиска автоматического штампа'],
  ['apaļā zīmoga nospieduma paraugs', 'образец оттиска круглого штампа'],
  ['ovāla zīmoga nospieduma paraugs', 'образец оттиска овального штампа'],
  ['zīmoga nospieduma paraugs', 'образец оттиска штампа'],
]

function replaceAllFragments(text, replacements) {
  return replacements.reduce((result, [from, to]) => result.split(from).join(to), text)
}

function cleanupRussianDescription(text) {
  return text
    .replace(/\bStandart\b/g, 'Standard')
    .replace(/ir\s+автоматический/g, '— автоматический')
    .replace(/ir\s+идеально подходит/g, 'идеально подходит')
    .replace(/\bšis\s+автоматический/gi, 'Этот автоматический')
    .replace(/\bŠis\s+автоматический/g, 'Этот автоматический')
    .replace(/\bco\b/gi, 'CO')
}

function translateStampDescriptionHtml(html) {
  return cleanupRussianDescription(replaceAllFragments(html, phraseReplacementsRu))
}

function localizeCategoryName(site, category, locale) {
  if (!category) {
    return category
  }

  if (!isRussianLocale(locale)) {
    return category
  }

  const translated = site.shop.categories.find((item) => item.slug === category.slug)
  if (!translated) {
    return category
  }

  return {
    ...category,
    name: translated.title || category.name,
    description: translated.description || category.description,
  }
}

export function localizeProductForLocale(product, locale, site) {
  if (!product) {
    return product
  }

  const localized = {
    ...product,
    category: localizeCategoryName(site, product.category, locale),
  }

  if (!isRussianLocale(locale)) {
    return localized
  }

  if (localized.description && localized.category?.slug === 'zimogi') {
    localized.description = translateStampDescriptionHtml(localized.description)
  }

  return localized
}

export function localizeProductCollection(products, locale, site) {
  return (products || []).map((product) => localizeProductForLocale(product, locale, site))
}

export function localizeCategoryCollection(categories, locale, site) {
  return (categories || []).map((category) => localizeCategoryName(site, category, locale))
}

export function getLocalizedCategoryBySlug(site, slug, fallback = null) {
  return site.shop.categories.find((category) => category.slug === slug) || fallback
}
