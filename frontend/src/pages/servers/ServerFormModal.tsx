import { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { useToast } from '@/components/Toast';
import { useCreateServer, useUpdateServer } from '@/hooks/useServers';
import { apiError } from '@/lib/api';
import type { Engine, Server, ServerCreateInput } from '@/types';

const ENGINES: { value: Engine; label: string }[] = [
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mariadb', label: 'MariaDB' },
];

const DEFAULT_PORTS: Record<Engine, number> = { postgres: 5432, mysql: 3306, mariadb: 3306 };

const SSL_MODES = ['disable', 'require', 'verify-ca', 'verify-full'].map((m) => ({
  value: m,
  label: m,
}));

export function ServerFormModal({
  open,
  onClose,
  server,
}: {
  open: boolean;
  onClose: () => void;
  server?: Server | null;
}) {
  const isEdit = !!server;
  const create = useCreateServer();
  const update = useUpdateServer();
  const toast = useToast();

  const [form, setForm] = useState<ServerCreateInput>({
    name: '',
    engine: 'postgres',
    host: '',
    port: 5432,
    sslMode: 'disable',
    username: '',
    password: '',
    database: '',
  });

  useEffect(() => {
    if (open) {
      if (server) {
        setForm({
          name: server.name,
          engine: server.engine,
          host: server.host,
          port: server.port,
          sslMode: server.sslMode,
          username: '',
          password: '',
          database: '',
        });
      } else {
        setForm({
          name: '',
          engine: 'postgres',
          host: '',
          port: 5432,
          sslMode: 'disable',
          username: '',
          password: '',
          database: '',
        });
      }
    }
  }, [open, server]);

  const set = <K extends keyof ServerCreateInput>(key: K, value: ServerCreateInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onEngineChange = (engine: Engine) =>
    setForm((f) => ({ ...f, engine, port: DEFAULT_PORTS[engine] }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEdit && server) {
        const { username, password, database, ...rest } = form;
        const patch = {
          ...rest,
          ...(username ? { username } : {}),
          ...(password ? { password } : {}),
          ...(database ? { database } : {}),
        };
        await update.mutateAsync({ id: server.id, input: patch });
        toast.success('Server updated');
      } else {
        await create.mutateAsync(form);
        toast.success('Server created');
      }
      onClose();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit server' : 'Add server'}
      description={isEdit ? 'Update connection details' : 'Register a new database server'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="server-form" type="submit" loading={pending}>
            {isEdit ? 'Save changes' : 'Create server'}
          </Button>
        </>
      }
    >
      <form id="server-form" onSubmit={submit} className="space-y-4">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Production Primary"
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Engine"
            options={ENGINES}
            value={form.engine}
            onChange={(e) => onEngineChange(e.target.value as Engine)}
          />
          <Input
            label="Port"
            type="number"
            value={form.port}
            onChange={(e) => set('port', Number(e.target.value))}
            required
          />
        </div>
        <Input
          label="Host"
          value={form.host}
          onChange={(e) => set('host', e.target.value)}
          placeholder="db.internal.company.com"
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Username"
            value={form.username}
            onChange={(e) => set('username', e.target.value)}
            placeholder="admin"
            required={!isEdit}
            hint={isEdit ? 'Leave blank to keep current' : undefined}
          />
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            placeholder="••••••••"
            required={!isEdit}
            hint={isEdit ? 'Leave blank to keep current' : undefined}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="SSL mode"
            options={SSL_MODES}
            value={form.sslMode}
            onChange={(e) => set('sslMode', e.target.value)}
          />
          <Input
            label="Default database (optional)"
            value={form.database ?? ''}
            onChange={(e) => set('database', e.target.value)}
            placeholder="postgres"
          />
        </div>
      </form>
    </Modal>
  );
}
