import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { useServerDatabases } from '@/hooks/useServers';
import { apiError } from '@/lib/api';
import type { Server } from '@/types';

export function DatabasesModal({
  open,
  onClose,
  server,
}: {
  open: boolean;
  onClose: () => void;
  server: Server | null;
}) {
  const databases = useServerDatabases(server?.id, open);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Databases — ${server?.name ?? ''}`}
      description="Databases discovered on this server"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {databases.isLoading ? (
        <p className="text-sm text-slate-400">Loading databases…</p>
      ) : databases.isError ? (
        <p className="text-sm text-red-600">{apiError(databases.error)}</p>
      ) : (databases.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-slate-400">No databases found.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {databases.data!.map((db) => (
            <Badge key={db} tone="blue">
              {db}
            </Badge>
          ))}
        </div>
      )}
    </Modal>
  );
}
