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

const sliderWrapper = document.querySelector('.products-slider-wrapper');
const slider = sliderWrapper?.querySelector('.products-slider');
const track  = sliderWrapper?.querySelector('.products-slider-track');

if (sliderWrapper && slider && track) {
  const gap          = 30;
  const prevButton = sliderWrapper.querySelector('.slider-btn.left');
  const nextButton = sliderWrapper.querySelector('.slider-btn.right');
  const getVisibleCount = () => {
    if (window.innerWidth <= 640) return 1;
    if (window.innerWidth <= 1024) return 2;
    return 3;
  };
  const originalCards = Array.from(slider.children);

  const totalOriginal = originalCards.length;
  let step            = 0;
  let scrollAmount    = 0;
  let isTransitioning = false;
  let loopingEnabled  = false;

  function rebuildSlider() {
    const visibleCount = getVisibleCount();
    loopingEnabled = totalOriginal > visibleCount;

    slider.replaceChildren(...originalCards);

    if (loopingEnabled) {
      originalCards.forEach(card => {
        const clone = card.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        slider.appendChild(clone);
      });
    }

    if (prevButton) prevButton.style.display = loopingEnabled ? '' : 'none';
    if (nextButton) nextButton.style.display = loopingEnabled ? '' : 'none';
  }

  // calculate from track, not slider
  function setCardWidths() {
    const visibleCount = getVisibleCount();
    const cardWidth = (track.offsetWidth - gap * (visibleCount - 1)) / visibleCount;
    Array.from(slider.children).forEach(card => {
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
    slider.style.transform   = `translateX(${-scrollAmount}px)`;
  }

  slider.addEventListener('transitionend', (e) => {
    if (e.target !== slider) return;
    if (e.propertyName !== 'transform') return; // ← only react to transform, ignore others

    isTransitioning = false;
    const maxScroll = step * totalOriginal;

    if (scrollAmount >= maxScroll) {
      scrollAmount -= maxScroll;
      slider.style.transition = 'none';
      slider.style.transform   = `translateX(${-scrollAmount}px)`;
    } else if (scrollAmount < 0) {
      scrollAmount += maxScroll;
      slider.style.transition = 'none';
      slider.style.transform   = `translateX(${-scrollAmount}px)`;
    }
  });

  window.addEventListener('resize', () => {
    rebuildSlider();
    setCardWidths();
    scrollAmount    = 0;
    isTransitioning = false;
    slider.style.transition = 'none';
    slider.style.transform   = 'translateX(0)';
  });

  // init — works whether DOMContentLoaded has fired or not
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
      rebuildSlider();
      setCardWidths();
    });
  } else {
    rebuildSlider();
    setCardWidths();
  }

  // expose for onclick buttons
  window.scrollSlider = scrollSlider;
}

















// ── Portfolio infinite loop ────────────────────────────────
const portfolioTrack = document.querySelector('.portfolio-track');
const portfolioSliderEl = portfolioTrack; // track IS the sliding element

if (portfolioTrack) {
  const style = window.getComputedStyle(portfolioTrack);
  const gap = parseInt(style.gap || style.columnGap || 0);

  const portfolioOriginals = Array.from(portfolioTrack.children);
  portfolioOriginals.forEach(item => {
    const clone = item.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    const img = clone.querySelector('img');
    if (img && img.complete) {
      clone.classList.add(img.naturalHeight > img.naturalWidth ? 'vertical' : 'horizontal');
    }
    portfolioTrack.appendChild(clone);
  });

  const totalOriginal = portfolioOriginals.length;
  let pStep = 0;
  let pScroll = 0;
  let pTransitioning = false;

  function initPortfolio() {
    const first = portfolioTrack.children[0];
    pStep = first ? first.offsetWidth + gap : 0;
  }

  function portfolioSlide(direction) {
    if (pTransitioning) return;

    const items = portfolioTrack.children;

    // find current visible index
    let currentIndex = 0;
    let accumulated = 0;

    for (let i = 0; i < items.length; i++) {
      const width = items[i].offsetWidth + gap;
      if (accumulated + width > pScroll) {
        currentIndex = i;
        break;
      }
      accumulated += width;
    }

    // next item
    const targetIndex = currentIndex + direction;

    if (!items[targetIndex]) return;

    const moveWidth = items[targetIndex].offsetWidth + gap;

    pTransitioning = true;
    pScroll += direction * moveWidth;

    portfolioTrack.style.transition = 'transform 0.45s ease';
    portfolioTrack.style.transform = `translateX(${-pScroll}px)`;
  }

  portfolioTrack.addEventListener('transitionend', (e) => {
    if (e.target !== portfolioTrack) return;
    if (e.propertyName !== 'transform') return;

    pTransitioning = false;
    const maxScroll = pStep * totalOriginal;

    if (pScroll >= maxScroll) {
      pScroll -= maxScroll;
      portfolioTrack.style.transition = 'none';
      portfolioTrack.style.transform = `translateX(${-pScroll}px)`;
    } else if (pScroll < 0) {
      pScroll += maxScroll;
      portfolioTrack.style.transition = 'none';
      portfolioTrack.style.transform = `translateX(${-pScroll}px)`;
    }
  });

  window.addEventListener('resize', () => {
    initPortfolio();
    pScroll = 0;
    pTransitioning = false;
    portfolioTrack.style.transition = 'none';
    portfolioTrack.style.transform = 'translateX(0)';
  });

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initPortfolio);
  } else {
    initPortfolio();
  }

  window.portfolioSlide = portfolioSlide;
}

document.querySelectorAll('.portfolio-item img').forEach(img => {
  img.onload = () => {
    const parent = img.closest('.portfolio-item');
    parent.classList.add(img.naturalHeight > img.naturalWidth ? 'vertical' : 'horizontal');
  }
  if (img.complete && img.naturalWidth) img.onload();
});


