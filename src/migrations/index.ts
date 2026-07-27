import * as migration_20250501_080151 from './20250501_080151';
import * as migration_20250626_223208 from './20250626_223208';
import * as migration_20260316_performance_indexes from './20260316_performance_indexes';
import * as migration_20260320_123606 from './20260320_123606';
import * as migration_20260325_222051 from './20260325_222051';
import * as migration_20260325_add_country_to_users from './20260325_add_country_to_users';
import * as migration_20260616_120000_update_mindset_model_ids from './20260616_120000_update_mindset_model_ids';
import * as migration_20260726_083949_add_did_not_trade_to_trades from './20260726_083949_add_did_not_trade_to_trades';
import * as migration_20260726_090236_add_trade_submissions from './20260726_090236_add_trade_submissions';

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
    name: '20260320_123606',
  },
  {
    up: migration_20260325_222051.up,
    down: migration_20260325_222051.down,
    name: '20260325_222051',
  },
  {
    up: migration_20260325_add_country_to_users.up,
    down: migration_20260325_add_country_to_users.down,
    name: '20260325_add_country_to_users',
  },
  {
    up: migration_20260616_120000_update_mindset_model_ids.up,
    down: migration_20260616_120000_update_mindset_model_ids.down,
    name: '20260616_120000_update_mindset_model_ids',
  },
  {
    up: migration_20260726_083949_add_did_not_trade_to_trades.up,
    down: migration_20260726_083949_add_did_not_trade_to_trades.down,
    name: '20260726_083949_add_did_not_trade_to_trades',
  },
  {
    up: migration_20260726_090236_add_trade_submissions.up,
    down: migration_20260726_090236_add_trade_submissions.down,
    name: '20260726_090236_add_trade_submissions'
  },
];
