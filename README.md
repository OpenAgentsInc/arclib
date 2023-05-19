# Arc utilities library

Typescript utilities for interacting with ArcSpec trading chat channels and marketplace listings.

## Overview

#### ArcadeIdentity

Store and pass around user identity info.

#### NIP28Channel

Connect to nostr chat groups

#### NostrPool

Talk to nostr relays

#### ArcateListing

Connect to a pool

Manage "maker" listings in group chat channels.

Get the current listing set


#### ArcadeOffer

Manage "taker" offers in private chat channels.

Get the current list of offers sent to you

Get the set of outstanding offers sent to others

## Commands

To build and watch, use:

```bash
npm start # or yarn start
```

This builds to `/dist` and runs the project in watch mode so any edits you save inside `src` causes a rebuild to `/dist`.

To do a one-off build, use `npm run build` or `yarn build`.

To run tests, use `npm test` or `yarn test`.

## Configuration

Code quality uses `prettier`, `husky`, and `lint-staged`.

### Jest

Jest tests run with `npm test` or `yarn test`.

### Rollup

DTS uses [Rollup](https://rollupjs.org) as a bundler and generates multiple rollup configs for various module formats and build settings

## Optimizations

Please see the main `dts` [optimizations docs](https://github.com/weiran-zsd/dts-cli#optimizations). In particular, know that you can take advantage of development-only optimizations:

```js
// ./types/index.d.ts
declare var __DEV__: boolean;

// inside your code...
if (__DEV__) {
  console.log('foo');
}
```
