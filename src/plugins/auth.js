import fp from 'fastify-plugin'

async function authPlugin(fastify) {
  // Hook to protect /admin routes
  fastify.decorate('requireAdmin', async (request, reply) => {
    if (!request.session.adminId) {
      return reply.redirect('/admin/login')
    }
  })
}

export default fp(authPlugin)
