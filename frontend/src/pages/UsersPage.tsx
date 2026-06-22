import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Table } from '@/components/Table';
import type { Column } from '@/components/Table';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Select } from '@/components/Select';
import { Menu } from '@/components/Menu';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { useAssignRole, useDeleteUser, useRoles, useUsers } from '@/hooks/useUsers';
import { apiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { User } from '@/types';
import { UserModal } from './users/UserModal';

export function UsersPage() {
  const users = useUsers();
  const roles = useRoles();
  const assignRole = useAssignRole();
  const deleteUser = useDeleteUser();
  const toast = useToast();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);

  const roleOptions = (roles.data ?? []).map((r) => ({ value: r.id, label: r.name }));

  const handleAssign = async (userId: string, roleId: string) => {
    if (!roleId) return;
    try {
      await assignRole.mutateAsync({ userId, roleId });
      toast.success('Role assigned');
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteUser.mutateAsync(deleting.id);
      toast.success('User removed');
      setDeleting(null);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const columns: Column<User>[] = [
    {
      key: 'user',
      header: 'User',
      render: (u) => (
        <div>
          <p className="font-medium text-slate-900">{u.name || u.email}</p>
          <p className="text-xs text-slate-400">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (u) =>
        u.roles && u.roles.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {u.roles.map((r) => (
              <Badge key={r.id} tone="purple">
                {r.name}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      key: 'assign',
      header: 'Assign role',
      render: (u) => (
        <div className="w-40">
          <Select
            placeholder="Select role"
            options={roleOptions}
            value=""
            onChange={(e) => handleAssign(u.id, e.target.value)}
          />
        </div>
      ),
    },
    { key: 'created', header: 'Joined', render: (u) => formatDateTime(u.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right w-px',
      render: (u) => (
        <Menu actions={[{ label: 'Remove user', danger: true, onClick: () => setDeleting(u) }]} />
      ),
    },
  ];

  const rows = users.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        subtitle="Manage team access"
        actions={<Button onClick={() => setInviteOpen(true)}>Invite user</Button>}
      />

      <Table columns={columns} rows={rows} rowKey={(u) => u.id} loading={users.isLoading} />

      <UserModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <ConfirmDialog
        open={!!deleting}
        title="Remove user"
        message={`Remove ${deleting?.email}? They will lose all access.`}
        confirmLabel="Remove"
        danger
        loading={deleteUser.isPending}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
