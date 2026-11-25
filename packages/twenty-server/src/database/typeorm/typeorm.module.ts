import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { type Pool } from 'pg';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { type PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';

import { typeORMCoreModuleOptions } from 'src/database/typeorm/core/core.datasource';
import { DatabaseGaugeService } from 'src/database/typeorm/database-gauge.service';
import { DatabasePoolMetricsService } from 'src/database/typeorm/database-pool-metrics.service';
import { endPoolClientOnQueryReadTimeout } from 'src/database/typeorm/utils/end-pool-client-on-query-read-timeout.util';
import { PostgresAdvisoryLockService } from 'src/database/typeorm/postgres-advisory-lock.service';
import { MetricsModule } from 'src/engine/core-modules/metrics/metrics.module';
import { installUpgradeAwareRepositoryProxy } from 'src/engine/twenty-orm/upgrade-aware/install-upgrade-aware-repository-proxy';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => typeORMCoreModuleOptions,
      dataSourceFactory: async (options) => {
        const dataSource = new DataSource(options as DataSourceOptions);

        await dataSource.initialize();
        endPoolClientOnQueryReadTimeout(
          (dataSource.driver as PostgresDriver).master as Pool,
        );
        installUpgradeAwareRepositoryProxy(dataSource);

        return dataSource;
      },
    }),
    MetricsModule,
  ],
  providers: [
    DatabasePoolMetricsService,
    DatabaseGaugeService,
    PostgresAdvisoryLockService,
  ],
  exports: [DatabasePoolMetricsService, PostgresAdvisoryLockService],
})
export class TypeORMModule {}
