import { useEffect, useState, memo, useCallback } from "react";
import { Edit, Truck } from "lucide-react";
import { Franchise } from "../../types/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { formatDate, getStatusColor, getStatusLabel, isExpiredAlready, isExpiringSoon } from "../../lib/utils";
import { Badge } from "../ui/badge";
import * as api from '../../api/api';
import { useAuth } from "../../context/AuthContext";
import { isAbortError } from '../../api/api';
 
interface ViewFranchiseDialogProps {
  open: boolean;
  onClose: () => void;
  franchise: Franchise | null;
  onEdit: () => void;
}

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

const ViewFranchiseDialog = memo(({
  open,
  onClose,
  franchise,
  onEdit,
}: ViewFranchiseDialogProps) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');

  const handleLoadHistory = useCallback(async () => {
    if (!franchise?.id) return;
    setLoadingHistory(true);
    try {
      const { data } = await api.get(`/api/franchises/${franchise.id}/history`, {}, { track: true, requestKey: 'fetch_franchise_history' });
      setHistory(data.history);
    } catch (error: any) {
      if (!isAbortError(error)) {
        console.error(error);
      }
    } finally {
      setLoadingHistory(false);
    }
  }, [franchise?.id]);

  useEffect(() => {
    if (open && activeTab === 'history') {
      handleLoadHistory();
    }
  }, [open, activeTab, handleLoadHistory]);

  if (!franchise) return null;

  const isExpiring = isExpiringSoon(franchise.ExpiryDate, franchise.LatestExpiryDate);
  const isExpired = isExpiredAlready(franchise.ExpiryDate, franchise.LatestExpiryDate);
  const isRenewedRecord = franchise.LatestExpiryDate && franchise.LatestExpiryDate !== franchise.ExpiryDate && franchise.LatestExpiryDate !== '0000-00-00';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}>
        <DialogHeader className="px-3 sm:px-6 pt-6">
          <DialogTitle>Franchise Details</DialogTitle>
          <DialogDescription>Complete information about this franchise</DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-gray-200 border-b">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'details' ? 'border-b-2 border-[#008ea2] text-[#008ea2]' : 'text-gray-500'}`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'history' ? 'border-b-2 border-[#008ea2] text-[#008ea2]' : 'text-gray-500'}`}
          >
            History
          </button>
        </div>

        <div className="p-3 sm:p-6 max-h-[calc(90vh-10rem)] overflow-y-auto">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Franchise Info */}
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 bg-[#008ea2]/10 p-3 rounded-lg">
                  <Truck className="w-8 h-8 text-[#008ea2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-xl truncate uppercase">{franchise.FranchiseNo}</h3>
                  <p className="text-muted-foreground text-sm uppercase">{franchise.ApplicantName}</p>
                </div>
                <Badge className={getStatusColor(franchise.Status, franchise.ExpiryDate, franchise.LatestExpiryDate)}>{getStatusLabel(franchise.Status).toUpperCase()}</Badge>
              </div>

              {/* Details Grid */}
              <div className="space-y-4">
                <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
                  <div>
                    <h4 className="mb-1 font-medium text-sm">Contact Number</h4>
                    <p className="text-muted-foreground text-sm">{franchise.ContactNo || "N/A"}</p>
                  </div>
                  <div>
                    <h4 className="mb-1 font-medium text-sm">Plate Number</h4>
                    <p className="font-mono text-muted-foreground text-sm uppercase">{franchise.PlateNo}</p>
                  </div>
                </div>

                <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
                  <div>
                    <h4 className="mb-1 font-medium text-sm">Address</h4>
                    <p className="text-muted-foreground text-sm uppercase">{franchise.Address}</p>
                  </div>

                  <div>
                    <h4 className="mb-1 font-medium text-sm">Route</h4>
                    <p className="text-muted-foreground text-sm uppercase">{franchise.Route}</p>
                  </div>
                </div>

                <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
                  <div>
                    <h4 className="mb-1 font-medium text-sm">Make</h4>
                    <p className="text-muted-foreground text-sm uppercase">{franchise.MakeName || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="mb-1 font-medium text-sm">Chassis Number</h4>
                    <p className="font-mono text-muted-foreground text-sm">{franchise.ChassisNo}</p>
                  </div>
                </div>

                <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
                  <div>
                    <h4 className="mb-1 font-medium text-sm">Engine Number</h4>
                    <p className="font-mono text-muted-foreground text-sm uppercase">{franchise.EngineNo}</p>
                  </div>
                  <div>
                    <h4 className="mb-1 font-medium text-sm">Renewal Count</h4>
                    <p className="text-muted-foreground text-sm">{franchise.RenewalCount || 0} time(s)</p>
                  </div>
                </div>

                <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
                  <div>
                    <h4 className="mb-1 font-medium text-sm">OR Number</h4>
                    <p className="text-muted-foreground text-sm uppercase">{franchise.ORNo || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="mb-1 font-medium text-sm">Amount Paid</h4>
                    <p className="text-muted-foreground text-sm">
                      {franchise.Amount ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(franchise.Amount)) : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
                  <div>
                    <h4 className="mb-1 font-medium text-sm">Date Issued</h4>
                    <p className="text-muted-foreground text-sm">{(franchise.DateIssued && franchise.DateIssued !== '0000-00-00') ? formatDate(franchise.DateIssued) : 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="mb-1 font-medium text-sm">Expiry Date</h4>
                    <p className={`text-sm ${isExpiring ? 'text-orange-600 font-medium' : isExpired ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                      {(franchise.ExpiryDate && franchise.ExpiryDate !== '0000-00-00') ? formatDate(franchise.ExpiryDate) : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* {franchise.LastRenewalDate && (
                  <div>
                    <h4 className="mb-1 font-medium text-sm">Last Renewal Date</h4>
                    <p className="text-muted-foreground text-sm">{(franchise.LastRenewalDate && franchise.LastRenewalDate !== '0000-00-00') ? formatDate(franchise.LastRenewalDate) : 'N/A'}</p>
                  </div>
                )} */}

                {franchise.Status === 'drop' && franchise.DropReason && (
                  <div>
                    <h4 className="mb-1 font-medium text-sm">Drop Reason</h4>
                    <p className="text-muted-foreground text-sm">{franchise.DropReason}</p>
                  </div>
                )}

                {isExpiring && (
                  <div className="bg-orange-50 p-3 border-orange-500 border-l-4 rounded">
                    <p className="font-medium text-orange-700 text-sm">⚠️ This franchise is expiring within 90 days!</p>
                  </div>
                )}

                {isExpired && (
                  <div className="bg-red-50 p-3 border-red-500 border-l-4 rounded">
                    <p className="font-medium text-red-700 text-sm">⚠️ This franchise has expired!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {loadingHistory && <p className="text-muted-foreground text-sm">Loading history...</p>}
              {!loadingHistory && history.length === 0 && (
                <p className="text-muted-foreground text-sm">No history found for this franchise.</p>
              )}
              {!loadingHistory &&
                history.map((item, idx) => (
                  <div
                    key={idx}
                    className={`hover:bg-gray-50 p-3 border-l-4 rounded-md transition ml-2 ${getActionTypeColor(item.ActionType)}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-gray-600 text-sm">{(item.CreatedAt && item.CreatedAt !== '0000-00-00') ? formatDate(item.CreatedAt) : 'N/A'}</p>
                      <p className="font-medium text-gray-800 text-sm">{item.CreatedByName}</p>
                    </div>
                    {item.ActionType && (
                      <p className="mb-1 font-medium text-sm capitalize">{item.ActionType}</p>
                    )}
                    {item.Changes && (
                      <ul className="space-y-0.5 ml-4 text-gray-700 text-sm list-disc list-inside">
                        {Object.entries(item.Changes).map(([key, value]) => (
                          <li key={key}>
                            <span className="font-medium">{key}:</span>{" "}
                            {typeof value === "object" && value !== null ? (
                              <>
                                {value.old && value.new ? (
                                  <span>
                                    <span className="text-red-600 line-through">{value.old}</span>{" "}
                                    → <span className="text-green-600">{value.new}</span>
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
                    )}

                    {item.Remarks && <p className="mt-1 text-gray-500 text-xs">{item.Remarks}</p>}
                  </div>
              ))}

            </div>
          )}
        </div>

        <DialogFooter className="bottom-0 sticky flex sm:flex-row flex-col justify-end gap-2 bg-white p-6 border-t">
          {user && (user.UserType === 'Admin' || user.UserType === 'Editor') && (
            <Button className="disabled:opacity-50 disabled:cursor-not-allowed" disabled={isRenewedRecord} variant="outline" onClick={onEdit}>
              <Edit className="mr-2 w-4 h-4" />
              Edit
            </Button>
          )}
          <Button onClick={onClose} className="bg-[#008ea2] hover:bg-[#007a8b]">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default ViewFranchiseDialog;
