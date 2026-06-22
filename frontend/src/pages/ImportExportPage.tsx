import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Select } from '@/components/Select';
import { Input } from '@/components/Input';
import { useToast } from '@/components/Toast';
import { useServers, useServerDatabases, useExport } from '@/hooks/useServers';
import { useImport, fileToBase64 } from '@/hooks/useImport';
import { apiError } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import type { ExportFormat, ImportFormat } from '@/types';

type Tab = 'import' | 'export';

const EXPORT_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel (xlsx)' },
  { value: 'sql', label: 'SQL inserts' },
];

const IMPORT_FORMATS: { value: ImportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel (xlsx)' },
];

function ServerDatabaseSelect({
  serverId,
  onServer,
  database,
  onDatabase,
}: {
  serverId: string;
  onServer: (id: string) => void;
  database: string;
  onDatabase: (db: string) => void;
}) {
  const servers = useServers();
  const databases = useServerDatabases(serverId || undefined, !!serverId);
  const serverOptions = (servers.data?.data ?? []).map((s) => ({
    value: s.id,
    label: `${s.name} (${s.engine})`,
  }));

  return (
    <>
      <Select
        label="Server"
        placeholder="Select a server"
        value={serverId}
        onChange={(e) => {
          onServer(e.target.value);
          onDatabase('');
        }}
        options={serverOptions}
      />
      {serverId && databases.data && databases.data.length > 0 ? (
        <Select
          label="Database"
          placeholder="Select a database"
          value={database}
          onChange={(e) => onDatabase(e.target.value)}
          options={databases.data.map((d) => ({ value: d, label: d }))}
        />
      ) : (
        <Input
          label="Database"
          value={database}
          onChange={(e) => onDatabase(e.target.value)}
          placeholder="Enter database name"
          disabled={!serverId}
        />
      )}
    </>
  );
}

function ImportForm() {
  const importMut = useImport();
  const toast = useToast();
  const [serverId, setServerId] = useState('');
  const [database, setDatabase] = useState('');
  const [table, setTable] = useState('');
  const [format, setFormat] = useState<ImportFormat>('csv');
  const [file, setFile] = useState<File | null>(null);

  const onFile = (f: File | null) => {
    setFile(f);
    if (f) {
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (ext === 'csv') setFormat('csv');
      else if (ext === 'xlsx' || ext === 'xls') setFormat('xlsx');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please choose a file to import');
      return;
    }
    try {
      const fileBase64 = await fileToBase64(file);
      await importMut.mutateAsync({ serverId, database, table, format, fileBase64 });
      toast.success('Import job queued');
      setFile(null);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Import data</h2>
      <p className="mb-4 text-sm text-slate-500">Upload a CSV or Excel file into a table.</p>
      <form onSubmit={submit} className="space-y-4">
        <ServerDatabaseSelect
          serverId={serverId}
          onServer={setServerId}
          database={database}
          onDatabase={setDatabase}
        />
        <Input
          label="Table"
          value={table}
          onChange={(e) => setTable(e.target.value)}
          placeholder="public.users"
        />
        <Select
          label="Format"
          value={format}
          onChange={(e) => setFormat(e.target.value as ImportFormat)}
          options={IMPORT_FORMATS}
        />
        <div>
          <span className="label-base">File</span>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-brand-400">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <span className="text-sm text-slate-700">
                {file.name}{' '}
                <span className="text-slate-400">({formatBytes(file.size)})</span>
              </span>
            ) : (
              <span className="text-sm text-slate-500">Click to choose a CSV or Excel file</span>
            )}
          </label>
        </div>
        <Button
          type="submit"
          loading={importMut.isPending}
          disabled={!serverId || !database || !table || !file}
        >
          Start import
        </Button>
      </form>
    </Card>
  );
}

function ExportForm() {
  const exportMut = useExport();
  const toast = useToast();
  const [serverId, setServerId] = useState('');
  const [database, setDatabase] = useState('');
  const [table, setTable] = useState('');
  const [format, setFormat] = useState<ExportFormat>('csv');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await exportMut.mutateAsync({ serverId, input: { database, table, format } });
      toast.success('Export job queued');
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Export data</h2>
      <p className="mb-4 text-sm text-slate-500">Export a table to CSV, Excel or SQL.</p>
      <form onSubmit={submit} className="space-y-4">
        <ServerDatabaseSelect
          serverId={serverId}
          onServer={setServerId}
          database={database}
          onDatabase={setDatabase}
        />
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
          options={EXPORT_FORMATS}
        />
        <Button
          type="submit"
          loading={exportMut.isPending}
          disabled={!serverId || !database || !table}
        >
          Start export
        </Button>
      </form>
    </Card>
  );
}

export function ImportExportPage() {
  const [tab, setTab] = useState<Tab>('export');

  return (
    <div>
      <PageHeader title="Import / Export" subtitle="Move tabular data in and out of your databases" />

      <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {(['export', 'import'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="max-w-xl">{tab === 'export' ? <ExportForm /> : <ImportForm />}</div>
    </div>
  );
}
