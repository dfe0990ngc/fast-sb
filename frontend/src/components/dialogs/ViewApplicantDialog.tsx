import { useEffect, useState, memo } from "react";
import { Applicant } from "../../types/types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Badge } from "../ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { formatDate, getStatusBadgeClass, getStatusColor, getStatusLabel } from "../../lib/utils";
import * as api from '../../api/api';
import { Car, Clock, Edit, FileText, Hash, Loader2, MapPin, ServerCrash, User } from "lucide-react";
import { Button } from "../ui/button";
import { useAuth } from "../../context/AuthContext";

interface ViewApplicantDialogProps {
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  applicantId: number | null;
}

// Helper function to get border color class based on status
const getFranchiseDetailsBorderClass = (status: string) => {
  switch (status) {
    case 'new':
      return 'border-green-500';
    case 'renew':
      return 'border-blue-500';
    case 'drop':
      return 'border-orange-500';
    default:
      return 'border-gray-300'; // Default border color
  }
};

const ViewApplicantDialog = memo(({ open, onClose, onEdit, applicantId }: ViewApplicantDialogProps) => {
  const { user } = useAuth();
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApplicantDetails = async () => {
      if (open && applicantId) {
        setLoading(true);
        setError(null);
        try {
          const response = await api.get(`/api/applicants/${applicantId}`);
          if (response.data.success) {
            setApplicant(response.data.applicant);
          } else {
            setError(response.data.message || "Failed to fetch applicant details.");
          }
        } catch (err) {
          setError("An unexpected error occurred.");
        } finally {
          setLoading(false);
        }
      }
    };

    fetchApplicantDetails();
  }, [open, applicantId]);

  const renderContent = () => {
    if (loading) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
    }
    if (error) {
      return <div className="flex flex-col justify-center items-center h-64 text-red-600"><ServerCrash className="mb-4 w-12 h-12" /><p>{error}</p></div>;
    }
    if (!applicant) {
      return <div className="flex justify-center items-center h-64 text-muted-foreground">No applicant data available.</div>;
    }

    return (
      <>
        <div className="gap-4 grid grid-cols-1 sm:grid-cols-2 mb-6 text-sm">
          <div className="space-y-1"><div className="text-muted-foreground">Full Name</div><div className="font-medium">{applicant.FirstName} {applicant.MiddleName} {applicant.LastName}</div></div>
          <div className="space-y-1"><div className="text-muted-foreground">Contact No.</div><div className="font-medium">{applicant.ContactNo || 'N/A'}</div></div>
          <div className="space-y-1 col-span-2"><div className="text-muted-foreground">Address</div><div className="font-medium">{applicant.Address}</div></div>
        </div>

        <h3 className="mb-2 font-semibold">Franchises ({applicant.franchises?.length || 0})</h3>
        {applicant.franchises && applicant.franchises.length > 0 ? (
          <Accordion type="single" collapsible className="w-full">
            {applicant.franchises.map(franchise => (
              <AccordionItem value={`franchise-${franchise.id}`} key={franchise.id}>
                <AccordionTrigger>
                  <div className="flex justify-between items-center pr-4 w-full">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">{franchise.FranchiseNo}</span>
                      <span className="text-muted-foreground">({franchise.PlateNo})</span>
                    </div>
                    <Badge className={getStatusColor(franchise.Status, franchise.ExpiryDate, franchise.LatestExpiryDate)}>{getStatusLabel(franchise.Status).toUpperCase()}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className={`gap-4 grid grid-cols-2 md:grid-cols-3 bg-muted/50 mb-4 p-4 rounded-lg text-sm border-l-4 ${getFranchiseDetailsBorderClass(franchise.Status)}`}>
                    <div><div className="text-muted-foreground text-xs">Make</div><div>{franchise.MakeName}</div></div>
                    <div><div className="text-muted-foreground text-xs">Route</div><div>{franchise.Route}</div></div>
                    <div><div className="text-muted-foreground text-xs">Engine No.</div><div>{franchise.EngineNo}</div></div>
                    <div><div className="text-muted-foreground text-xs">Date Issued</div><div>{formatDate(franchise.DateIssued)}</div></div>
                    <div><div className="text-muted-foreground text-xs">Last Renewal</div><div>{franchise.LastRenewalDate && franchise.LastRenewalDate !== '0000-00-00' ? formatDate(franchise.LastRenewalDate) : 'N/A'}</div></div>
                    <div><div className="text-muted-foreground text-xs">Expiry Date</div><div>{franchise.ExpiryDate ? formatDate(franchise.ExpiryDate) : 'N/A'}</div></div>
                  </div>
                  {franchise.Status === 'drop' && (
                    <div className="col-span-full mt-2 p-4 pt-0">
                      <div className="text-muted-foreground text-xs">Drop Reason</div>
                      <div className="font-medium text-orange-600">{franchise.DropReason || 'N/A'}</div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="py-8 text-muted-foreground text-center">
            <FileText className="mx-auto mb-2 w-10 h-10" />
            <p>This applicant has no associated franchises.</p>
          </div>
        )}
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex flex-col sm:max-w-3xl max-h-[90vh]"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}>
        <DialogHeader className="px-3 sm:px-6 pt-6">
          <DialogTitle>Applicant Details</DialogTitle>
        </DialogHeader>
        <div className="flex-grow p-3 sm:p-6 pr-2 max-h-[calc(90vh-10rem)] overflow-y-auto">
          {renderContent()}
        </div>

        <DialogFooter className="flex sm:flex-row flex-col justify-end gap-2 bg-white p-6 border-t">
          {user && (user.UserType === 'Admin' || user.UserType === 'Editor') && (
            <Button variant="outline" onClick={onEdit}>
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

export default ViewApplicantDialog;