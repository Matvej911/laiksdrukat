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

let portfolioIndex = 0

window.portfolioSlide = (direction) => {
  const track = document.querySelector('.portfolio-track')
  const items = Array.from(document.querySelectorAll('.portfolio-item'))

  if (!track || items.length === 0) {
    return
  }

  portfolioIndex = (portfolioIndex + direction + items.length) % items.length
  track.style.transform = `translateX(-${portfolioIndex * 100}%)`
}

function scrollSlider(selector, direction, amount = 320) {
  const slider = document.querySelector(selector)
  if (!slider) return

  slider.scrollBy({
    left: direction * amount,
    behavior: 'smooth',
  })
}

let portfolioIndex = 0;

function portfolioSlide(direction) {
  const track = document.querySelector('.portfolio-track');
  const items = document.querySelectorAll('.portfolio-item');

  if (!track || items.length === 0) return;

  portfolioIndex += direction;

  if (portfolioIndex < 0) portfolioIndex = items.length - 1;
  if (portfolioIndex >= items.length) portfolioIndex = 0;

  track.style.transform = `translateX(-${portfolioIndex * 100}%)`;
}


function portfolioSlide(direction) {
  const track = document.querySelector('.portfolio-track');

  track.scrollBy({
    left: direction * 420,   // same as card width + gap
    behavior: 'smooth'
  });
}