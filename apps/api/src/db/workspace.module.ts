/**
 * WorkspaceModule — registers WorkspaceInterceptor as a global interceptor.
 *
 * Wave-17 (task 96026365) — P-4 F1 CRITICAL.
 *
 * The WorkspaceInterceptor must run on EVERY request (tenant tables are all
 * RLS-gated by app.workspace_id). Registering it APP-WIDE via APP_INTERCEPTOR
 * ensures it fires before any controller handler, without requiring each module
 * to declare it explicitly.
 *
 * Registered in AppModule.imports.
 */

import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { WorkspaceInterceptor } from './workspace.interceptor';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: WorkspaceInterceptor,
    },
  ],
})
export class WorkspaceModule {}
