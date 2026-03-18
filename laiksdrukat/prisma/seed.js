import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const stampImage = 'https://www.laiksdrukat.lv/wp-content/uploads/2026/02/col9p-300x300.png'

  // Categories
  const stamps = await prisma.category.upsert({
    where: { slug: 'zimogi' },
    update: { name: 'Zīmogi' },
    create: { name: 'Zīmogi', slug: 'zimogi' }
  })

  const inks = await prisma.category.upsert({
    where: { slug: 'zimogu-tintes' },
    update: { name: 'Zīmogu tintes' },
    create: { name: 'Zīmogu tintes', slug: 'zimogu-tintes' }
  })

  // Products — stamps
  const products = [
    {
      name: 'Mini Dater S 120',
      slug: 'mini-dater-s-120',
      description: 'Datuma zīmogs Mini Dater S120 automātisks. Kompakts un ērts ikdienas lietošanai.',
      price: 6.00,
      image: stampImage,
      stock: 20,
      categoryId: stamps.id,
    },
    {
      name: 'Mini Print S 110',
      slug: 'mini-print-s-110',
      description: 'Mazs automātiskais zīmogs īsam tekstam, rekvizītiem vai ātrai marķēšanai.',
      price: 6.90,
      image: stampImage,
      stock: 18,
      categoryId: stamps.id,
    },
    {
      name: 'Mini Print S 120/W',
      slug: 'mini-print-s-120-w',
      description: 'Šaurāks automātiskais zīmogs nelielam teksta apjomam vai individuālam marķējumam.',
      price: 7.90,
      image: stampImage,
      stock: 16,
      categoryId: stamps.id,
    },
    {
      name: 'Pocket Stamp Plus 20',
      slug: 'pocket-stamp-plus-20',
      description: 'Kabatas zīmogs, ko ērti paņemt līdzi izbraukumos vai ikdienas darbā.',
      price: 9.40,
      image: stampImage,
      stock: 8,
      categoryId: stamps.id,
    },
    {
      name: 'Printer R 17',
      slug: 'printer-r17',
      description: 'Apaļais COLOP zīmogs nelielam logotipam vai īsai informācijai.',
      price: 10.90,
      image: stampImage,
      stock: 10,
      categoryId: stamps.id,
    },
    {
      name: 'Printer C20 Compact',
      slug: 'printer-c20-compact',
      description: 'Kompakts taisnstūra zīmogs biežāk lietotajai informācijai un ikdienas dokumentiem.',
      price: 10.50,
      image: stampImage,
      stock: 14,
      categoryId: stamps.id,
    },
    {
      name: 'Printer S260/L2',
      slug: 'printer-s260-l2',
      description: 'Automātisks zīmogs ar ietilpīgāku teksta laukumu biroja vajadzībām.',
      price: 11.50,
      image: stampImage,
      stock: 11,
      categoryId: stamps.id,
    },
    {
      name: 'Printer R 30 – Round',
      slug: 'printer-r30-round',
      description: 'Colop Printer R30 apaļš zīmogs birojam. Ideāli piemērots uzņēmuma logotipam.',
      price: 16.10,
      image: stampImage,
      stock: 15,
      categoryId: stamps.id,
    },
    {
      name: 'Printer C40 Compact',
      slug: 'printer-c40-compact',
      description: 'Colop Printer C40 Compact automātiskais zīmogs. Lielāks zīmogs dokumentiem.',
      price: 15.70,
      image: stampImage,
      stock: 10,
      categoryId: stamps.id,
    },
    {
      name: 'Printer C30 Compact',
      slug: 'printer-c30-compact',
      description: 'Colop Printer C30 Compact automātiskais zīmogs. Klasisks zīmogs biroja vajadzībām.',
      price: 12.60,
      image: stampImage,
      stock: 12,
      categoryId: stamps.id,
    },
    // Sample ink products so the second live-shop category is visible in development.
    {
      name: 'Colop zīmogu tinte melna 25 ml',
      slug: 'colop-zimogu-tinte-melna-25ml',
      description: 'Papildtinte zīmogiem ikdienas lietošanai melnā krāsā.',
      price: 4.80,
      image: null,
      stock: 24,
      categoryId: inks.id,
    },
    {
      name: 'Colop zīmogu tinte zila 25 ml',
      slug: 'colop-zimogu-tinte-zila-25ml',
      description: 'Papildtinte zīmogiem zilā krāsā standarta biroja vajadzībām.',
      price: 4.80,
      image: null,
      stock: 20,
      categoryId: inks.id,
    },
    {
      name: 'Colop spilventiņš E/20 melns',
      slug: 'colop-spilventins-e20-melns',
      description: 'Rezerves spilventiņš kompaktajiem COLOP zīmogiem.',
      price: 5.60,
      image: null,
      stock: 12,
      categoryId: inks.id,
    },
  ]

  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: p,
      create: p,
    })
  }

  // Admin user
  const hash = await bcrypt.hash('admin123', 10)
  await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', password: hash }
  })

  console.log('✅ Seed complete')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
