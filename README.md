# Laiks Drukāt — Fastify + MySQL Shop

Full rewrite of laiksdrukat.lv in Node.js using Fastify, Prisma ORM, MySQL, and Eta templates.

---

## Tech Stack

| Layer         | Tool                  |
| ------------- | --------------------- |
| Server        | Fastify 4             |
| Database      | MySQL + Prisma ORM    |
| Templates     | Eta (HTML templating) |
| Sessions/Cart | @fastify/session      |
| Auth          | bcrypt + session      |
| Static files  | @fastify/static       |

---

## Project Structure

```
src/
  server.js           — entry point
  plugins/
    db.js             — Prisma client
    cart.js           — session cart helpers
    auth.js           — admin guard
  routes/
    storefront.js     — homepage + service pages
    shop.js           — /veikals product listing + detail
    cart.js           — /grozs add/remove/update
    checkout.js       — /checkout order form
    admin/
      index.js        — all /admin routes
  views/
    partials/
      layout.eta      — main site layout (nav + footer)
    pages/
      home.eta
      cart.eta
      checkout.eta
      thankyou.eta
      kontakti.eta
      shop/
        index.eta     — product listing
        product.eta   — product detail
      services/       — 7 service pages
    admin/
      layout.eta      — admin sidebar layout
      login.eta
      dashboard.eta
      products.eta
      product-form.eta
      orders.eta
      order-detail.eta
prisma/
  schema.prisma       — DB schema
  seed.js             — sample data
public/
  css/main.css
  js/main.js
  images/
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your MySQL credentials:

```
DATABASE_URL="mysql://user:password@localhost:3306/laiksdrukat"
SESSION_SECRET="your-long-random-secret-here"
PORT=3000
UPLOADS_DIR="./data/uploads"
```

### 3. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations (creates all tables)
npm run db:migrate

# Seed with sample products + admin user
npm run db:seed
```

### 4. Start the server

```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

Site is live at: **http://localhost:3000**
Admin panel at: **http://localhost:3000/admin**

Default admin login:

- Username: `admin`
- Password: `admin123` ← **change this immediately!**

---

## Pages

| URL                    | Page                   |
| ---------------------- | ---------------------- |
| `/`                    | Homepage               |
| `/veikals/`            | Shop listing           |
| `/veikals/:slug/`      | Product detail         |
| `/kategorija/:slug/`   | Category filter        |
| `/grozs/`              | Cart                   |
| `/pasutijums/`         | Checkout               |
| `/pasutijums/paldies/` | Order confirmation     |
| `/kontakti/`           | Contact                |
| `/zimogs/`             | Stamps service         |
| `/baneri/`             | Banners service        |
| `/auto-aplimesana/`    | Car wrap service       |
| `/vizitkartes/`        | Business cards service |
| `/uzlimes/`            | Stickers service       |
| `/vides-reklama/`      | Outdoor ads service    |
| `/druka/`              | Print service          |
| `/admin`               | Admin dashboard        |
| `/admin/products`      | Manage products        |
| `/admin/orders`        | Manage orders          |

---

## Adding Products

Option 1 — Admin panel: go to `/admin/products` → click **+ Pievienot produktu**

Option 2 — Edit `prisma/seed.js` and re-run `npm run db:seed`

---

## Deploying to Product

1. Set up MySQL on your server (or use PlanetScale / Railway for hosted MySQL)
2. Install Node.js 18+ on server
3. Upload files, run `npm install --production`
4. Run `npm run db:migrate` to create tables
5. Use **PM2** to keep the server running:
   ```bash
   npm install -g pm2
   pm2 start src/server.js --name laiksdrukat
   pm2 save
   ```
6. Set up **Nginx** as reverse proxy on port 80/443
7. Add SSL with **Certbot** (Let's Encrypt — free)
8. Set `UPLOADS_DIR` to a persistent directory outside release folders, for example `/home/USERNAME/laiksdrukat-data/uploads`

---


- [ ] Add image upload for products (use @fastify/multipart)
- [ ] Add email notifications for new orders (nodemailer)
- [ ] Add contact form email sending
- [ ] Add more products and service page content
- [ ] Set up proper domain + SSL
