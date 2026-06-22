import { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { Select } from '@/components/Select';
import { Input } from '@/components/Input';
import { useToast } from '@/components/Toast';
import { useRunBackup, useServerDatabases } from '@/hooks/useServers';
import { apiError } from '@/lib/api';
import type { BackupFormat, Server } from '@/types';

const FORMATS: { value: BackupFormat; label: string }[] = [
  { value: 'sql', label: 'Plain SQL' },
  { value: 'custom', label: 'Custom (compressed)' },
  { value: 'dump', label: 'Native dump' },
];

export function BackupModal({
  open,
  onClose,
  server,
}: {
  open: boolean;
  onClose: () => void;
  server: Server | null;
}) {
  const run = useRunBackup();
  const toast = useToast();
  const databases = useServerDatabases(server?.id, open);
  const [database, setDatabase] = useState('');
  const [format, setFormat] = useState<BackupFormat>('custom');

  useEffect(() => {
    if (open) {
      setDatabase('');
      setFormat('custom');
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!server) return;
    try {
      await run.mutateAsync({ serverId: server.id, input: { database, format } });
      toast.success('Backup job queued');
      onClose();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Run backup — ${server?.name ?? ''}`}
      description="Create an on-demand backup of a database"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="backup-form" type="submit" loading={run.isPending} disabled={!database}>
            Start backup
          </Button>
        </>
      }
    >
      <form id="backup-form" onSubmit={submit} className="space-y-4">
        {databases.isLoading ? (
          <p className="text-sm text-slate-400">Loading databases…</p>
        ) : databases.data && databases.data.length > 0 ? (
          <Select
            label="Database"
            placeholder="Select a database"
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
            options={databases.data.map((d) => ({ value: d, label: d }))}
          />
        ) : (
          <Input
            label="Database"
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
            placeholder="Enter database name"
          />
        )}
        <Select
          label="Format"
          value={format}
          onChange={(e) => setFormat(e.target.value as BackupFormat)}
          options={FORMATS}
        />
      </form>
    </Modal>
  );
}
