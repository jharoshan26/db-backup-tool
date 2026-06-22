import { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { Select } from '@/components/Select';
import { Input } from '@/components/Input';
import { useToast } from '@/components/Toast';
import { useClone, useServers, useServerDatabases } from '@/hooks/useServers';
import { apiError } from '@/lib/api';
import type { CloneMode, Server } from '@/types';

const MODES: { value: CloneMode; label: string }[] = [
  { value: 'full', label: 'Full (schema + data)' },
  { value: 'schema', label: 'Schema only' },
];

export function CloneModal({
  open,
  onClose,
  source,
}: {
  open: boolean;
  onClose: () => void;
  source: Server | null;
}) {
  const clone = useClone();
  const toast = useToast();
  const servers = useServers();
  const databases = useServerDatabases(source?.id, open);

  const [targetServerId, setTargetServerId] = useState('');
  const [database, setDatabase] = useState('');
  const [targetDatabase, setTargetDatabase] = useState('');
  const [mode, setMode] = useState<CloneMode>('full');

  useEffect(() => {
    if (open) {
      setTargetServerId(source?.id ?? '');
      setDatabase('');
      setTargetDatabase('');
      setMode('full');
    }
  }, [open, source]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source) return;
    try {
      await clone.mutateAsync({
        sourceServerId: source.id,
        targetServerId,
        database,
        targetDatabase,
        mode,
      });
      toast.success('Clone job queued');
      onClose();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const serverOptions = (servers.data?.data ?? []).map((s) => ({
    value: s.id,
    label: `${s.name} (${s.engine})`,
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Clone database — ${source?.name ?? ''}`}
      description="Copy a database to another server"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            form="clone-form"
            type="submit"
            loading={clone.isPending}
            disabled={!database || !targetServerId || !targetDatabase}
          >
            Start clone
          </Button>
        </>
      }
    >
      <form id="clone-form" onSubmit={submit} className="space-y-4">
        {databases.data && databases.data.length > 0 ? (
          <Select
            label="Source database"
            placeholder="Select a database"
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
            options={databases.data.map((d) => ({ value: d, label: d }))}
          />
        ) : (
          <Input
            label="Source database"
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
            placeholder="Enter database name"
          />
        )}
        <Select
          label="Target server"
          placeholder="Select target server"
          value={targetServerId}
          onChange={(e) => setTargetServerId(e.target.value)}
          options={serverOptions}
        />
        <Input
          label="Target database"
          value={targetDatabase}
          onChange={(e) => setTargetDatabase(e.target.value)}
          placeholder="cloned_db"
        />
        <Select
          label="Mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as CloneMode)}
          options={MODES}
        />
      </form>
    </Modal>
  );
}
