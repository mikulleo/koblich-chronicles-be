import * as migration_20250501_080151 from './20250501_080151';
import * as migration_20250626_223208 from './20250626_223208';
import * as migration_20260316_performance_indexes from './20260316_performance_indexes';
import * as migration_20260320_123606 from './20260320_123606';

export const migrations = [
  {
    up: migration_20250501_080151.up,
    down: migration_20250501_080151.down,
    name: '20250501_080151',
  },
  {
    up: migration_20250626_223208.up,
    down: migration_20250626_223208.down,
    name: '20250626_223208',
  },
  {
    up: migration_20260316_performance_indexes.up,
    down: migration_20260316_performance_indexes.down,
    name: '20260316_performance_indexes',
  },
  {
    up: migration_20260320_123606.up,
    down: migration_20260320_123606.down,
    name: '20260320_123606'
  },
];
