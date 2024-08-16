'use client';

import { AdminPageHeading } from '@/components/admin-page-heading';
import { Loader } from '@/components/loader';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading () {
  return (
    <AdminPageHeading title={<Skeleton className="h-4 w-40 rounded" />} />
  );
}