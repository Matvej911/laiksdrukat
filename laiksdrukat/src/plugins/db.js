import fp from 'fastify-plugin'
import { PrismaClient } from '@prisma/client'

async function dbPlugin(fastify) {
  const prisma = new PrismaClient()
  await prisma.$connect()

  fastify.decorate('db', prisma)

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect()
  })
}

export default fp(dbPlugin)
