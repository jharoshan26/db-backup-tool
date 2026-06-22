import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Table } from '@/components/Table';
import type { Column } from '@/components/Table';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/Button';
import { useJobs } from '@/hooks/useJobs';
import { timeAgo } from '@/lib/format';
import type { Job, JobStatus } from '@/types';
import { JobDrawer } from './jobs/JobDrawer';

const FILTERS: { value: JobStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'queued', label: 'Queued' },
  { value: 'done', label: 'Done' },
  { value: 'failed', label: 'Failed' },
];

export function JobsPage() {
  const jobs = useJobs({ poll: true });
  const [selected, setSelected] = useState<Job | null>(null);
  const [filter, setFilter] = useState<JobStatus | 'all'>('all');

  const rows = useMemo(() => {
    const all = jobs.data?.data ?? [];
    return filter === 'all' ? all : all.filter((j) => j.status === filter);
  }, [jobs.data, filter]);

  const columns: Column<Job>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (j) => <span className="font-medium capitalize text-slate-800">{j.type}</span>,
    },
    { key: 'status', header: 'Status', render: (j) => <StatusBadge status={j.status} /> },
    {
      key: 'progress',
      header: 'Progress',
      render: (j) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${j.status === 'failed' ? 'bg-red-500' : 'bg-brand-500'}`}
              style={{ width: `${j.progress}%` }}
            />
          </div>
          <span className="text-xs text-slate-400">{j.progress}%</span>
        </div>
      ),
    },
    {
      key: 'id',
      header: 'Job ID',
      render: (j) => <span className="font-mono text-xs text-slate-400">{j.id.slice(0, 8)}</span>,
    },
    { key: 'created', header: 'Created', render: (j) => timeAgo(j.createdAt) },
  ];

  return (
    <div>
      <PageHeader
        title="Jobs"
        subtitle="Live status of backup, restore, export, import and clone operations"
        actions={
          <Button variant="secondary" size="sm" onClick={() => jobs.refetch()}>
            Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Table
        columns={columns}
        rows={rows}
        rowKey={(j) => j.id}
        loading={jobs.isLoading}
        onRowClick={(j) => setSelected(j)}
        empty="No jobs match this filter"
      />

      <JobDrawer
        jobId={selected?.id ?? null}
        initial={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
