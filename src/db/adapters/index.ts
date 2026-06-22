import type { ConnectionInfo, DbAdapter } from './types';
import { MysqlAdapter } from './mysql';
import { PostgresAdapter } from './postgres';

export * from './types';

/** Factory: build the right adapter for a connection's engine. */
export function createAdapter(conn: ConnectionInfo): DbAdapter {
  switch (conn.engine) {
    case 'mysql':
    case 'mariadb':
      return new MysqlAdapter(conn);
    case 'postgres':
      return new PostgresAdapter(conn);
    default:
      throw new Error(`Unsupported engine: ${(conn as ConnectionInfo).engine}`);
  }
}
