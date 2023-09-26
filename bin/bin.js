#!/usr/bin/env node

async function start() {
    const { read } = await import('../dist/index.cjs')
    return read()
}
start()