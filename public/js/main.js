const hamburger = document.querySelector('.hamburger')
const navLinks = document.querySelector('.nav-links')

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('nav-open')
    hamburger.setAttribute('aria-expanded', String(isOpen))
  })
}

document.querySelectorAll('[data-slider]').forEach((slider) => {
  const track = slider.querySelector('[data-slider-track]')
  const slides = Array.from(slider.querySelectorAll('[data-slide]'))
  const dots = Array.from(slider.querySelectorAll('[data-slider-dot]'))
  const prev = slider.querySelector('[data-slider-prev]')
  const next = slider.querySelector('[data-slider-next]')

  if (!track || slides.length <= 1) {
    return
  }

  let index = 0
  let timer = null

  const render = () => {
    const offset = slides[index]?.offsetLeft ?? 0
    track.style.transform = `translateX(-${offset}px)`

    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle('is-active', dotIndex === index)
    })
  }

  const goTo = (nextIndex) => {
    index = (nextIndex + slides.length) % slides.length
    render()
  }

  const start = () => {
    timer = window.setInterval(() => {
      goTo(index + 1)
    }, 5000)
  }

  const stop = () => {
    if (timer) {
      window.clearInterval(timer)
      timer = null
    }
  }

  prev?.addEventListener('click', () => goTo(index - 1))
  next?.addEventListener('click', () => goTo(index + 1))

  dots.forEach((dot, dotIndex) => {
    dot.addEventListener('click', () => goTo(dotIndex))
  })

  slider.addEventListener('mouseenter', stop)
  slider.addEventListener('mouseleave', start)
  window.addEventListener('resize', render)

  render()
  start()
})

const nameInput = document.querySelector('input[name="name"]')
const slugInput = document.querySelector('input[name="slug"]')

if (nameInput && slugInput && !slugInput.value) {
  nameInput.addEventListener('input', () => {
    slugInput.value = nameInput.value
      .toLowerCase()
      .replace(/[āa]/g, 'a')
      .replace(/[čc]/g, 'c')
      .replace(/[ēe]/g, 'e')
      .replace(/[ģg]/g, 'g')
      .replace(/[īi]/g, 'i')
      .replace(/[ķk]/g, 'k')
      .replace(/[ļl]/g, 'l')
      .replace(/[ņn]/g, 'n')
      .replace(/[šs]/g, 's')
      .replace(/[ūu]/g, 'u')
      .replace(/[žz]/g, 'z')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  })
}

document.querySelectorAll('[data-delivery-method]').forEach((select) => {
  const form = select.closest('form')
  const addressGroup = form?.querySelector('[data-delivery-address-group]')
  const addressInput = form?.querySelector('[data-delivery-address-input]')

  if (!addressGroup || !addressInput) {
    return
  }

  const syncDeliveryAddress = () => {
    const requiresAddress = select.value.toLowerCase().includes('pakom')
    addressGroup.hidden = !requiresAddress
    addressInput.required = requiresAddress

    if (!requiresAddress) {
      addressInput.value = ''
    }
  }

  select.addEventListener('change', syncDeliveryAddress)
  syncDeliveryAddress()
})

const messageInput = document.querySelector('[data-message-input]')
const messageCount = document.querySelector('[data-message-count]')

if (messageInput && messageCount) {
  const syncMessageCount = () => {
    messageCount.textContent = String(messageInput.value.length)
  }

  messageInput.addEventListener('input', syncMessageCount)
  syncMessageCount()
}

const fileInput = document.querySelector('[data-file-input]')
const fileLabel = document.querySelector('[data-file-label]')

if (fileInput && fileLabel) {
  fileInput.addEventListener('change', () => {
    fileLabel.textContent = fileInput.files?.[0]?.name || 'Izvēlieties failu vai ievelciet to šeit'
  })
}

document.querySelectorAll('.products-slider-wrapper').forEach((sliderWrapper) => {
  const slider = sliderWrapper.querySelector('.products-slider');
  const track = sliderWrapper.querySelector('.products-slider-track');

  if (!slider || !track) return;

  const gap = 30;
  const prevButton = sliderWrapper.querySelector('.slider-btn.left');
  const nextButton = sliderWrapper.querySelector('.slider-btn.right');
  const getVisibleCount = () => {
    if (window.innerWidth <= 640) return 1;
    if (window.innerWidth <= 1024) return 2;
    return 3;
  };
  const originalCards = Array.from(slider.children);
  const totalOriginal = originalCards.length;
  let step = 0;
  let scrollAmount = 0;
  let isTransitioning = false;
  let loopingEnabled = false;

  function rebuildSlider() {
    const visibleCount = getVisibleCount();
    loopingEnabled = totalOriginal > visibleCount;

    slider.replaceChildren(...originalCards);

    if (loopingEnabled) {
      originalCards.forEach((card) => {
        const clone = card.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        slider.appendChild(clone);
      });
    }

    if (prevButton) prevButton.style.display = loopingEnabled ? '' : 'none';
    if (nextButton) nextButton.style.display = loopingEnabled ? '' : 'none';
  }

  function setCardWidths() {
    const visibleCount = getVisibleCount();
    const cardWidth = (track.offsetWidth - gap * (visibleCount - 1)) / visibleCount;
    Array.from(slider.children).forEach((card) => {
      card.style.flex = `0 0 ${cardWidth}px`;
      card.style.width = `${cardWidth}px`;
    });
    step = cardWidth + gap;
  }

  function scrollSlider(direction) {
    if (!loopingEnabled || isTransitioning || !step) return;
    isTransitioning = true;

    scrollAmount += direction * step;
    slider.style.transition = 'transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    slider.style.transform = `translateX(${-scrollAmount}px)`;
  }

  prevButton?.addEventListener('click', () => scrollSlider(-1));
  nextButton?.addEventListener('click', () => scrollSlider(1));

  slider.addEventListener('transitionend', (e) => {
    if (e.target !== slider) return;
    if (e.propertyName !== 'transform') return;

    isTransitioning = false;
    const maxScroll = step * totalOriginal;

    if (scrollAmount >= maxScroll) {
      scrollAmount -= maxScroll;
      slider.style.transition = 'none';
      slider.style.transform = `translateX(${-scrollAmount}px)`;
    } else if (scrollAmount < 0) {
      scrollAmount += maxScroll;
      slider.style.transition = 'none';
      slider.style.transform = `translateX(${-scrollAmount}px)`;
    }
  });

  function resetSlider() {
    rebuildSlider();
    setCardWidths();
    scrollAmount = 0;
    isTransitioning = false;
    slider.style.transition = 'none';
    slider.style.transform = 'translateX(0)';
  }

  window.addEventListener('resize', resetSlider);

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', resetSlider, { once: true });
  } else {
    resetSlider();
  }
});

















// ── Portfolio infinite loop ────────────────────────────────
const portfolioControllers = new Map()

document.querySelectorAll('.portfolio-track').forEach((portfolioTrack) => {
  const portfolioOriginals = Array.from(portfolioTrack.children)
  const totalOriginal = portfolioOriginals.length
  let currentIndex = 0
  let isPortfolioTransitioning = false
  let pendingPortfolioReset = null
  let originalOffsets = []
  let cloneOffsets = []
  let portfolioInitRaf = null

  if (totalOriginal <= 1) {
    return
  }

  portfolioOriginals.forEach((item) => {
    const clone = item.cloneNode(true)
    clone.setAttribute('aria-hidden', 'true')
    portfolioTrack.appendChild(clone)
  })

  function setPortfolioPosition(offset, animated = false) {
    portfolioTrack.style.transition = animated ? 'transform 0.45s ease' : 'none'
    portfolioTrack.style.transform = `translateX(-${offset}px)`
  }

  function measurePortfolio() {
    const items = Array.from(portfolioTrack.children)
    originalOffsets = items.slice(0, totalOriginal).map((item) => item.offsetLeft)
    cloneOffsets = items.slice(totalOriginal).map((item) => item.offsetLeft)
  }

  function initPortfolio(keepIndex = true) {
    measurePortfolio()

    if (!originalOffsets.length) return

    if (!keepIndex) {
      currentIndex = 0
    } else {
      currentIndex = Math.max(0, Math.min(currentIndex, totalOriginal - 1))
    }

    pendingPortfolioReset = null
    isPortfolioTransitioning = false
    setPortfolioPosition(originalOffsets[currentIndex] || 0, false)
  }

  function schedulePortfolioInit(keepIndex = true) {
    if (portfolioInitRaf) {
      cancelAnimationFrame(portfolioInitRaf)
    }

    portfolioInitRaf = requestAnimationFrame(() => {
      initPortfolio(keepIndex)
      portfolioInitRaf = null
    })
  }

  function slidePortfolio(direction) {
    if (!originalOffsets.length || isPortfolioTransitioning) return

    isPortfolioTransitioning = true

    if (direction > 0) {
      if (currentIndex < totalOriginal - 1) {
        currentIndex += 1
        setPortfolioPosition(originalOffsets[currentIndex], true)
      } else {
        pendingPortfolioReset = 0
        setPortfolioPosition(cloneOffsets[0], true)
      }
      return
    }

    if (currentIndex > 0) {
      currentIndex -= 1
      setPortfolioPosition(originalOffsets[currentIndex], true)
      return
    }

    setPortfolioPosition(cloneOffsets[0], false)
    // Force layout so the browser applies the jump before animating back.
    void portfolioTrack.offsetHeight
    pendingPortfolioReset = totalOriginal - 1
    setPortfolioPosition(cloneOffsets[totalOriginal - 1], true)
  }

  portfolioTrack.addEventListener('transitionend', (e) => {
    if (e.target !== portfolioTrack) return
    if (e.propertyName !== 'transform') return

    isPortfolioTransitioning = false

    if (pendingPortfolioReset === null) return

    currentIndex = pendingPortfolioReset
    pendingPortfolioReset = null
    setPortfolioPosition(originalOffsets[currentIndex] || 0, false)
  })

  const portfolioImages = Array.from(portfolioTrack.querySelectorAll('img'))
  portfolioImages.forEach((img) => {
    img.addEventListener('load', () => schedulePortfolioInit(true), { once: true })
    img.addEventListener('error', () => schedulePortfolioInit(true), { once: true })
  })

  window.addEventListener('load', () => schedulePortfolioInit(true), { once: true })
  window.addEventListener('resize', () => schedulePortfolioInit(true))

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => schedulePortfolioInit(false), { once: true })
  } else {
    schedulePortfolioInit(false)
  }

  portfolioControllers.set(portfolioTrack, {
    slide: slidePortfolio,
  })
})

window.portfolioSlide = function portfolioSlide(buttonOrDirection, maybeDirection) {
  const direction = typeof buttonOrDirection === 'number' ? buttonOrDirection : maybeDirection

  if (!direction) return

  let targetTrack = null

  if (buttonOrDirection instanceof Element) {
    targetTrack = buttonOrDirection
      .closest('[data-portfolio-slider]')
      ?.querySelector('.portfolio-track')
  }

  if (!targetTrack) {
    targetTrack = document.querySelector('.portfolio-track')
  }

  portfolioControllers.get(targetTrack)?.slide(direction)
}

document.querySelectorAll('.portfolio-item img').forEach(img => {
  img.onload = () => {
    const parent = img.closest('.portfolio-item');
    parent.classList.add(img.naturalHeight > img.naturalWidth ? 'vertical' : 'horizontal');
  }
  if (img.complete && img.naturalWidth) img.onload();
});

const consentStorageKey = 'ld_cookie_consent_v1'
const cookieConsentDefaults = {
  necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
}

function readCookieConsent() {
  try {
    const stored = localStorage.getItem(consentStorageKey)
    if (!stored) return null

    const parsed = JSON.parse(stored)
    return {
      ...cookieConsentDefaults,
      ...parsed,
      necessary: true,
    }
  } catch (error) {
    return null
  }
}

function writeCookieConsent(consent) {
  const payload = {
    ...cookieConsentDefaults,
    ...consent,
    necessary: true,
  }

  try {
    localStorage.setItem(consentStorageKey, JSON.stringify(payload))
  } catch (error) {}

  try {
    document.cookie = `ld_cookie_consent=${encodeURIComponent(JSON.stringify(payload))}; Max-Age=31536000; Path=/; SameSite=Lax`
  } catch (error) {}

  return payload
}

function applyCookieConsent(consent) {
  const payload = {
    ...cookieConsentDefaults,
    ...consent,
    necessary: true,
  }

  window.dataLayer = window.dataLayer || []
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments)
  }

  window.gtag('consent', 'update', {
    analytics_storage: payload.analytics ? 'granted' : 'denied',
    ad_storage: payload.marketing ? 'granted' : 'denied',
    ad_user_data: payload.marketing ? 'granted' : 'denied',
    ad_personalization: payload.marketing ? 'granted' : 'denied',
    functionality_storage: payload.preferences ? 'granted' : 'denied',
    personalization_storage: payload.preferences ? 'granted' : 'denied',
    security_storage: 'granted',
  })

  window.dataLayer.push({
    event: 'cookie_consent_updated',
    cookie_preferences: payload.preferences,
    cookie_analytics: payload.analytics,
    cookie_marketing: payload.marketing,
  })
}

const cookieBanner = document.querySelector('[data-cookie-banner]')
const cookieModal = document.querySelector('[data-cookie-modal]')
const cookieManage = document.querySelector('[data-cookie-manage]')
const cookieToggles = Array.from(document.querySelectorAll('[data-consent-toggle]'))
const cookieActionButtons = Array.from(document.querySelectorAll('[data-cookie-action]'))
const cookieCloseButtons = Array.from(document.querySelectorAll('[data-cookie-close]'))

if (cookieBanner && cookieModal && cookieManage) {
  let currentConsent = readCookieConsent()

  const syncCookieToggles = (consent) => {
    cookieToggles.forEach((toggle) => {
      toggle.checked = Boolean(consent?.[toggle.dataset.consentToggle])
    })
  }

  const showCookieBanner = () => {
    cookieBanner.hidden = false
    cookieManage.hidden = true
  }

  const hideCookieBanner = () => {
    cookieBanner.hidden = true
    cookieManage.hidden = false
  }

  const openCookieModal = () => {
    syncCookieToggles(currentConsent || cookieConsentDefaults)
    cookieModal.hidden = false
    document.body.classList.add('cookie-modal-open')
  }

  const closeCookieModal = () => {
    cookieModal.hidden = true
    document.body.classList.remove('cookie-modal-open')

    if (!currentConsent) {
      showCookieBanner()
    }
  }

  const saveCookieConsent = (consent) => {
    currentConsent = writeCookieConsent(consent)
    applyCookieConsent(currentConsent)
    syncCookieToggles(currentConsent)
    hideCookieBanner()
    closeCookieModal()
  }

  const acceptAllConsent = () => saveCookieConsent({
    preferences: true,
    analytics: true,
    marketing: true,
  })

  const rejectAllConsent = () => saveCookieConsent({
    preferences: false,
    analytics: false,
    marketing: false,
  })

  const saveToggleConsent = () => saveCookieConsent({
    preferences: cookieToggles.find((toggle) => toggle.dataset.consentToggle === 'preferences')?.checked || false,
    analytics: cookieToggles.find((toggle) => toggle.dataset.consentToggle === 'analytics')?.checked || false,
    marketing: cookieToggles.find((toggle) => toggle.dataset.consentToggle === 'marketing')?.checked || false,
  })

  cookieActionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.cookieAction

      if (action === 'preferences') {
        cookieBanner.hidden = true
        openCookieModal()
        return
      }

      if (action === 'accept') {
        acceptAllConsent()
        return
      }

      if (action === 'reject') {
        rejectAllConsent()
        return
      }

      if (action === 'save') {
        saveToggleConsent()
      }
    })
  })

  cookieCloseButtons.forEach((button) => {
    button.addEventListener('click', closeCookieModal)
  })

  cookieManage.addEventListener('click', openCookieModal)

  if (currentConsent) {
    applyCookieConsent(currentConsent)
    hideCookieBanner()
    syncCookieToggles(currentConsent)
  } else {
    showCookieBanner()
    syncCookieToggles(cookieConsentDefaults)
  }
}


