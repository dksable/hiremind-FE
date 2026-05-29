import type { ReactNode } from "react";
import { Inbox, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
};

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="grid min-h-32 place-items-center rounded-md border border-dashed bg-muted/20 px-4 py-8 text-center">
      <div className="space-y-2">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-md bg-muted text-muted-foreground">
          {icon || <Inbox className="h-5 w-5" />}
        </div>
        <div className="text-sm font-medium">{title}</div>
        {description && <div className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</div>}
      </div>
    </div>
  );
}

export function InlineLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="grid min-h-24 place-items-center text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </div>
    </div>
  );
}

export function TableSkeletonRows({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b transition-colors">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <td key={columnIndex} className="p-4 align-middle">
              <Skeleton className="h-4 w-full max-w-36" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function DrawerSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-3/4" />
    </div>
  );
}
