'use client';

import { DataTable } from '@/components/database/DataTable';
import { ViewBar } from '@/components/ui/ViewBar';
import { useViewConfig } from '@/hooks/useViewConfig';

export default function DatabasePage() {
  const viewConfig = useViewConfig('database');

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-lg font-semibold mb-4">Database</h1>
      <ViewBar
        views={viewConfig.views}
        activeViewId={viewConfig.activeViewId}
        onSwitchView={viewConfig.switchView}
        onCreateView={viewConfig.createView}
        onRenameView={viewConfig.renameView}
      />
      <DataTable viewConfig={viewConfig} />
    </div>
  );
}
