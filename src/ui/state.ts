import { freshExchange, type Exchange } from '../exchange/exchange.js'

/**
 * The one live exchange the page is talking about.
 *
 * Panels 2, 3 and 4 all report on the same pair of parties, so the exchange is
 * held here rather than recomputed per panel. Running a fresh one notifies
 * every panel, which is what lets panel 3 RETIRE a recovery attempt that was
 * made against a secret that no longer exists — a stale verdict left on screen
 * beside new key material is the failure §4.1b's retirement rule exists for.
 *
 * Key material is per-session and in memory. Nothing here touches storage.
 */
export interface Lab {
  current(): Exchange | null
  run(): Exchange
  runCount(): number
  subscribe(listener: (exchange: Exchange, runCount: number) => void): void
}

export function createLab(): Lab {
  let exchange: Exchange | null = null
  let runs = 0
  const listeners: ((exchange: Exchange, runCount: number) => void)[] = []
  return {
    current: () => exchange,
    runCount: () => runs,
    run() {
      exchange = freshExchange()
      runs += 1
      for (const listener of listeners) listener(exchange, runs)
      return exchange
    },
    subscribe(listener) {
      listeners.push(listener)
    },
  }
}
