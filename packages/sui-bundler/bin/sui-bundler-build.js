#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs')
const minifyStream = require('minify-stream')
const path = require('path')
const program = require('commander')
const replaceStream = require('replacestream')
const rimraf = require('rimraf')
const staticModule = require('static-module')
const webpack = require('webpack')

const config = require('../webpack.config.prod')
const linkLoaderConfigBuilder = require('../loaders/linkLoaderConfigBuilder')
const log = require('../shared/log')
const {config: projectConfig} = require('../shared')

process.env.NODE_ENV = process.env.NODE_ENV || 'production'

program
  .option('-C, --clean', 'Remove public folder before create a new one')
  .option(
    '--link-package [package]',
    'Replace each occurrence of this package with an absolute path to this folder',
    (v, m) => {
      m.push(v)
      return m
    },
    []
  )
  .option('-c, --context [folder]', 'Context folder (cwd by default)')
  .on('--help', () => {
    console.log('  Examples:')
    console.log('')
    console.log('    $ sui-bundler build -S')
    console.log('    $ sui-bundler build -SC')
    console.log('    $ sui-bundler dev --link-package /my/domain/folder')
    console.log('    $ sui-bundler build --help')
    console.log('')
  })
  .parse(process.argv)

const {clean = false, context} = program
config.context = context || config.context
const packagesToLink = program.linkPackage || []

const nextConfig = packagesToLink.length
  ? linkLoaderConfigBuilder({
      config,
      packagesToLink,
      linkAll: false
    })
  : config

if (clean) {
  log.processing('Removing previous build...')
  rimraf.sync(path.resolve(process.env.PWD, 'public'))
}

log.processing('Generating minified bundle. This will take a moment...')

webpack(nextConfig).run((error, stats) => {
  if (error) {
    log.error(error)
    return 1
  }

  if (stats.hasErrors()) {
    const jsonStats = stats.toJson('errors-only')
    return jsonStats.errors.map(log.error)
  }

  if (stats.hasWarnings()) {
    const jsonStats = stats.toJson('errors-warnings')
    log.warn('Webpack generated the following warnings: ')
    jsonStats.warnings.map(log.warn)
  }

  console.log(`Webpack stats: ${stats}`)

  const offlinePath = path.join(process.cwd(), 'src', 'offline.html')
  const offlinePageExists = fs.existsSync(offlinePath)
  const {offline: offlineConfig = {}} = projectConfig

  const staticsCacheOnly = offlineConfig.staticsCacheOnly || false

  if (offlinePageExists) {
    fs.copyFileSync(
      path.resolve(offlinePath),
      path.resolve(process.cwd(), 'public', 'offline.html')
    )
  }

  if (offlinePageExists || staticsCacheOnly) {
    const manifest = require(path.resolve(
      process.cwd(),
      'public',
      'asset-manifest.json'
    ))

    const rulesOfFilesToNotCache = [
      'runtime~', // webpack's runtime chunks are not meant to be cached
      'LICENSE.txt', // avoid LICENSE files
      '.map' // source maps
    ]
    const manifestStatics = Object.values(manifest).filter(
      url => !rulesOfFilesToNotCache.some(rule => url.includes(rule))
    )

    const importScripts = offlineConfig.importScripts || []

    const stringImportScripts = importScripts
      .map(url => `importScripts("${url}")`)
      .join('\n')

    Boolean(importScripts.length) &&
      console.log('\nExternal Scripts Added to the SW:\n', stringImportScripts)

    // generates the service worker
    fs.createReadStream(path.resolve(__dirname, '..', 'service-worker.js'))
      .pipe(replaceStream('// IMPORT_SCRIPTS_HERE', stringImportScripts))
      .pipe(
        staticModule({
          'static-manifest': () => JSON.stringify(manifestStatics),
          'static-cache-name': () => JSON.stringify(Date.now().toString()),
          'static-statics-cache-only': () => JSON.stringify(staticsCacheOnly)
        })
      )
      .pipe(minifyStream({sourceMap: false}))
      .pipe(
        fs.createWriteStream(
          path.resolve(process.cwd(), 'public', 'service-worker.js')
        )
      )

    console.log('\nService worker generated succesfully!\n')
  }

  log.success(
    `Your app is compiled in ${process.env.NODE_ENV} mode in /public. It's ready to roll!`
  )

  return 0
})
