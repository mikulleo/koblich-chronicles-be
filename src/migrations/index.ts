import * as migration_20250501_080151 from './20250501_080151'

export const migrations = [
  {
    up: migration_20250501_080151.up,
    down: migration_20250501_080151.down,
    name: '20250501_080151',
  },
]
