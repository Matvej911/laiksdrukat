import fp from 'fastify-plugin'
import { PrismaClient } from '@prisma/client'

async function dbPlugin(fastify) {
  fastify.log.info('Prisma boot: creating PrismaClient')
  const prisma = new PrismaClient({
    log: ['warn', 'error'],
  })

  fastify.log.info('Prisma boot: connecting to database')
  await prisma.$connect()
  fastify.log.info('Prisma boot: database connection established')

  fastify.decorate('db', prisma)

  fastify.addHook('onClose', async () => {
    fastify.log.info('Prisma shutdown: disconnecting database client')
    await prisma.$disconnect()
  })
}

export default fp(dbPlugin)
