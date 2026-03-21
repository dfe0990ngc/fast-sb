import { memo } from "react";
import { Edit, Eye, ExternalLink, FileDown, Printer, RefreshCw, Trash2, XCircle } from "lucide-react";
import { Franchise } from "../../types/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Button } from "../ui/button";
import { formatDate, getStatusColor, getStatusLabel, isExpiredAlready, isExpiringSoon } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { useAuth } from "../../context/AuthContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

export type FormPdfAction = "download" | "open" | "print";

interface FranchiseTableRowProps {
  franchise: Franchise;
  onView: (franchise: Franchise) => void;
  onEdit: (franchise: Franchise) => void;
  onDelete: (franchise: Franchise) => void;
  onRenew: (franchise: Franchise) => void;
  onDrop: (franchise: Franchise) => void;

  /**
   * New: handle Application Form PDF actions (download/open/print).
   */
  onFormPdf?: (franchise: Franchise, action: FormPdfAction) => void;

  /**
   * Backward compatible: old handler (treated as print).
   */
  onPrint?: (franchise: Franchise) => void;

  printingId: number | null;
}

const FranchiseTableRow = memo(
  ({ franchise, onView, onEdit, onDelete, onRenew, onDrop, onFormPdf, onPrint, printingId }: FranchiseTableRowProps) => {
    const { user } = useAuth();

    const isExpiring = isExpiringSoon(franchise.ExpiryDate, franchise.LatestExpiryDate);
    const isExpired = isExpiredAlready(franchise.ExpiryDate, franchise.LatestExpiryDate);
    const isRenewedRecord =
      franchise.LatestExpiryDate &&
      franchise.LatestExpiryDate !== franchise.ExpiryDate &&
      franchise.LatestExpiryDate !== "0000-00-00";
    const expiredIndx = isExpiring ? "text-orange-600" : isExpired ? "text-red-600" : "";

    const isBusy = printingId === franchise.id;

    const runFormAction = (action: FormPdfAction) => {
      if (isBusy) return;

      if (onFormPdf) return onFormPdf(franchise, action);

      // fallback: old prop only (best-effort)
      if (onPrint) return onPrint(franchise);
    };

    return (
      <TableRow>
        <TableCell>
          <div className="font-medium truncate">
            <div className="font-medium truncate uppercase">{franchise.FranchiseNo}</div>
            <div className="font-medium text-[9px] text-muted-foreground truncate uppercase">{franchise.ApplicantName}</div>
          </div>
        </TableCell>

        <TableCell className="truncate uppercase">{franchise.Route}</TableCell>
        <TableCell className="text-sm truncate uppercase">{franchise.ChassisNo}</TableCell>
        <TableCell className="text-sm truncate uppercase">{franchise.EngineNo}</TableCell>
        <TableCell className="uppercase">
          {franchise.DateIssued && franchise.DateIssued !== "0000-00-00" ? formatDate(franchise.DateIssued) : "N/A"}
        </TableCell>

        <TableCell>
          <Badge className={getStatusColor(franchise.Status, franchise.ExpiryDate, franchise.LatestExpiryDate)}>
            {getStatusLabel(franchise.Status).toUpperCase()}
          </Badge>
        </TableCell>

        <TableCell className={`${expiredIndx} uppercase ${isExpired || isExpiring ? "font-medium" : ""}`}>
          {franchise.ExpiryDate && franchise.ExpiryDate !== "0000-00-00" ? formatDate(franchise.ExpiryDate) : "N/A"}
        </TableCell>

        <TableCell>
          <TooltipProvider>
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="p-0 w-8 h-8" onClick={() => onView(franchise)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>View Details</p></TooltipContent>
              </Tooltip>

              {/* Application form actions */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="p-0 w-8 h-8"
                    onClick={() => runFormAction("print")}
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <div className="inline-block border-primary border-t-2 border-r-2 border-b-transparent border-l-transparent rounded-full w-4 h-4 animate-spin"></div>
                    ) : (
                      <Printer className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Print Application Form</p></TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="p-0 w-8 h-8"
                    onClick={() => runFormAction("open")}
                    disabled={isBusy}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Open Form in New Tab</p></TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="p-0 w-8 h-8"
                    onClick={() => runFormAction("download")}
                    disabled={isBusy}
                  >
                    <FileDown className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Download Form PDF</p></TooltipContent>
              </Tooltip>

              {user && (user.UserType === "Admin" || user.UserType === "Editor") && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      disabled={isRenewedRecord}
                      variant="outline"
                      size="sm"
                      className="disabled:opacity-50 p-0 w-8 h-8 disabled:cursor-not-allowed"
                      onClick={() => onEdit(franchise)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isRenewedRecord ? "Cannot edit renewed franchise" : "Edit Franchise"}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {user && (user.UserType === "Admin" || user.UserType === "Editor") && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      disabled={franchise.Status === "drop" || (!isExpiring && !isExpired)}
                      variant="outline"
                      size="sm"
                      className="disabled:opacity-50 p-0 w-8 h-8 text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed"
                      onClick={() => onRenew(franchise)}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {franchise.Status === "drop"
                        ? "Cannot renew dropped franchise"
                        : !isExpiring && !isExpired
                          ? "Franchise not due for renewal"
                          : "Renew Franchise"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}

              {user && (user.UserType === "Admin" || user.UserType === "Editor") && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      disabled={franchise.Status === "drop" || isRenewedRecord}
                      variant="outline"
                      size="sm"
                      className="disabled:opacity-50 p-0 w-8 h-8 text-orange-600 hover:text-orange-700 disabled:cursor-not-allowed"
                      onClick={() => onDrop(franchise)}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {franchise.Status === "drop"
                        ? "Already dropped"
                        : isRenewedRecord
                          ? "Cannot drop renewed franchise"
                          : "Drop Franchise"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}

              {user && user.UserType === "Admin" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="hover:bg-red-50 p-0 w-8 h-8 text-red-600 hover:text-red-700"
                      onClick={() => onDelete(franchise)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Delete Franchise</p></TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        </TableCell>
      </TableRow>
    );
  }
);

interface FranchiseTableProps {
  franchises: Franchise[];
  onView: (franchise: Franchise) => void;
  onEdit: (franchise: Franchise) => void;
  onDelete: (franchise: Franchise) => void;
  onRenew: (franchise: Franchise) => void;
  onDrop: (franchise: Franchise) => void;

  onFormPdf?: (franchise: Franchise, action: FormPdfAction) => void;
  onPrint?: (franchise: Franchise) => void;

  printingId: number | null;
}

const FranchiseTable = memo(
  ({ franchises, onView, onEdit, onDelete, onRenew, onDrop, onFormPdf, onPrint, printingId }: FranchiseTableProps) => {
    return (
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Franchise No.</TableHead>
              <TableHead className="w-[120px]">Route</TableHead>
              <TableHead className="w-[120px]">Chassis No</TableHead>
              <TableHead className="w-[120px]">Engine No</TableHead>
              <TableHead className="w-[100px]">Date Issued</TableHead>
              <TableHead className="w-[60px]">Status</TableHead>
              <TableHead className="w-[100px]">Expiry Date</TableHead>
              <TableHead className="w-[240px]">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {franchises.map((franchise) => (
              <FranchiseTableRow
                key={franchise.id}
                franchise={franchise}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
                onRenew={onRenew}
                onDrop={onDrop}
                onFormPdf={onFormPdf}
                onPrint={onPrint}
                printingId={printingId}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }
);

export default FranchiseTable;
