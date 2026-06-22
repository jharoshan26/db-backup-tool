import { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { Select } from '@/components/Select';
import { Input } from '@/components/Input';
import { useToast } from '@/components/Toast';
import { useExport, useServerDatabases } from '@/hooks/useServers';
import { apiError } from '@/lib/api';
import type { ExportFormat, Server } from '@/types';

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel (xlsx)' },
  { value: 'sql', label: 'SQL inserts' },
];

export function ExportModal({
  open,
  onClose,
  server,
}: {
  open: boolean;
  onClose: () => void;
  server: Server | null;
}) {
  const exportMut = useExport();
  const toast = useToast();
  const databases = useServerDatabases(server?.id, open);
  const [database, setDatabase] = useState('');
  const [table, setTable] = useState('');
  const [format, setFormat] = useState<ExportFormat>('csv');

  useEffect(() => {
    if (open) {
      setDatabase('');
      setTable('');
      setFormat('csv');
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!server) return;
    try {
      await exportMut.mutateAsync({ serverId: server.id, input: { database, table, format } });
      toast.success('Export job queued');
      onClose();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Export data — ${server?.name ?? ''}`}
      description="Export a table to CSV, Excel or SQL"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            form="export-form"
            type="submit"
            loading={exportMut.isPending}
            disabled={!database || !table}
          >
            Start export
          </Button>
        </>
      }
    >
      <form id="export-form" onSubmit={submit} className="space-y-4">
        {databases.data && databases.data.length > 0 ? (
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
        <Input
          label="Table"
          value={table}
          onChange={(e) => setTable(e.target.value)}
          placeholder="public.users"
        />
        <Select
          label="Format"
          value={format}
          onChange={(e) => setFormat(e.target.value as ExportFormat)}
          options={FORMATS}
        />
      </form>
    </Modal>
  );
}
