import { useMemo, useState } from 'react';
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
import { useDeleteSchedule, useSchedules, useUpdateSchedule } from '@/hooks/useSchedules';
import { useServers } from '@/hooks/useServers';
import { apiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Schedule } from '@/types';
import { ScheduleModal } from './schedules/ScheduleModal';

export function SchedulesPage() {
  const schedules = useSchedules();
  const servers = useServers();
  const update = useUpdateSchedule();
  const del = useDeleteSchedule();
  const toast = useToast();

  const [editing, setEditing] = useState<Schedule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Schedule | null>(null);

  const serverName = useMemo(() => {
    const map = new Map((servers.data?.data ?? []).map((s) => [s.id, s.name]));
    return (id: string) => map.get(id) ?? id;
  }, [servers.data]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (s: Schedule) => {
    setEditing(s);
    setFormOpen(true);
  };

  const toggleEnabled = async (s: Schedule) => {
    try {
      await update.mutateAsync({ id: s.id, input: { enabled: !s.enabled } });
      toast.success(s.enabled ? 'Schedule paused' : 'Schedule enabled');
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await del.mutateAsync(deleting.id);
      toast.success('Schedule deleted');
      setDeleting(null);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const columns: Column<Schedule>[] = [
    {
      key: 'database',
      header: 'Target',
      render: (s) => (
        <div>
          <p className="font-medium text-slate-900">{s.database}</p>
          <p className="text-xs text-slate-400">{serverName(s.serverId)}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (s) => <Badge tone="blue">{s.type}</Badge> },
    {
      key: 'cron',
      header: 'Cron',
      render: (s) => <span className="font-mono text-xs text-slate-600">{s.cron}</span>,
    },
    { key: 'retention', header: 'Retention', render: (s) => `${s.retention} copies` },
    {
      key: 'enabled',
      header: 'Status',
      render: (s) =>
        s.enabled ? <Badge tone="green">Enabled</Badge> : <Badge tone="slate">Paused</Badge>,
    },
    { key: 'created', header: 'Created', render: (s) => formatDateTime(s.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right w-px',
      render: (s) => (
        <Menu
          actions={[
            { label: s.enabled ? 'Pause' : 'Enable', onClick: () => toggleEnabled(s) },
            { label: 'Edit', onClick: () => openEdit(s) },
            { label: 'Delete', danger: true, onClick: () => setDeleting(s) },
          ]}
        />
      ),
    },
  ];

  const rows = schedules.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Schedules"
        subtitle="Automated recurring backups"
        actions={
          <PermissionGate permission="schedule:manage">
            <Button onClick={openCreate}>Create schedule</Button>
          </PermissionGate>
        }
      />

      {!schedules.isLoading && rows.length === 0 ? (
        <EmptyState
          title="No schedules"
          description="Create a schedule to run backups automatically on a cron cadence."
          action={
            <PermissionGate permission="schedule:manage">
              <Button onClick={openCreate}>Create schedule</Button>
            </PermissionGate>
          }
        />
      ) : (
        <Table columns={columns} rows={rows} rowKey={(s) => s.id} loading={schedules.isLoading} />
      )}

      <ScheduleModal open={formOpen} onClose={() => setFormOpen(false)} schedule={editing} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete schedule"
        message={`Delete the schedule for "${deleting?.database}"?`}
        confirmLabel="Delete"
        danger
        loading={del.isPending}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
