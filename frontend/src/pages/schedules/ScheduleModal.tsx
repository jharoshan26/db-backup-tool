import { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { Select } from '@/components/Select';
import { Input } from '@/components/Input';
import { useToast } from '@/components/Toast';
import { useCreateSchedule, useUpdateSchedule } from '@/hooks/useSchedules';
import { useServers, useServerDatabases } from '@/hooks/useServers';
import { apiError } from '@/lib/api';
import type { Schedule, ScheduleInput } from '@/types';

const CRON_PRESETS = [
  { value: '0 2 * * *', label: 'Daily at 02:00' },
  { value: '0 */6 * * *', label: 'Every 6 hours' },
  { value: '0 3 * * 0', label: 'Weekly (Sun 03:00)' },
  { value: '0 4 1 * *', label: 'Monthly (1st 04:00)' },
];

export function ScheduleModal({
  open,
  onClose,
  schedule,
}: {
  open: boolean;
  onClose: () => void;
  schedule?: Schedule | null;
}) {
  const isEdit = !!schedule;
  const create = useCreateSchedule();
  const update = useUpdateSchedule();
  const toast = useToast();
  const servers = useServers();

  const [form, setForm] = useState<ScheduleInput>({
    serverId: '',
    database: '',
    type: 'backup',
    cron: '0 2 * * *',
    enabled: true,
    retention: 7,
  });

  const databases = useServerDatabases(form.serverId || undefined, open && !!form.serverId);

  useEffect(() => {
    if (open) {
      if (schedule) {
        setForm({
          serverId: schedule.serverId,
          database: schedule.database,
          type: schedule.type,
          cron: schedule.cron,
          enabled: schedule.enabled,
          retention: schedule.retention,
        });
      } else {
        setForm({
          serverId: '',
          database: '',
          type: 'backup',
          cron: '0 2 * * *',
          enabled: true,
          retention: 7,
        });
      }
    }
  }, [open, schedule]);

  const set = <K extends keyof ScheduleInput>(key: K, value: ScheduleInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEdit && schedule) {
        await update.mutateAsync({ id: schedule.id, input: form });
        toast.success('Schedule updated');
      } else {
        await create.mutateAsync(form);
        toast.success('Schedule created');
      }
      onClose();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const serverOptions = (servers.data?.data ?? []).map((s) => ({
    value: s.id,
    label: `${s.name} (${s.engine})`,
  }));

  const pending = create.isPending || update.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit schedule' : 'Create schedule'}
      description="Automated recurring backups"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            form="schedule-form"
            type="submit"
            loading={pending}
            disabled={!form.serverId || !form.database || !form.cron}
          >
            {isEdit ? 'Save changes' : 'Create schedule'}
          </Button>
        </>
      }
    >
      <form id="schedule-form" onSubmit={submit} className="space-y-4">
        <Select
          label="Server"
          placeholder="Select a server"
          value={form.serverId}
          onChange={(e) => set('serverId', e.target.value)}
          options={serverOptions}
        />
        {form.serverId && databases.data && databases.data.length > 0 ? (
          <Select
            label="Database"
            placeholder="Select a database"
            value={form.database}
            onChange={(e) => set('database', e.target.value)}
            options={databases.data.map((d) => ({ value: d, label: d }))}
          />
        ) : (
          <Input
            label="Database"
            value={form.database}
            onChange={(e) => set('database', e.target.value)}
            placeholder="Enter database name"
          />
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Cron expression"
            value={form.cron}
            onChange={(e) => set('cron', e.target.value)}
            placeholder="0 2 * * *"
            hint="min hour day month weekday"
          />
          <Input
            label="Retention (copies)"
            type="number"
            min={1}
            value={form.retention}
            onChange={(e) => set('retention', Number(e.target.value))}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {CRON_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => set('cron', p.value)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                form.cron === p.value
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-300"
          />
          Enabled
        </label>
      </form>
    </Modal>
  );
}
