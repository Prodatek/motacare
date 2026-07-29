import { cn, statusColour } from '@/lib/utils';

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('badge', statusColour(status))}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
