import { Drawer } from '@/components/Drawer';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/Badge';
import { useJobStream } from '@/hooks/useJobs';
import { formatDateTime } from '@/lib/format';
import type { Job } from '@/types';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{children}</span>
    </div>
  );
}

export function JobDrawer({
  jobId,
  initial,
  onClose,
}: {
  jobId: string | null;
  initial?: Job | null;
  onClose: () => void;
}) {
  const { job: live, transport } = useJobStream(jobId ?? undefined);
  const job = live ?? initial ?? null;

  return (
    <Drawer open={!!jobId} onClose={onClose} title="Job details" width="max-w-lg">
      {!job ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <StatusBadge status={job.status} />
            {transport !== 'idle' && (
              <Badge tone={transport === 'sse' ? 'green' : 'amber'}>
                {transport === 'sse' ? 'live (SSE)' : 'polling'}
              </Badge>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
              <span>Progress</span>
              <span>{job.progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  job.status === 'failed' ? 'bg-red-500' : 'bg-brand-500'
                }`}
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>

          <div>
            <Row label="ID">
              <span className="font-mono text-xs">{job.id}</span>
            </Row>
            <Row label="Type">
              <span className="capitalize">{job.type}</span>
            </Row>
            <Row label="Created">{formatDateTime(job.createdAt)}</Row>
          </div>

          {job.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="mb-1 font-semibold">Error</p>
              <p className="whitespace-pre-wrap break-words">{job.error}</p>
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Parameters
            </p>
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
              {JSON.stringify(job.params ?? {}, null, 2)}
            </pre>
          </div>

          {job.result && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Result
              </p>
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                {JSON.stringify(job.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
