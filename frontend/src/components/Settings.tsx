import { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Download, Trash2, FileText, Loader2, Server, AlertCircle, Upload } from 'lucide-react';
import * as api from '../api/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

type ActionType = 'backup' | 'restore' | 'cache' | 'logs';

type ApiResponse = {
  success?: boolean;
  message?: string;
  safety_backup?: string | null;
  data?: {
    safety_backup?: string | null;
    note?: string;
  };
  note?: string;
};

export default function Settings() {
  const [loading, setLoading] = useState<Record<ActionType, boolean>>({
    backup: false,
    restore: false,
    cache: false,
    logs: false,
  });
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  const parseJsonResponse = async (response: Response): Promise<ApiResponse> => {
    const text = await response.text();
    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text) as ApiResponse;
    } catch {
      throw new Error('Server returned an invalid response.');
    }
  };

  const handleExportBackup = async () => {
    setLoading((prev) => ({ ...prev, backup: true }));
    try {
      const { data } = await api.get('/api/settings/export-backup', {
        responseType: 'blob',
      });
      const blob = new Blob([data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.download = `backup-${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Backup exported successfully!');
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to export backup.';
      toast.error(message);
    } finally {
      setLoading((prev) => ({ ...prev, backup: false }));
    }
  };

  const uploadRestoreBackup = async (fileList: FileList | null) => {
    const file = fileList?.[0] ?? null;
    if (!file) {
      toast.error('Please select a backup file to restore.');
      return;
    }

    const fileName = file.name.toLowerCase();
    const isValidBackup = fileName.endsWith('.sql') || fileName.endsWith('.zip');
    if (!isValidBackup) {
      toast.error('Please upload a .sql or .zip backup file.');
      return;
    }

    const confirmed = window.confirm(
      'Restoring a backup will replace the current database data. A safety backup will be created first, but automatic rollback is not guaranteed if restore fails midway. Do you want to continue?'
    );

    if (!confirmed) {
      if (restoreInputRef.current) {
        restoreInputRef.current.value = '';
      }
      return;
    }

    const formData = new FormData();
    formData.append('backup', file);

    setLoading((prev) => ({ ...prev, restore: true }));

    try {
      const token = api.tokenUtils.getAccessToken();
      const response = await fetch(api.resolveApiUrl('/api/settings/restore-backup'), {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json',
        },
        body: formData,
      });

      const payload = await parseJsonResponse(response);
      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || 'Failed to restore backup.');
      }

      const safetyBackup = payload.data?.safety_backup ?? payload.safety_backup;
      toast.success(
        safetyBackup
          ? `Database restored successfully. Safety backup created: ${safetyBackup}`
          : 'Database restored successfully.'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to restore backup.');
    } finally {
      setLoading((prev) => ({ ...prev, restore: false }));
      if (restoreInputRef.current) {
        restoreInputRef.current.value = '';
      }
    }
  };

  const handleClear = async (type: 'cache' | 'logs') => {
    const endpoint = type === 'cache' ? '/api/settings/clear-caches' : '/api/settings/clear-logs';
    const successMessage = type === 'cache' ? 'Caches cleared successfully!' : 'Logs cleared successfully!';
    const errorMessage = type === 'cache' ? 'Failed to clear caches.' : 'Failed to clear logs.';

    setLoading((prev) => ({ ...prev, [type]: true }));
    try {
      const { data } = await api.post(endpoint);
      if (data.success) {
        toast.success(successMessage);
      } else {
        toast.error(data.message || errorMessage);
      }
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || errorMessage;
      toast.error(message);
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      transition={{
        delay: 0.1,
        duration: 0.25,
        type: 'tween',
      }}
      className="space-y-4 p-0 sm:p-4"
    >
      <div>
        <h1 className="font-bold text-lg">Application Settings</h1>
        <p className="text-muted-foreground">Manage system-level settings and data.</p>
      </div>

      <div className="gap-6 grid md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>Export or restore backups of your application data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-4 border rounded-lg gap-4">
              <div>
                <h3 className="font-semibold">Export Database Backup</h3>
                <p className="text-muted-foreground text-sm">Download a zip file containing the database.</p>
              </div>
              <Button onClick={handleExportBackup} disabled={loading.backup} className="bg-[#008ea2] hover:bg-[#007a8b]">
                {loading.backup ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Download className="mr-2 w-4 h-4" />}
                Export
              </Button>
            </div>

            <div className="flex justify-between items-center p-4 border rounded-lg gap-4">
              <div>
                <h3 className="font-semibold">Restore Database Backup</h3>
                <p className="text-muted-foreground text-sm">
                  Upload a <span className="font-medium">.sql</span> or <span className="font-medium">.zip</span> backup exported from this app.
                </p>
              </div>
              <>
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept=".sql,.zip,application/sql,application/zip"
                  className="hidden"
                  onChange={(event) => uploadRestoreBackup(event.target.files)}
                />
                <Button
                  variant="outline"
                  onClick={() => restoreInputRef.current?.click()}
                  disabled={loading.restore}
                >
                  {loading.restore ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Upload className="mr-2 w-4 h-4" />}
                  Restore
                </Button>
              </>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Maintenance</CardTitle>
            <CardDescription>Clear temporary system data like caches and logs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-4 border rounded-lg gap-4">
              <div>
                <h3 className="font-semibold">Clear Caches</h3>
                <p className="text-muted-foreground text-sm">Remove all application cache files.</p>
              </div>
              <Button variant="destructive" onClick={() => handleClear('cache')} disabled={loading.cache}>
                {loading.cache ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Trash2 className="mr-2 w-4 h-4" />}
                Clear
              </Button>
            </div>
            <div className="flex justify-between items-center p-4 border rounded-lg gap-4">
              <div>
                <h3 className="font-semibold">Clear Logs</h3>
                <p className="text-muted-foreground text-sm">Remove all application log files.</p>
              </div>
              <Button variant="destructive" onClick={() => handleClear('logs')} disabled={loading.logs}>
                {loading.logs ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <FileText className="mr-2 w-4 h-4" />}
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert className="justify-start">
        <Server className="w-4 h-4" />
        <AlertTitle>Server Configuration</AlertTitle>
        <AlertDescription>
          The `SESSION_LIFETIME` is configured on the server. To modify it, you need to update the `.env` file on the server and restart the application services.
        </AlertDescription>
      </Alert>

      <Alert variant="destructive" className="justify-start">
        <AlertCircle className="w-4 h-4" />
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>
          Restore will replace the current database contents. A safety backup is created first, but if SQL restore fails halfway, full automatic rollback is not guaranteed.
        </AlertDescription>
      </Alert>
    </motion.div>
  );
}
