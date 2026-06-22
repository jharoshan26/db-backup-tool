import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Table } from '@/components/Table';
import type { Column } from '@/components/Table';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/Badge';
import { Menu } from '@/components/Menu';
import { PermissionGate } from '@/components/PermissionGate';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { downloadBackup, useBackups } from '@/hooks/useBackups';
import { useServers } from '@/hooks/useServers';
import { apiError } from '@/lib/api';
import { formatBytes, formatDateTime } from '@/lib/format';
import type { Backup } from '@/types';
import { RestoreModal } from './backups/RestoreModal';
import { RunBackupModal } from './backups/RunBackupModal';

export function BackupsPage() {
  const backups = useBackups();
  const servers = useServers();
  const toast = useToast();

  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const serverName = useMemo(() => {
    const map = new Map((servers.data?.data ?? []).map((s) => [s.id, s.name]));
    return (id: string) => map.get(id) ?? id;
  }, [servers.data]);

  const handleDownload = async (backup: Backup) => {
    setDownloadingId(backup.id);
    try {
      await downloadBackup(backup);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setDownloadingId(null);
    }
  };

  const columns: Column<Backup>[] = [
    {
      key: 'database',
      header: 'Database',
      render: (b) => (
        <div>
          <p className="font-medium text-slate-900">{b.database}</p>
          <p className="text-xs text-slate-400">{serverName(b.serverId)}</p>
        </div>
      ),
    },
    { key: 'format', header: 'Format', render: (b) => <Badge>{b.format}</Badge> },
    { key: 'size', header: 'Size', render: (b) => formatBytes(b.size) },
    { key: 'status', header: 'Status', render: (b) => <StatusBadge status={b.status} /> },
    {
      key: 'checksum',
      header: 'Checksum',
      render: (b) => (
        <span className="font-mono text-xs text-slate-400" title={b.checksum}>
          {b.checksum ? `${b.checksum.slice(0, 12)}…` : '—'}
        </span>
      ),
    },
    { key: 'created', header: 'Created', render: (b) => formatDateTime(b.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right w-px',
      render: (b) => {
        const ready = b.status === 'done' || b.status === 'available';
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!ready}
              loading={downloadingId === b.id}
              onClick={() => handleDownload(b)}
            >
              Download
            </Button>
            <Menu
              actions={[
                { label: 'Restore', disabled: !ready, onClick: () => setRestoreTarget(b) },
                { label: 'Download', disabled: !ready, onClick: () => handleDownload(b) },
              ]}
            />
          </div>
        );
      },
    },
  ];

  const rows = backups.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Backups"
        subtitle="Browse, download and restore database backups"
        actions={
          <PermissionGate permission="backup:create">
            <Button onClick={() => setRunOpen(true)}>Run backup</Button>
          </PermissionGate>
        }
      />

      {!backups.isLoading && rows.length === 0 ? (
        <EmptyState
          title="No backups yet"
          description="Run a backup from a server to see it listed here."
          action={
            <PermissionGate permission="backup:create">
              <Button onClick={() => setRunOpen(true)}>Run backup</Button>
            </PermissionGate>
          }
        />
      ) : (
        <Table columns={columns} rows={rows} rowKey={(b) => b.id} loading={backups.isLoading} />
      )}

      <RunBackupModal open={runOpen} onClose={() => setRunOpen(false)} />
      <RestoreModal
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        backup={restoreTarget}
      />
    </div>
  );
}
