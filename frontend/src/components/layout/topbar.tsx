'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Filter, RefreshCcw, Search } from 'lucide-react';

interface TopbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onRefresh?: () => void;
}

/** Render the Topbar component. */
export default function Topbar({ search, onSearchChange, onRefresh }: TopbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-white p-4 shadow-sm ">
      <div className="relative flex-1 min-w-[240px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder="Search recipients, subjects, campaigns"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" className="h-11 w-11 p-0" aria-label="Filter" title="Filter">
          <Filter className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          className="h-11 w-11 p-0"
          onClick={() => onRefresh?.()}
          aria-label="Refresh"
          title="Refresh"
        >
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

