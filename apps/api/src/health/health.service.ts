import type { HealthResponse } from '@dealflow/shared';
import { Injectable } from '@nestjs/common';

import { checkDbHealth } from '../db';

@Injectable()
export class HealthService {
  async check(): Promise<HealthResponse> {
    const version = process.env.GIT_SHA ?? 'dev';
    const dbOk = await checkDbHealth();

    if (dbOk) {
      return { status: 'ok', db: 'ok', version };
    }

    return { status: 'degraded', db: 'down', version };
  }
}
