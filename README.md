
# fastify-nested-router

fastify-nested-router is library for dynamic nested routes for fastify framework 

## Installation

```sh
npm install fastify-nested-router
```
or with yarn
```sh
yarn add fastify-nested-router
```

## Usage

### Example:
```js
import path from 'path'
import Fastify from 'fastify'
import router from 'fastify-nested-router'

export default async function createServer(config) {
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
  return fastify
}
```
When you use both of routeDir and absolutePath, absolutePath overrides routeDir


This file tree:
```
routes/
--| users/
-----| post.js
-----| setting.js
-----| :id/
-------| get.js
--| books/
-----| :bookId/
--------| authors/
-----------| :authorId/
-------------| get.js
--| get.js
```

generate express Route path:
```
/users/
/users/:id
/books/:bookId/authors/:authorId
/
```
### Use middlewares:
Using under method
```js
export * as $auth from ‘~/middleware/auth’
```
If use middleware overall, should set it the execution file

## License
MIT