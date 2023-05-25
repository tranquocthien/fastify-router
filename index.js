import pick from 'lodash/pick'
import path from 'path'
import fs from 'fs'

const CACHE = new Map()
const SUPPORTED_METHODS = [
  'DELETE',
  'GET',
  'HEAD',
  'PATCH',
  'POST',
  'PUT',
  'OPTIONS',
  'SEARCH',
  'TRACE',
  'PROPFIND',
  'PROPPATCH',
  'MKCOL',
  'COPY',
  'MOVE',
  'LOCK',
  'UNLOCK',
]
const HOOKABLES = [
  'onRequest',
  'preParsing',
  'preValidation',
  'preHandler',
  'preSerialization',
  'onError',
  'onSend',
  'onResponse',
  'onTimeout',
  'onRequestAbort',
]
const SCHEMA_VARS = ['headers', 'query', 'querystring', 'params', 'body']

const mixSchema = (...list) =>
  list.flat(5).length
    ? list.flat(5).reduce((acc, item) =>
        SCHEMA_VARS.reduce(
          (acc2, key) =>
            item[key]
              ? {
                  ...acc2,
                  [key]: acc2[key] ? acc2[key].extend(item[key]) : item[key],
                }
              : acc2,
          acc,
        ),
      )
    : null

async function importFromCache(...args) {
  const filepath = path.join(...args)
  if (CACHE.get(filepath) === undefined) {
    CACHE.set(filepath, await import(filepath))
  }
  return CACHE.get(filepath)
}
function parseSetting(module) {
  const pickable = [...HOOKABLES, 'schema']
  const res = Object.fromEntries(pickable.map((key) => [key, []]))
  const settings = Object.keys(module)
    .filter((key) => key.startsWith('$'))
    .map((key) => module[key])
  const invalidKeys = Object.keys(module).filter(
    (key) => !key.startsWith('$') && key !== 'schema' && !HOOKABLES.includes(key),
  )
  if (invalidKeys.length) {
    console.warn('invalid key: ' + invalidKeys.join())
  }
  module.schema && res.schema.push(module.schema)
  settings.push(pick(module, HOOKABLES))
  settings.forEach((setting) => pickable.forEach((hook) => setting[hook] && res[hook].push(setting[hook])))
  HOOKABLES.forEach((hook) => (res[hook] = res[hook].length ? res[hook].flat(5) : undefined))
  return res
}
function parseHandler(module, schema) {
  const pickable = [...HOOKABLES, 'schema']
  const res = Object.fromEntries(pickable.map((key) => [key, []]))
  module.schema && res.schema.push(module.schema)
  const settings = Object.keys(module)
    .filter((key) => key.startsWith('$'))
    .map((key) => parseSetting(module[key]))
  const invalidKeys = Object.keys(module).filter(
    (key) => !key.startsWith('$') && key !== 'default' && key !== 'schema' && !HOOKABLES.includes(key),
  )
  if (invalidKeys.length) {
    console.warn('invalid key: ' + invalidKeys.join())
  }
  settings.push(pick(module, HOOKABLES))
  settings.forEach((setting) => pickable.forEach((hook) => setting[hook] && res[hook].push(setting[hook])))
  HOOKABLES.forEach((hook) => (res[hook] = res[hook].length ? res[hook].flat(5) : undefined))
  return {
    ...res,
    schema: mixSchema(res.schema, schema),
    handler: module.default,
  }
}

export default async function router(route, { root, schema = [] }) {
  const files = fs.readdirSync(root).filter((file) => !file.includes('.skip.'))

  if (files.some((file) => file.startsWith('setting.'))) {
    const settingModule = await importFromCache(root, 'setting')
    if (settingModule) {
      const setting = parseSetting(settingModule)
      HOOKABLES.forEach((key) => setting[key] && setting[key].forEach((cb) => route.addHook(key, cb)))
      schema = [...schema, ...setting.schema]
    }
  }
  for (const file of files) {
    const isDir = fs.lstatSync(path.join(root, file)).isDirectory()
    if (isDir) {
      await route
        .register(router, {
          prefix: file,
          root: path.join(root, file),
          schema,
        })
        .after((e) => e && Promise.reject(e))
        .ready((e) => e && Promise.reject(e))
      continue
    }
    if (/^setting\.(js|cjs|mjs|ts)$/.test(file)) continue

    const method = file.replace(/\.(js|cjs|mjs|ts)$/, '').toUpperCase()
    if (SUPPORTED_METHODS.includes(method)) {
      const handlerModule = await importFromCache(root, file)
      if (handlerModule) {
        route.route({
          method,
          ...parseHandler(handlerModule, schema),
        })
      }
    } else {
      console.warn(`method ${method} is not supported`)
    }
  }
  CACHE.clear()
}
