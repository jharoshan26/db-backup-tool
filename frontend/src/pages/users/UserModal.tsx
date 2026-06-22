import { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { useToast } from '@/components/Toast';
import { useCreateUser, useRoles } from '@/hooks/useUsers';
import { apiError } from '@/lib/api';

export function UserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateUser();
  const roles = useRoles();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState('');

  useEffect(() => {
    if (open) {
      setEmail('');
      setName('');
      setRoleId('');
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ email, name: name || undefined, roleId: roleId || undefined });
      toast.success('User invited');
      onClose();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const roleOptions = (roles.data ?? []).map((r) => ({ value: r.id, label: r.name }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite user"
      description="Send an invitation and optionally assign a role"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="user-form" type="submit" loading={create.isPending} disabled={!email}>
            Send invite
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@company.com"
          required
        />
        <Input
          label="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
        />
        <Select
          label="Role (optional)"
          placeholder="No role"
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          options={roleOptions}
        />
      </form>
    </Modal>
  );
}
