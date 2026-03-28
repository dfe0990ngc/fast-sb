import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Edit, Eye, FileText, Loader2, ServerCrash, Truck } from 'lucide-react';
import { Franchise } from '../../types/types';
import * as api from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { streamPdfToBrowser } from '../../lib/pdfStream';
import { formatDate, getStatusColor, getStatusLabel, isExpiredAlready, isExpiringSoon } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { FranchiseDocument, extractFranchiseDocuments } from './franchiseDocuments.helpers';

interface ViewFranchiseDialogProps {
  open: boolean;
  onClose: () => void;
  franchise: Franchise | null;
  onEdit: () => void;
}

type FranchiseApiPayload = {
  success?: boolean;
  message?: string;
  franchise?: Franchise & {
    documents?: FranchiseDocument[];
    Documents?: FranchiseDocument[];
  };
  franchise_histories?: any[];
};

const getActionTypeColor = (actionType: string) => {
  switch (actionType) {
    case 'drop':
      return 'text-red-800';
    case 'new':
      return 'text-blue-800';
    case 'renew':
      return 'text-green-800';
    case 'update':
      return 'text-gray-800';
    default:
      return 'text-gray-700';
  }
};

const formatFileSize = (bytes?: number) => {
  if (!bytes || Number.isNaN(bytes)) return null;
  if (bytes < 1024 * 1024) return `${Math.max(bytes / 1024, 0.1).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ViewFranchiseDialog = memo(function ViewFranchiseDialog({
  open,
  onClose,
  franchise,
  onEdit,
}: ViewFranchiseDialogProps) {
  const { user } = useAuth();
  const [franchiseDetails, setFranchiseDetails] = useState<Franchise | null>(franchise);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | number | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'history'>('details');

  const franchiseId = franchise?.id ?? franchiseDetails?.id ?? null;

  const loadFranchiseDetails = useCallback(async () => {
    if (!open || !franchiseId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/api/franchises/${franchiseId}`);
      const payload = response.data as FranchiseApiPayload;

      if (!payload.success || !payload.franchise) {
        setError(payload.message || 'Failed to fetch franchise details.');
        return;
      }

      setFranchiseDetails(payload.franchise);
      setHistory(Array.isArray(payload.franchise_histories) ? payload.franchise_histories : []);
    } catch (err) {
      setError('An unexpected error occurred while loading franchise details.');
    } finally {
      setLoading(false);
    }
  }, [franchiseId, open]);

  const loadHistory = useCallback(async () => {
    if (!open || !franchiseId || activeTab !== 'history' || history.length) {
      return;
    }

    setLoadingHistory(true);
    try {
      const response = await api.get(`/api/franchises/${franchiseId}/history`);
      setHistory(response.data?.history || []);
    } catch (error) {
      // no-op; the main details request already covers most cases
    } finally {
      setLoadingHistory(false);
    }
  }, [activeTab, franchiseId, history.length, open]);

  useEffect(() => {
    setFranchiseDetails(franchise);
  }, [franchise]);

  useEffect(() => {
    void loadFranchiseDetails();
  }, [loadFranchiseDetails]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!open) {
      setActiveTab('details');
    }
  }, [open]);

  const currentFranchise = franchiseDetails || franchise;
  const documents = useMemo(
    () =>
      extractFranchiseDocuments(
        {
          franchise: {
            documents:
              ((currentFranchise as any)?.documents ||
                (currentFranchise as any)?.Documents ||
                []) as FranchiseDocument[],
          },
        },
        franchiseId
      ),
    [currentFranchise, franchiseId]
  );

  if (!franchise) {
    return null;
  }

  const displayFranchise = currentFranchise || franchise;
  const isExpiring = isExpiringSoon(displayFranchise.ExpiryDate, (displayFranchise as any).LatestExpiryDate);
  const isExpired = isExpiredAlready(displayFranchise.ExpiryDate, (displayFranchise as any).LatestExpiryDate);
  const isRenewedRecord =
    (displayFranchise as any).LatestExpiryDate &&
    (displayFranchise as any).LatestExpiryDate !== displayFranchise.ExpiryDate &&
    (displayFranchise as any).LatestExpiryDate !== '0000-00-00';
  const driverName = (displayFranchise as Franchise & { Driver?: string }).Driver || 'N/A';

  const handleViewDocument = async (document: FranchiseDocument) => {
    if (!franchiseId) {
      return;
    }

    try {
      setOpeningDocumentId(document.id);
      await streamPdfToBrowser({
        url:
          document.StreamUrl ||
          `/fast-sb/api/franchises/${franchiseId}/documents/${document.id}/stream`,
        fileName: document.OriginalFileName || `franchise-document-${document.id}.pdf`,
        mode: 'open',
      });
    } catch (error) {
      toast.error('Failed to open the driver authorization PDF.');
    } finally {
      setOpeningDocumentId(null);
    }
  };

  const renderDocuments = () => {
    if (!documents.length) {
      return (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No driver authorization PDFs uploaded for this franchise.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {documents.map((document) => (
          <button
            key={document.id}
            type="button"
            onClick={() => void handleViewDocument(document)}
            className="group flex flex-col gap-3 rounded-xl border p-4 text-left transition hover:bg-muted/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-50 transition group-hover:bg-red-100">
                  <FileText className="h-5 w-5 text-red-600" />
                </div>

                <div className="min-w-0">
                  <div className="mb-1 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                    {document.Label || 'Authorization PDF'}
                  </div>
                  <div className="break-words text-sm font-medium leading-snug">
                    {document.OriginalFileName || `Document #${document.id}`}
                  </div>
                </div>
              </div>

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                {openingDocumentId === document.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Click to view</span>
              {document.FileSize ? (
                <>
                  <span>•</span>
                  <span>{formatFileSize(document.FileSize)}</span>
                </>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderBody = () => {
    if (loading && !currentFranchise) {
      return (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex h-64 flex-col items-center justify-center text-red-600">
          <ServerCrash className="mb-4 h-12 w-12" />
          <p>{error}</p>
        </div>
      );
    }

    return (
      <>
        {activeTab === 'details' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex shrink-0 rounded-lg bg-[#008ea2]/10 p-3">
                <Truck className="h-8 w-8 text-[#008ea2]" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="truncate text-xl font-semibold uppercase">{displayFranchise.FranchiseNo}</h3>
                <p className="truncate text-sm text-muted-foreground uppercase">{displayFranchise.ApplicantName}</p>
              </div>

              <Badge className={getStatusColor(displayFranchise.Status, displayFranchise.ExpiryDate, (displayFranchise as any).LatestExpiryDate)}>
                {getStatusLabel(displayFranchise.Status).toUpperCase()}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <h4 className="mb-1 text-sm font-medium">Contact Number</h4>
                <p className="text-sm text-muted-foreground">{displayFranchise.ContactNo || 'N/A'}</p>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-medium">Plate Number</h4>
                <p className="font-mono text-sm text-muted-foreground uppercase">{displayFranchise.PlateNo || 'N/A'}</p>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-medium">Address</h4>
                <p className="text-sm text-muted-foreground uppercase">{displayFranchise.Address || 'N/A'}</p>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-medium">Route</h4>
                <p className="text-sm text-muted-foreground uppercase">{displayFranchise.Route || 'N/A'}</p>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-medium">Authorized Driver</h4>
                <p className="text-sm text-muted-foreground uppercase">{driverName}</p>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-medium">Make</h4>
                <p className="text-sm text-muted-foreground uppercase">{(displayFranchise as any).MakeName || 'N/A'}</p>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-medium">Chassis Number</h4>
                <p className="font-mono text-sm text-muted-foreground">{displayFranchise.ChassisNo || 'N/A'}</p>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-medium">Engine Number</h4>
                <p className="font-mono text-sm text-muted-foreground uppercase">{displayFranchise.EngineNo || 'N/A'}</p>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-medium">OR Number</h4>
                <p className="text-sm text-muted-foreground uppercase">{displayFranchise.ORNo || 'N/A'}</p>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-medium">Amount Paid</h4>
                <p className="text-sm text-muted-foreground">
                  {displayFranchise.Amount
                    ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(displayFranchise.Amount))
                    : 'N/A'}
                </p>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-medium">Date Issued</h4>
                <p className="text-sm text-muted-foreground">
                  {displayFranchise.DateIssued && displayFranchise.DateIssued !== '0000-00-00'
                    ? formatDate(displayFranchise.DateIssued)
                    : 'N/A'}
                </p>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-medium">Expiry Date</h4>
                <p className={`text-sm ${isExpiring ? 'font-medium text-orange-600' : isExpired ? 'font-medium text-red-600' : 'text-muted-foreground'}`}>
                  {displayFranchise.ExpiryDate && displayFranchise.ExpiryDate !== '0000-00-00'
                    ? formatDate(displayFranchise.ExpiryDate)
                    : 'N/A'}
                </p>
              </div>
            </div>

            {displayFranchise.Status === 'drop' && displayFranchise.DropReason ? (
              <div>
                <h4 className="mb-1 text-sm font-medium">Drop Reason</h4>
                <p className="text-sm text-muted-foreground">{displayFranchise.DropReason}</p>
              </div>
            ) : null}

            {isExpiring ? (
              <div className="rounded border-l-4 border-orange-500 bg-orange-50 p-3">
                <p className="text-sm font-medium text-orange-700">⚠️ This franchise is expiring within 90 days.</p>
              </div>
            ) : null}

            {isExpired ? (
              <div className="rounded border-l-4 border-red-500 bg-red-50 p-3">
                <p className="text-sm font-medium text-red-700">⚠️ This franchise has expired.</p>
              </div>
            ) : null}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-base">Driver Authorization PDFs</h3>
              <p className="text-sm text-muted-foreground">
                These documents are attached directly to the franchise record.
              </p>
            </div>

            {renderDocuments()}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            {loadingHistory ? <p className="text-sm text-muted-foreground">Loading history...</p> : null}
            {!loadingHistory && history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history found for this franchise.</p>
            ) : null}

            {!loadingHistory &&
              history.map((item, index) => (
                <div
                  key={index}
                  className={`ml-2 rounded-md border-l-4 p-3 transition hover:bg-gray-50 ${getActionTypeColor(item.ActionType)}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      {item.CreatedAt && item.CreatedAt !== '0000-00-00' ? formatDate(item.CreatedAt) : 'N/A'}
                    </p>
                    <p className="text-sm font-medium text-gray-800">{item.CreatedByName}</p>
                  </div>

                  {item.ActionType ? <p className="mb-1 text-sm font-medium capitalize">{item.ActionType}</p> : null}

                  {item.Changes ? (
                    <ul className="ml-4 list-inside list-disc space-y-0.5 text-sm text-gray-700">
                      {Object.entries(item.Changes).map(([key, value]) => (
                        <li key={key}>
                          <span className="font-medium">{key}:</span>{' '}
                          {typeof value === 'object' && value !== null ? (
                            <>
                              {(value as any).old && (value as any).new ? (
                                <span>
                                  <span className="text-red-600 line-through">{(value as any).old}</span> →{' '}
                                  <span className="text-green-600">{(value as any).new}</span>
                                </span>
                              ) : (
                                <pre className="inline whitespace-pre-wrap">{JSON.stringify(value)}</pre>
                              )}
                            </>
                          ) : (
                            String(value)
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {item.Remarks ? <p className="mt-1 text-xs text-gray-500">{item.Remarks}</p> : null}
                </div>
              ))}
          </div>
        )}
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-h-[90vh] overflow-hidden sm:max-w-3xl"
        onInteractOutside={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader className="px-3 pt-6 sm:px-6">
          <DialogTitle>Franchise Details</DialogTitle>
          <DialogDescription>Complete information about this franchise record.</DialogDescription>
        </DialogHeader>

        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'details' ? 'border-b-2 border-[#008ea2] text-[#008ea2]' : 'text-gray-500'}`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'documents' ? 'border-b-2 border-[#008ea2] text-[#008ea2]' : 'text-gray-500'}`}
          >
            Documents
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'history' ? 'border-b-2 border-[#008ea2] text-[#008ea2]' : 'text-gray-500'}`}
          >
            History
          </button>
        </div>

        <div className="max-h-[calc(90vh-10rem)] overflow-y-auto p-3 sm:p-6">{renderBody()}</div>

        <DialogFooter className="sticky bottom-0 flex flex-col gap-2 border-t bg-white p-6 sm:flex-row sm:justify-end">
          {user && (user.UserType === 'Admin' || user.UserType === 'Editor') ? (
            <Button
              className="disabled:cursor-not-allowed disabled:opacity-50"
              disabled={Boolean(isRenewedRecord)}
              variant="outline"
              onClick={onEdit}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          ) : null}

          <Button onClick={onClose} className="bg-[#008ea2] hover:bg-[#007a8b]">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default ViewFranchiseDialog;
