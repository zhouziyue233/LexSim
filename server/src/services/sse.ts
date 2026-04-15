import type { Response } from 'express'
import type { SSEEventType } from '@shared/types'

export interface SSEStream {
  emit(event: SSEEventType | string, data: unknown): void
  close(): void
}

export class SSEEmitter implements SSEStream {
  constructor(private res: Response) {}

  emit(event: SSEEventType | string, data: unknown): void {
    try {
      this.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    } catch {
      // Connection may have been closed
    }
  }

  close(): void {
    try {
      this.res.end()
    } catch {
      // Already closed
    }
  }
}
