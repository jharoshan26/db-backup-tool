import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Table } from '@/components/Table';
import type { Column } from '@/components/Table';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Menu } from '@/components/Menu';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PermissionGate } from '@/components/PermissionGate';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { useDeleteServer, useServers, useTestConnection } from '@/hooks/useServers';
import { apiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Server } from '@/types';
import { ServerFormModal } from './servers/ServerFormModal';
import { BackupModal } from './servers/BackupModal';
import { ExportModal } from './servers/ExportModal';
import { CloneModal } from './servers/CloneModal';
import { DatabasesModal } from './servers/DatabasesModal';

const engineTone = {
  postgres: 'blue',
  mysql: 'amber',
  mariadb: 'purple',
} as const;

type ModalKind = 'form' | 'backup' | 'export' | 'clone' | 'databases' | 'delete' | null;

export function ServersPage() {
  const servers = useServers();
  const testConn = useTestConnection();
  const deleteServer = useDeleteServer();
  const toast = useToast();

  const [active, setActive] = useState<Server | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const close = () => {
    setModal(null);
    setActive(null);
  };

  const openWith = (kind: ModalKind, server: Server | null) => {
    setActive(server);
    setModal(kind);
  };

  const handleTest = async (server: Server) => {
    setTestingId(server.id);
    try {
      const result = await testConn.mutateAsync(server.id);
      if (result.ok) {
        toast.success(
          `Connection to ${server.name} OK${result.latencyMs != null ? ` (${result.latencyMs}ms)` : ''}`,
        );
      } else {
        toast.error(result.message ?? `Connection to ${server.name} failed`);
      }
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async () => {
    if (!active) return;
    try {
      await deleteServer.mutateAsync(active.id);
      toast.success('Server deleted');
      close();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const columns: Column<Server>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (s) => (
        <div>
          <p className="font-medium text-slate-900">{s.name}</p>
          <p className="text-xs text-slate-400">
            {s.host}:{s.port}
          </p>
        </div>
      ),
    },
    {
      key: 'engine',
      header: 'Engine',
      render: (s) => <Badge tone={engineTone[s.engine]}>{s.engine}</Badge>,
    },
    { key: 'ssl', header: 'SSL', render: (s) => <span className="text-slate-600">{s.sslMode}</span> },
    { key: 'created', header: 'Created', render: (s) => formatDateTime(s.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right w-px',
      render: (s) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            loading={testingId === s.id}
            onClick={() => handleTest(s)}
          >
            Test
          </Button>
          <Menu
            actions={[
              { label: 'Run backup', onClick: () => openWith('backup', s) },
              { label: 'Export data', onClick: () => openWith('export', s) },
              { label: 'Clone database', onClick: () => openWith('clone', s) },
              { label: 'View databases', onClick: () => openWith('databases', s) },
              { label: 'Edit', onClick: () => openWith('form', s) },
              { label: 'Delete', danger: true, onClick: () => openWith('delete', s) },
            ]}
          />
        </div>
      ),
    },
  ];

  const rows = servers.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Servers"
        subtitle="Manage registered database servers"
        actions={
          <PermissionGate permission="server:manage">
            <Button onClick={() => openWith('form', null)}>Add server</Button>
          </PermissionGate>
        }
      />

      {!servers.isLoading && rows.length === 0 ? (
        <EmptyState
          title="No servers yet"
          description="Register your first database server to start running backups, exports and clones."
          action={
            <PermissionGate permission="server:manage">
              <Button onClick={() => openWith('form', null)}>Add server</Button>
            </PermissionGate>
          }
        />
      ) : (
        <Table columns={columns} rows={rows} rowKey={(s) => s.id} loading={servers.isLoading} />
      )}

      <ServerFormModal open={modal === 'form'} onClose={close} server={active} />
      <BackupModal open={modal === 'backup'} onClose={close} server={active} />
      <ExportModal open={modal === 'export'} onClose={close} server={active} />
      <CloneModal open={modal === 'clone'} onClose={close} source={active} />
      <DatabasesModal open={modal === 'databases'} onClose={close} server={active} />
      <ConfirmDialog
        open={modal === 'delete'}
        title="Delete server"
        message={`Delete "${active?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleteServer.isPending}
        onConfirm={handleDelete}
        onClose={close}
      />
    </div>
  );
}
