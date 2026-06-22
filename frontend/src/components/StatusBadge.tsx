import { Badge } from './Badge';
import type { JobStatus } from '@/types';

type Status = JobStatus | 'available' | string;

const map: Record<string, { tone: 'slate' | 'blue' | 'green' | 'amber' | 'red'; label: string }> = {
  queued: { tone: 'amber', label: 'Queued' },
  running: { tone: 'blue', label: 'Running' },
  done: { tone: 'green', label: 'Done' },
  available: { tone: 'green', label: 'Available' },
  failed: { tone: 'red', label: 'Failed' },
};

export function StatusBadge({ status }: { status: Status }) {
  const entry = map[status] ?? { tone: 'slate' as const, label: status };
  return (
    <Badge tone={entry.tone}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {entry.label}
    </Badge>
  );
}
