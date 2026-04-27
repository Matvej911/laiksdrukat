const RU_PREFIX = '/ru'

const localizablePaths = new Set([
  '/',
  '/kontakti/',
  '/privatuma-politika/',
  '/pakalpojumi-kontakts',
  '/zimogs/',
  '/zimogs',
  '/vides-reklama/',
  '/vizitkartes/',
  '/baneri/',
  '/auto-aplimesana/',
  '/uzlimes/',
  '/druka/',
  '/poligrafija',
])

const localeMeta = {
  lv: {
    htmlLang: 'lv',
    ogLocale: 'lv_LV',
    switchLabel: 'RU',
    switchName: 'Русский',
  },
  ru: {
    htmlLang: 'ru',
    ogLocale: 'ru_RU',
    switchLabel: 'LV',
    switchName: 'Latviešu',
  },
}

const ui = {
  lv: {
    common: {
      brand: 'Laiks Drukāt',
      menu: 'Izvēlne',
      services: 'Pakalpojumi',
      shop: 'Veikals',
      contacts: 'Kontakti',
      cart: 'Grozs',
      viewCart: 'Skatīt grozu',
      footerBrandLead: 'Piedāvājam dažādus drukas un reklāmas risinājumus – no zīmogiem un vizītkartēm līdz banneriem un vides reklāmai.',
      footerBrandBody: 'Palīdzam realizēt jūsu idejas ātri un kvalitatīvi.',
      footerServices: 'Pakalpojumi',
      footerStore: 'E-veikals',
      footerContacts: 'Kontakti',
      footerAllProducts: 'Visas preces',
      footerStampInk: 'Zīmogu tintes',
      footerCountry: 'Latvija',
      footerRegistration: 'Reģ. Nr.',
      languageSwitcherLabel: 'Valoda',
    },
    cookie: {
      eyebrow: 'Privātums',
      title: 'Mēs cienām jūsu privātumu',
      bodyBeforeLink: 'Izmantojam sīkfailus, lai nodrošinātu vietnes darbību, analizētu apmeklējumu un uzlabotu pieredzi. Vairāk lasiet ',
      bodyLink: 'privātuma politikā',
      bodyAfterLink: '.',
      preferences: 'Pielāgot',
      reject: 'Noraidīt visu',
      accept: 'Pieņemt visus',
      manage: 'Sīkfailu iestatījumi',
      modalEyebrow: 'Sīkfaili',
      modalTitle: 'Pielāgojiet piekrišanas preferences',
      modalLead: 'Izvēlieties, kādus sīkfailus drīkstam izmantot. Nepieciešamie sīkfaili vienmēr ir aktīvi, pārējās kategorijas varat ieslēgt vai izslēgt.',
      close: 'Aizvērt',
      necessaryTitle: 'Nepieciešamie',
      necessaryBody: 'Nodrošina vietnes pamatfunkcijas, drošību un groza darbību.',
      alwaysOn: 'Vienmēr aktīvs',
      preferencesTitle: 'Preferences',
      preferencesBody: 'Saglabā jūsu izvēles un palīdz padarīt vietni ērtāku atkārtotos apmeklējumos.',
      analyticsTitle: 'Analītika',
      analyticsBody: 'Ļauj Google Analytics un Google Tag Manager saprast, kā apmeklētāji izmanto vietni.',
      marketingTitle: 'Mārketings',
      marketingBody: 'Atļauj reklāmas un atkārtotās mārketinga funkcijas, ja tās vēlāk tiks izmantotas.',
      save: 'Saglabāt manas preferences',
    },
    home: {
      city: 'Jelgava, Latvija',
      contactCta: 'Sazināties ar mums',
      shopCta: 'E-veikals',
      trustQuality: 'Augsta kvalitāte',
      trustSpeed: 'Ātra izpilde',
      trustLocation: 'Jelgavā',
      servicesHeading: 'Piedāvājam arī:',
      galleryEyebrow: 'Darbu piemēri',
      galleryTitle: 'Galerija',
      galleryText: 'Apskatiet dažādus projektus, lai iegūtu priekšstatu par mūsu iespējām',
      shopEyebrow: 'E-veikals',
      shopTitle: 'Populārākās preces',
      shopText: 'Iepērcieties ērti un ātri mūsu tiešsaistes veikalā',
      shopButton: 'Skatīt veikalu',
      vat: '+ PVN',
    },
    contact: {
      eyebrow: 'Kontakti',
      title: 'Sazinieties ar mums',
      intro: 'Vienmēr gatavi palīdzēt ar jūsu jautājumiem un pasūtījumiem.',
      mapTitle: 'Laiks Drukāt atrašanās vieta kartē',
      mapButton: 'Google Maps',
      formEyebrow: 'Sūtīt ziņu',
      formTitle: 'Nosūtīt pieprasījumu',
      formText: 'Atbildēsim pēc iespējas ātrāk.',
      success: 'Ziņa veiksmīgi nosūtīta. Sazināsimies ar jums pēc iespējas ātrāk.',
      hoursWeek: 'Pirmdiena – Ceturtdiena',
      hoursFri: 'Piektdiena',
      hoursWeekend: 'Sestdiena – Svētdiena',
      closed: 'Slēgts',
      name: 'Vārds',
      email: 'E-pasts',
      phone: 'Tālrunis',
      message: 'Jūsu ziņa',
      attachment: 'Faila pielikums',
      uploadTitle: 'Pievienot failu',
      uploadHint: 'Izvēlieties failu vai ievelciet to šeit',
      submit: 'Nosūtīt pieprasījumu',
      errors: {
        rateLimit: 'Pārāk daudz ziņu. Lūdzu mēģiniet vēlreiz pēc 15 minūtēm.',
        required: 'Lūdzu aizpildiet vārdu, e-pastu un ziņu.',
        length: 'Ziņa nedrīkst pārsniegt 180 rakstzīmes.',
      },
      serviceReturnDefault: '/kontakti/',
    },
    servicePage: {
      breadcrumbServices: 'Pakalpojumi',
      heroEyebrow: 'Pakalpojums',
      requestOffer: 'Pieprasīt piedāvājumu',
      viewShop: 'Skatīt veikalu',
      highlightsEyebrow: 'Galvenie ieguvumi',
      highlightsTitle: 'Kāpēc klienti izvēlas šo pakalpojumu',
      offeringsEyebrow: 'Ko varam izdarīt',
      offeringsTitle: 'Risinājumi šim pakalpojumam',
      detailsEyebrow: 'Svarīgi zināt',
      detailsTitle: 'Darba nianses un ieguvumi',
      pricingEyebrow: 'Cenas un budžets',
      pricingTitle: 'Orientējoša informācija',
      galleryEyebrow: 'Darbu piemēri',
      galleryTitle: 'Saistītie projekti',
      galleryText: 'Daži vizuāli piemēri, lai ātri saprastu stilu, materiālus un iespējamo rezultātu.',
      processEyebrow: 'Kā strādājam',
      processTitle: 'Vienkāršs sadarbības process',
      process: [
        { title: 'Pastāstiet vajadzību', text: 'Nosūtiet mums īsu aprakstu, izmērus, termiņu un vēlamo rezultātu.' },
        { title: 'Sagatavojam risinājumu', text: 'Ieteiksim materiālus, izstrādes pieeju un izmaksu diapazonu.' },
        { title: 'Saskaņojam detaļas', text: 'Apstiprinām maketu, precizējam termiņus un uzsākam izpildi.' },
      ],
      contactEyebrow: 'Sazināties',
      contactTitle: 'Saņem piedāvājumu',
      contactText: 'Aizpildiet formu, un mēs sazināsimies ar jums, lai sagatavotu piemērotāko risinājumu.',
      contactPhoneLabel: 'Vai vēlaties ātrāku atbildi?',
      contactSuccess: 'Ziņa veiksmīgi nosūtīta! Sazināsimies ar jums pēc iespējas ātrāk.',
      contactSubmit: 'Nosūtīt pieprasījumu',
      contactHint: 'Jo vairāk detaļu par apjomu, termiņu un materiāliem, jo precīzāku piedāvājumu varēsim sagatavot.',
    },
    breadcrumbs: {
      home: 'Sākums',
      contacts: 'Kontakti',
      privacy: 'Privātuma politika',
      services: 'Pakalpojumi',
    },
  },
  ru: {
    common: {
      brand: 'Laiks Drukāt',
      menu: 'Меню',
      services: 'Услуги',
      shop: 'Магазин',
      contacts: 'Контакты',
      cart: 'Корзина',
      viewCart: 'Открыть корзину',
      footerBrandLead: 'Мы предлагаем широкий спектр печатных и рекламных решений — от штампов и визиток до баннеров и наружной рекламы.',
      footerBrandBody: 'Помогаем быстро и качественно воплощать ваши идеи в готовый результат.',
      footerServices: 'Услуги',
      footerStore: 'Интернет-магазин',
      footerContacts: 'Контакты',
      footerAllProducts: 'Все товары',
      footerStampInk: 'Краски для штампов',
      footerCountry: 'Латвия',
      footerRegistration: 'Рег. №',
      languageSwitcherLabel: 'Язык',
    },
    cookie: {
      eyebrow: 'Конфиденциальность',
      title: 'Мы уважаем вашу приватность',
      bodyBeforeLink: 'Мы используем файлы cookie, чтобы сайт работал корректно, чтобы анализировать посещаемость и улучшать пользовательский опыт. Подробнее — в ',
      bodyLink: 'политике конфиденциальности',
      bodyAfterLink: '.',
      preferences: 'Настроить',
      reject: 'Отклонить всё',
      accept: 'Принять всё',
      manage: 'Настройки cookie',
      modalEyebrow: 'Cookie',
      modalTitle: 'Настройте параметры согласия',
      modalLead: 'Выберите, какие категории cookie вы разрешаете использовать. Обязательные cookie всегда активны, остальные можно включать и отключать по вашему выбору.',
      close: 'Закрыть',
      necessaryTitle: 'Обязательные',
      necessaryBody: 'Обеспечивают базовую работу сайта, безопасность и корректную работу корзины.',
      alwaysOn: 'Всегда активны',
      preferencesTitle: 'Предпочтения',
      preferencesBody: 'Запоминают ваши настройки и делают повторные посещения удобнее.',
      analyticsTitle: 'Аналитика',
      analyticsBody: 'Позволяет Google Analytics и Google Tag Manager понимать, как посетители пользуются сайтом.',
      marketingTitle: 'Маркетинг',
      marketingBody: 'Разрешает рекламные и ремаркетинговые функции, если они используются.',
      save: 'Сохранить мои настройки',
    },
    home: {
      city: 'Елгава, Латвия',
      contactCta: 'Связаться с нами',
      shopCta: 'Интернет-магазин',
      trustQuality: 'Высокое качество',
      trustSpeed: 'Быстрое выполнение',
      trustLocation: 'В Елгаве',
      servicesHeading: 'Также предлагаем:',
      galleryEyebrow: 'Примеры работ',
      galleryTitle: 'Галерея',
      galleryText: 'Посмотрите на разные проекты, чтобы понять наши возможности и визуальный уровень работ.',
      shopEyebrow: 'Интернет-магазин',
      shopTitle: 'Популярные товары',
      shopText: 'Покупайте быстро и удобно в нашем онлайн-магазине',
      shopButton: 'Перейти в магазин',
      vat: '+ НДС',
    },
    contact: {
      eyebrow: 'Контакты',
      title: 'Свяжитесь с нами',
      intro: 'Мы всегда готовы помочь с вопросами, заказами и подбором подходящего решения.',
      mapTitle: 'Местоположение Laiks Drukāt на карте',
      mapButton: 'Google Maps',
      formEyebrow: 'Отправить сообщение',
      formTitle: 'Оставить запрос',
      formText: 'Мы ответим вам как можно быстрее.',
      success: 'Сообщение успешно отправлено. Мы свяжемся с вами в ближайшее время.',
      hoursWeek: 'Понедельник – Четверг',
      hoursFri: 'Пятница',
      hoursWeekend: 'Суббота – Воскресенье',
      closed: 'Закрыто',
      name: 'Имя',
      email: 'Эл. почта',
      phone: 'Телефон',
      message: 'Ваше сообщение',
      attachment: 'Вложение',
      uploadTitle: 'Прикрепить файл',
      uploadHint: 'Выберите файл или перетащите его сюда',
      submit: 'Отправить запрос',
      errors: {
        rateLimit: 'Слишком много сообщений. Пожалуйста, попробуйте снова через 15 минут.',
        required: 'Пожалуйста, заполните имя, e-mail и сообщение.',
        length: 'Сообщение не должно превышать 180 символов.',
      },
      serviceReturnDefault: '/ru/kontakti/',
    },
    servicePage: {
      breadcrumbServices: 'Услуги',
      heroEyebrow: 'Услуга',
      requestOffer: 'Запросить предложение',
      viewShop: 'Смотреть магазин',
      highlightsEyebrow: 'Главные преимущества',
      highlightsTitle: 'Почему этот формат выбирают клиенты',
      offeringsEyebrow: 'Что мы можем сделать',
      offeringsTitle: 'Варианты решений для этой услуги',
      detailsEyebrow: 'Важно знать',
      detailsTitle: 'Практические детали и преимущества',
      pricingEyebrow: 'Цена и бюджет',
      pricingTitle: 'Ориентировочная информация',
      galleryEyebrow: 'Примеры работ',
      galleryTitle: 'Связанные проекты',
      galleryText: 'Несколько визуальных примеров, чтобы быстрее понять стиль, материалы и возможный результат.',
      processEyebrow: 'Как мы работаем',
      processTitle: 'Простой процесс сотрудничества',
      process: [
        { title: 'Опишите задачу', text: 'Расскажите, что нужно изготовить, в каком объёме и к какому сроку.' },
        { title: 'Подберём решение', text: 'Предложим материалы, подход к производству и ориентировочную стоимость.' },
        { title: 'Согласуем детали', text: 'Уточним макет, сроки и запустим работу после подтверждения.' },
      ],
      contactEyebrow: 'Связаться',
      contactTitle: 'Получить предложение',
      contactText: 'Заполните форму, и мы свяжемся с вами, чтобы обсудить проект и подготовить предложение.',
      contactPhoneLabel: 'Нужен быстрый ответ?',
      contactSuccess: 'Сообщение успешно отправлено! Мы свяжемся с вами в ближайшее время.',
      contactSubmit: 'Отправить запрос',
      contactHint: 'Чем точнее вы опишете тираж, размеры, материал и сроки, тем быстрее мы подготовим точный ответ.',
    },
    breadcrumbs: {
      home: 'Главная',
      contacts: 'Контакты',
      privacy: 'Политика конфиденциальности',
      services: 'Услуги',
    },
  },
}

const russianSiteCopy = {
  meta: {
    description: 'Печать и рекламные решения в Елгаве: штампы, баннеры, наклейки, оклейка автомобилей, визитки и наружная реклама. Поможем быстро, аккуратно и с понятным результатом.',
  },
  home: {
    eyebrow: 'Печать и реклама в Елгаве',
    title: 'Ваши идеи — наши решения!',
    intro: 'Помогаем компаниям и частным клиентам с печатью, оформлением и рекламными материалами — от первого запроса до готового результата.',
    heroAlt: 'Работы Laiks Drukāt и печатная продукция',
  },
  shop: {
    intro: 'Популярные товары',
    categories: {
      zimogi: {
        title: 'Штампы',
        description: 'Автоматические штампы COLOP, датеры, круглые модели и карманные варианты.',
      },
      'zimogu-tintes': {
        title: 'Краски для штампов',
        description: 'Чернила и сменные подушки для ежедневного использования и обновления штампов.',
      },
    },
  },
  services: {
    zimogi: {
      menuTitle: 'Штампы и печати',
      title: 'Штампы и печати',
      teaser: 'Изготавливаем штампы и печати для компаний, учреждений и частных клиентов. Быстрый запуск, аккуратный макет и надёжные механизмы COLOP.',
      intro: 'Делаем штампы для документов, офиса и ежедневной работы: под реквизиты компании, подпись, дату, адрес и другие задачи. Поможем с макетом, подскажем подходящий формат и подготовим всё к использованию.',
      heroAlt: 'Автоматический штамп COLOP',
      highlights: [
        { value: '2–4', label: 'рабочих дня' },
        { value: '100%', label: 'индивидуальный макет' },
        { value: 'COLOP', label: 'надёжные механизмы' },
      ],
      offerings: [
        { title: 'Штампы для компаний', text: 'Классические штампы с реквизитами, адресом, регистрационными данными и другой деловой информацией.' },
        { title: 'Именные и служебные печати', text: 'Варианты для сотрудников, складов, бухгалтерии, входящей корреспонденции и внутреннего документооборота.' },
        { title: 'Подбор комплектации', text: 'Подскажем подходящий размер, форму и модель, а при необходимости добавим запасную краску или подушку.' },
      ],
      details: [
        'Макет подготавливаем по вашим данным или на основе существующего образца.',
        'Если нужен срочный вариант, заранее подскажем самый быстрый формат исполнения.',
        'Для повседневной работы используем практичные автоматические механизмы.',
      ],
      pricing: [
        { title: 'Итоговая цена зависит от модели', text: 'На стоимость влияет формат штампа, конструкция, сложность макета и дополнительные позиции.' },
        { title: 'Быстрый расчёт по сообщению', text: 'Если пришлёте текст, желаемый размер и пример, мы быстро подготовим точное предложение.' },
      ],
    },
    'vides-reklama': {
      menuTitle: 'Наружная реклама',
      title: 'Наружная реклама',
      teaser: 'Вывески, световые короба, объёмные буквы и фасадные решения для бизнеса. Помогаем сделать заметный и аккуратный визуальный образ на улице и в торговом пространстве.',
      intro: 'Разрабатываем и изготавливаем наружную рекламу для магазинов, офисов, салонов и производств. Подскажем формат, материалы и монтажное решение, чтобы реклама работала долго и выглядела уверенно.',
      heroAlt: 'Световой короб и наружная реклама',
      highlights: [
        { value: 'От идеи', label: 'до монтажа' },
        { value: 'Для улицы', label: 'и помещений' },
        { value: 'Под бренд', label: 'и локацию' },
      ],
      offerings: [
        { title: 'Вывески и фасадные решения', text: 'Для магазинов, офисов и точек обслуживания — с учётом читаемости, масштаба и места установки.' },
        { title: 'Световые короба и буквы', text: 'Помогаем подобрать яркость, материалы и конструкцию, чтобы реклама оставалась заметной и аккуратной.' },
        { title: 'Подготовка и монтаж', text: 'Сопровождаем проект от визуального решения до финальной установки на объекте.' },
      ],
      details: [
        'На итог влияет размер конструкции, тип подсветки и сложность монтажа.',
        'Всегда оцениваем читаемость на расстоянии и общую уместность вывески в среде.',
        'При необходимости адаптируем дизайн под уже существующий фирменный стиль.',
      ],
      pricing: [
        { title: 'Каждый проект считается отдельно', text: 'Наружная реклама почти всегда требует индивидуального расчёта, потому что параметры сильно отличаются.' },
        { title: 'Быстрее всего считать по фото и размерам', text: 'Если пришлёте фото места, примерный размер и задачу, мы быстрее предложим рабочий вариант.' },
      ],
    },
    vizitkartes: {
      menuTitle: 'Визитки',
      title: 'Визитки',
      teaser: 'Изготавливаем визитки для бизнеса, специалистов и брендов: стандартная печать, выразительные материалы и аккуратная подача, которая работает на первое впечатление.',
      intro: 'Визитка — это короткая, но важная точка контакта. Мы помогаем сделать её понятной, аккуратной и визуально сильной: от лаконичных вариантов до более выразительных решений для бренда.',
      heroAlt: 'Визитки',
      highlights: [
        { value: 'Разные', label: 'форматы и бумаги' },
        { value: 'От простых', label: 'до эффектных решений' },
        { value: 'Быстро', label: 'и аккуратно' },
      ],
      offerings: [
        { title: 'Классические визитки', text: 'Чистый и понятный формат для повседневных деловых задач, встреч и раздаточных материалов.' },
        { title: 'Более выразительные варианты', text: 'Поможем подобрать бумагу, отделку и подачу, если нужен более запоминающийся результат.' },
        { title: 'Подготовка макета', text: 'Можем доработать ваш файл или собрать аккуратный дизайн с нуля под конкретную сферу.' },
      ],
      details: [
        'Важно не только красиво оформить визитку, но и правильно расставить акценты в информации.',
        'Подскажем, когда лучше выбрать минимализм, а когда стоит добавить выразительные детали.',
        'Если нужен единый стиль, адаптируем визитки под существующий фирменный образ компании.',
      ],
      pricing: [
        { title: 'Цена зависит от тиража и материалов', text: 'На стоимость влияют бумага, формат, отделка и объём печати.' },
        { title: 'Можно начать с базового варианта', text: 'Если бюджет ограничен, подберём рабочее решение без лишних декоративных элементов.' },
      ],
    },
    baneri: {
      menuTitle: 'Баннеры',
      title: 'Баннеры',
      teaser: 'Печатаем баннеры для улицы, мероприятий, фасадов и торговых точек: roll-up, PVC и другие форматы с понятной подачей и ярким результатом.',
      intro: 'Баннер должен быть заметным, читаемым и устойчивым к условиям использования. Мы помогаем подобрать подходящий формат, материал и конструкцию для конкретной задачи и места размещения.',
      heroAlt: 'PVC рекламные баннеры',
      highlights: [
        { value: 'Для улицы', label: 'и помещений' },
        { value: 'Яркая', label: 'полноцветная печать' },
        { value: 'Roll-up', label: 'и классические баннеры' },
      ],
      offerings: [
        { title: 'PVC баннеры', text: 'Для фасадов, ограждений, мероприятий, акций и других ситуаций, где нужна заметная подача.' },
        { title: 'Roll-up стенды', text: 'Удобное решение для презентаций, выставок, торговых точек и внутренних мероприятий.' },
        { title: 'Подготовка под размещение', text: 'Поможем учесть размер, точки крепления, отступы и читаемость на расстоянии.' },
      ],
      details: [
        'Размер и место размещения напрямую влияют на то, как должен выглядеть макет.',
        'Для улицы особенно важно правильно подобрать материал и крепёж.',
        'Если баннер нужен срочно, предложим практичный формат с быстрым запуском.',
      ],
      pricing: [
        { title: 'Стоимость зависит от формата', text: 'На цену влияют размеры, материал, постобработка и способ крепления.' },
        { title: 'Быстрее всего оценивать по задаче', text: 'Напишите, где будет использоваться баннер и какой размер нужен — подготовим понятный расчёт.' },
      ],
    },
    'auto-aplimesana': {
      menuTitle: 'Оклейка авто',
      title: 'Оклейка автомобилей',
      teaser: 'Оклейка автомобилей для рекламы, фирменного стиля и навигации. Работаем с частичной и более объёмной оклейкой, помогая найти практичный вариант под задачу.',
      intro: 'Автомобиль может стать заметным носителем рекламы или аккуратным продолжением фирменного стиля. Мы помогаем подобрать формат оклейки, который хорошо выглядит и работает в реальной эксплуатации.',
      heroAlt: 'Оклейка автомобиля',
      highlights: [
        { value: '3M / Oracal', label: 'плёнки' },
        { value: 'От небольших', label: 'элементов до комплектов' },
        { value: 'Для бизнеса', label: 'и частных авто' },
      ],
      offerings: [
        { title: 'Рекламная оклейка', text: 'Логотипы, контакты, фирменные элементы и визуальные акценты для служебного транспорта.' },
        { title: 'Частичные решения', text: 'Если не нужна полная оклейка, подберём локальные элементы, которые дают хороший эффект без перегруза.' },
        { title: 'Подготовка макета', text: 'Учитываем форму кузова, швы, ручки и другие особенности, чтобы графика выглядела аккуратно.' },
      ],
      details: [
        'Перед запуском важно понять, какие зоны машины реально работают визуально.',
        'Подскажем баланс между заметностью, бюджетом и сроком службы решения.',
        'Если у вас уже есть фирменный стиль, адаптируем его под геометрию автомобиля.',
      ],
      pricing: [
        { title: 'Цена зависит от масштаба оклейки', text: 'На стоимость влияют площадь, сложность макета, тип плёнки и особенности кузова.' },
        { title: 'Проще считать по фото автомобиля', text: 'Фото машины и краткое описание задачи позволяют быстрее дать ориентир по бюджету.' },
      ],
    },
    uzlimes: {
      menuTitle: 'Наклейки',
      title: 'Наклейки',
      teaser: 'Печатаем наклейки и этикетки для упаковки, витрин, продукции и рекламы. Подберём формат, материал и подачу под ваш сценарий использования.',
      intro: 'Наклейки часто выглядят просто, но именно детали определяют, насколько они удобны в применении и хорошо смотрятся вживую. Мы помогаем подобрать решение под продукт, упаковку, рекламу или оформление пространства.',
      heroAlt: 'Наклейки и этикетки',
      highlights: [
        { value: 'Для упаковки', label: 'и рекламы' },
        { value: 'Разные', label: 'форматы и тиражи' },
        { value: 'Под задачу', label: 'и материал' },
      ],
      offerings: [
        { title: 'Этикетки для продукции', text: 'Подходят для упаковки, маркировки, серий товаров и локального брендинга.' },
        { title: 'Рекламные наклейки', text: 'Для витрин, акций, промо и визуальных сообщений внутри и снаружи помещения.' },
        { title: 'Подбор материала', text: 'Поможем понять, нужен ли акцент на внешнем виде, стойкости или удобстве нанесения.' },
      ],
      details: [
        'Сразу учитываем, куда будет клеиться наклейка и как она будет использоваться.',
        'Подскажем, когда нужен более практичный формат, а когда важнее визуальный эффект.',
        'Если есть несколько позиций или размеров, поможем собрать понятную систему под весь проект.',
      ],
      pricing: [
        { title: 'Стоимость зависит от объёма и материала', text: 'На цену влияют размер, тираж, способ печати и выбранная основа.' },
        { title: 'Можно посчитать по образцу', text: 'Если у вас есть пример существующей наклейки или упаковки, это ускорит расчёт.' },
      ],
    },
    druka: {
      menuTitle: 'Буклеты, брошюры, флаеры',
      title: 'Буклеты, брошюры, флаеры и другая печатная продукция',
      teaser: 'Печатная продукция для бизнеса, мероприятий и рекламы: буклеты, листовки, брошюры, плакаты и другие материалы с понятной структурой и аккуратной подачей.',
      intro: 'Когда материал должен не просто выглядеть красиво, а действительно доносить информацию, важны структура, формат и правильная подготовка к печати. Мы помогаем с этим на каждом этапе.',
      heroAlt: 'Буклеты и печатные материалы',
      highlights: [
        { value: 'От идеи', label: 'до готового файла' },
        { value: 'Для промо', label: 'и деловых задач' },
        { value: 'Разные', label: 'форматы печати' },
      ],
      offerings: [
        { title: 'Флаеры и листовки', text: 'Для акций, объявлений, раздаточных материалов и локальных рекламных кампаний.' },
        { title: 'Буклеты и брошюры', text: 'Подходят для более содержательной подачи услуг, продукции и предложений компании.' },
        { title: 'Дизайн и подготовка', text: 'Можем помочь как с доработкой готового файла, так и с созданием макета с нуля.' },
      ],
      details: [
        'Печатные материалы работают лучше, когда в них хорошо выстроена иерархия информации.',
        'Помогаем подобрать формат не только “красивый”, но и уместный для конкретной задачи.',
        'Если материалы входят в одну кампанию, можем удержать единый визуальный стиль во всех носителях.',
      ],
      pricing: [
        { title: 'Цена зависит от формата и объёма', text: 'На итоговую стоимость влияют размер, количество страниц, бумага, тираж и подготовка макета.' },
        { title: 'Лучше всего считать по задаче', text: 'Если вы опишете, что именно хотите раздавать или показывать клиенту, мы предложим разумный формат и бюджет.' },
      ],
    },
  },
}

function buildFallbackGallery(site, service, index) {
  const offset = (index * 4) % Math.max(site.portfolioSlider.length || 1, 1)
  const gallery = site.portfolioSlider
    .slice(offset, offset + 6)
    .map((item) => ({ image: item.image, alt: item.alt || service.title }))

  return gallery.length > 0
    ? gallery
    : [{ image: service.heroImage || site.meta.defaultShareImage, alt: service.heroAlt || service.title }]
}

export function localizeSiteContent(site, locale = 'lv') {
  if (!isRussianLocale(locale)) {
    return site
  }

  const localized = structuredClone(site)
  localized.meta.description = russianSiteCopy.meta.description
  localized.home = {
    ...localized.home,
    ...russianSiteCopy.home,
  }
  localized.shop = {
    ...localized.shop,
    intro: russianSiteCopy.shop.intro,
    categories: localized.shop.categories.map((category) => ({
      ...category,
      ...(russianSiteCopy.shop.categories[category.slug] || {}),
    })),
  }

  localized.services = localized.services.map((service, index) => {
    const translation = russianSiteCopy.services[service.slug]
    if (!translation) {
      return service
    }

    return {
      ...service,
      ...translation,
      gallery: translation.gallery || buildFallbackGallery(localized, service, index),
    }
  })

  localized.portfolio = localized.services
    .filter((service) => service.slug !== 'zimogi')
    .map((service) => ({
      image: service.heroImage,
      title: service.title,
      path: service.path,
    }))

  return localized
}

export function buildServiceRouteEntries(site) {
  return site.services.flatMap((service) => [
    { path: service.path, service, canonical: true },
    ...service.aliases.map((alias) => ({ path: alias, service, canonical: false })),
  ])
}

export function getLocaleMeta(locale = 'lv') {
  return localeMeta[locale] || localeMeta.lv
}

export function getUiCopy(locale = 'lv') {
  return ui[locale] || ui.lv
}

export function isRussianLocale(locale = 'lv') {
  return locale === 'ru'
}

function splitPathParts(path = '/') {
  const value = String(path || '/')
  const hashIndex = value.indexOf('#')
  const queryIndex = value.indexOf('?')
  let cutIndex = -1

  if (hashIndex >= 0 && queryIndex >= 0) {
    cutIndex = Math.min(hashIndex, queryIndex)
  } else {
    cutIndex = Math.max(hashIndex, queryIndex)
  }

  if (cutIndex === -1) {
    return { pathname: value || '/', suffix: '' }
  }

  return {
    pathname: value.slice(0, cutIndex) || '/',
    suffix: value.slice(cutIndex),
  }
}

export function stripRussianPrefix(path = '/') {
  const { pathname, suffix } = splitPathParts(path)
  if (pathname === RU_PREFIX) {
    return `/${suffix}`
  }
  if (pathname.startsWith(`${RU_PREFIX}/`)) {
    return `${pathname.slice(RU_PREFIX.length)}${suffix}` || `/${suffix}`
  }
  return path
}

export function localizePath(locale = 'lv', path = '/') {
  const { pathname, suffix } = splitPathParts(path)
  const normalized = pathname || '/'

  if (!isRussianLocale(locale)) {
    return normalized === '/' ? `/${suffix}` : `${normalized}${suffix}`
  }

  if (!localizablePaths.has(normalized)) {
    return normalized === '/' ? `${RU_PREFIX}/${suffix}`.replace(/\/+$/, '/') : `${normalized}${suffix}`
  }

  if (normalized === '/') {
    return `${RU_PREFIX}/${suffix}`.replace(/\/+$/, '/')
  }

  return `${RU_PREFIX}${normalized}${suffix}`
}

export function buildLanguageSwitcher(currentPath = '/', currentLocale = 'lv') {
  const targetLocale = currentLocale === 'ru' ? 'lv' : 'ru'
  const meta = getLocaleMeta(currentLocale)
  const basePath = stripRussianPrefix(currentPath)
  let href = localizePath(targetLocale, basePath)
  const { pathname } = splitPathParts(basePath)

  if (!localizablePaths.has(pathname) && href === basePath) {
    href = localizePath(targetLocale, '/')
  }

  return {
    currentLocale,
    targetLocale,
    label: meta.switchLabel,
    name: meta.switchName,
    href,
  }
}
