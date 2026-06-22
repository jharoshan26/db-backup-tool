import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Table } from '@/components/Table';
import type { Column } from '@/components/Table';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { useAudit } from '@/hooks/useAudit';
import { formatDateTime } from '@/lib/format';
import type { AuditEntry } from '@/types';

const PAGE_SIZE = 20;

export function AuditPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const audit = useAudit({ q: query || undefined, page, pageSize: PAGE_SIZE });
  const rows = audit.data?.data ?? [];
  const total = audit.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(search.trim());
  };

  const columns: Column<AuditEntry>[] = [
    {
      key: 'actor',
      header: 'Actor',
      render: (a) => <span className="font-medium text-slate-800">{a.actorEmail}</span>,
    },
    { key: 'action', header: 'Action', render: (a) => <Badge tone="blue">{a.action}</Badge> },
    {
      key: 'target',
      header: 'Target',
      render: (a) => <span className="font-mono text-xs text-slate-600">{a.target}</span>,
    },
    {
      key: 'meta',
      header: 'Details',
      render: (a) =>
        a.meta && Object.keys(a.meta).length > 0 ? (
          <span className="font-mono text-xs text-slate-400" title={JSON.stringify(a.meta)}>
            {JSON.stringify(a.meta).slice(0, 48)}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    { key: 'created', header: 'When', render: (a) => formatDateTime(a.createdAt) },
  ];

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Searchable record of platform actions" />

      <form onSubmit={onSearch} className="mb-4 flex gap-2">
        <div className="w-full max-w-sm">
          <Input
            placeholder="Search by actor, action or target…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {query && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch('');
              setQuery('');
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </form>

      <Table
        columns={columns}
        rows={rows}
        rowKey={(a) => a.id}
        loading={audit.isLoading}
        empty="No audit entries"
      />

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>{total} entries</span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
