import * as migration_20250501_080151 from './20250501_080151';
import * as migration_20250626_223208 from './20250626_223208';

export const migrations = [
  {
    up: migration_20250501_080151.up,
    down: migration_20250501_080151.down,
    name: '20250501_080151',
  },
  {
    up: migration_20250626_223208.up,
    down: migration_20250626_223208.down,
    name: '20250626_223208'
  },
];
