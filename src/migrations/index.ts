import * as migration_20250501_080151 from './20250501_080151';
import * as migration_notes-too-structured-notes from './notes-too-structured-notes';

export const migrations = [
  {
    up: migration_20250501_080151.up,
    down: migration_20250501_080151.down,
    name: '20250501_080151',
  },
  {
    up: migration_notes-too-structured-notes.up,
    down: migration_notes-too-structured-notes.down,
    name: 'notes-too-structured-notes'
  },
];
