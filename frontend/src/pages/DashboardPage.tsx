import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/Card';
import { Table } from '@/components/Table';
import type { Column } from '@/components/Table';
import { StatusBadge } from '@/components/StatusBadge';
import { useServers } from '@/hooks/useServers';
import { useBackups } from '@/hooks/useBackups';
import { useJobs } from '@/hooks/useJobs';
import { formatDateTime, timeAgo } from '@/lib/format';
import type { Job } from '@/types';

export function DashboardPage() {
  const servers = useServers();
  const backups = useBackups();
  const jobs = useJobs({ poll: true });

  const jobList = jobs.data?.data ?? [];
  const running = jobList.filter((j) => j.status === 'running' || j.status === 'queued').length;
  const failures = jobList.filter((j) => j.status === 'failed');

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
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${j.progress}%` }} />
          </div>
          <span className="text-xs text-slate-400">{j.progress}%</span>
        </div>
      ),
    },
    { key: 'createdAt', header: 'Created', render: (j) => timeAgo(j.createdAt) },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your backup infrastructure" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Servers"
          value={servers.isLoading ? '—' : (servers.data?.total ?? 0)}
          icon="🖧"
          tone="brand"
        />
        <StatCard
          label="Backups"
          value={backups.isLoading ? '—' : (backups.data?.total ?? 0)}
          icon="🛢"
          tone="green"
        />
        <StatCard
          label="Running Jobs"
          value={jobs.isLoading ? '—' : running}
          icon="⚙"
          tone="amber"
          hint="queued + running"
        />
        <StatCard
          label="Recent Failures"
          value={jobs.isLoading ? '—' : failures.length}
          icon="⚠"
          tone="red"
        />
      </div>

      {failures.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="mb-2 text-sm font-semibold text-red-800">Recent failures</p>
          <ul className="space-y-1 text-sm text-red-700">
            {failures.slice(0, 5).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3">
                <span className="capitalize">
                  {f.type} — {f.error ?? 'unknown error'}
                </span>
                <span className="text-xs text-red-500">{formatDateTime(f.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Recent jobs</h2>
        <Link to="/jobs" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          View all →
        </Link>
      </div>
      <Table
        columns={columns}
        rows={jobList.slice(0, 8)}
        rowKey={(j) => j.id}
        loading={jobs.isLoading}
        empty="No jobs yet"
      />
    </div>
  );
}
