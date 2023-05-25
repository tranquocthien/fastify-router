import path from 'path'
import Fastify from 'fastify'
import router from '~/plugins/router'
import HttpStatus from 'http-status'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import S from 'fluent-json-schema'

export default async function createServer(config) {
  const fastify = Fastify({
    ...config,
  })
  fastify.register(cors, {
    credentials: true,
    origin: 'http://127.0.0.1:2302',
  })
  fastify.register(cookie, {
    secret: process.env.JWT_SECRET,
    hook: 'preHandler',
    parseOptions: {},
  })
  fastify
    .register(router, {
      root: path.join(process.cwd(), 'routes'),
      prefix: 'api',
    })
    .after((e) => e && Promise.reject(e))
    .ready((e) => {
      if (e) Promise.reject(e)
      console.log(
        '\n' +
          fastify.printRoutes({
            includeHooks: !true,
            includeMeta: !true,
            commonPrefix: !true,
          }),
      )
    })

  fastify.decorateReply('error', function (code, message) {
    if (!HttpStatus[code]) {
      throw new Error(`invalid http code: ${code}`)
    }
    return this.status(code).send({
      message,
      error: HttpStatus[code],
      statusCode: code,
    })
  })

  fastify.decorateReply('prismaError', function (error) {
    switch (error.code) {
      case 'P2002':
        return this.error(
          HttpStatus.CONFLICT,
          `Unique constraint failed on the fields: (${error.meta.target.join(', ')})`,
        )
    }
    throw error
  })

  return fastify
}