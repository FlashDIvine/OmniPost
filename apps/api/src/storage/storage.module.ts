import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalStorageAdapter } from './adapters/local-storage.adapter';
import { STORAGE_ADAPTER } from './interfaces/storage-adapter.interface';

@Module({
  providers: [
    LocalStorageAdapter,
    {
      provide: STORAGE_ADAPTER,
      useClass: LocalStorageAdapter,
    },
    StorageService,
  ],
  exports: [StorageService, STORAGE_ADAPTER],
})
export class StorageModule {}
