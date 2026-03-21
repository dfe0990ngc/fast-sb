import { memo } from "react";
import { Badge, Calendar, Edit, Eye, Hash, MapPin, MoreVertical, RefreshCw, Trash2, Truck, XCircle } from "lucide-react";
import { formatDate, getStatusColor, isExpiringSoon } from "../../lib/utils";
import { Franchise } from "../../types/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Button } from "../ui/button";

interface FranchiseCardProps {
  franchise: Franchise;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDrop: () => void;
  onRenew: () => void;
}

const FranchiseCard = memo(({
  franchise,
  onView,
  onEdit,
  onDelete,
  onDrop,
  onRenew,
}: FranchiseCardProps) => {
  const isExpiring = isExpiringSoon(franchise.ExpiryDate, franchise.LatestExpiryDate);

  return (
    <Card className="relative hover:shadow-md overflow-hidden transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <div className="flex flex-1 items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex-shrink-0 bg-[#008ea2]/10 p-1.5 sm:p-2 rounded-lg">
              <Truck className="w-5 sm:w-6 h-5 sm:h-6 text-[#008ea2]" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base sm:text-lg truncate">{franchise.Name}</CardTitle>
              <CardDescription className="truncate">{franchise.FranchiseNo}</CardDescription>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex-shrink-0 p-0 w-8 h-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onView}>
                <Eye className="mr-2 w-4 h-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 w-4 h-4" />
                Edit Franchise
              </DropdownMenuItem>
              {franchise.Status !== 'drop' && (
                <DropdownMenuItem onClick={onRenew}>
                  <RefreshCw className="mr-2 w-4 h-4" />
                  Renew Franchise
                </DropdownMenuItem>
              )}
              {franchise.Status !== 'drop' && (
                <DropdownMenuItem className="text-orange-600 focus:text-orange-600" onClick={onDrop}>
                  <XCircle className="mr-2 w-4 h-4" />
                  Drop Franchise
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={onDelete}>
                <Trash2 className="mr-2 w-4 h-4" />
                Delete Franchise
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="flex-shrink-0 w-4 h-4 text-muted-foreground" />
            <span className="truncate">{franchise.Route}</span>
          </div>
          <div className="flex items-center gap-2">
            <Hash className="flex-shrink-0 w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{franchise.PlateNo}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="flex-shrink-0 w-4 h-4 text-muted-foreground" />
            <span>Issued: {formatDate(franchise.DateIssued)}</span>
          </div>
          {franchise.ExpiryDate && (
            <div className="flex items-center gap-2">
              <Calendar className="flex-shrink-0 w-4 h-4 text-muted-foreground" />
              <span className={isExpiring ? 'text-orange-600 font-medium' : ''}>
                Expires: {formatDate(franchise.ExpiryDate)}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-between items-center gap-2 pt-2">
          <Badge className={getStatusColor(franchise.Status, franchise.ExpiryDate, franchise.LatestExpiryDate)}>{franchise.Status.toUpperCase()}</Badge>
          {franchise.MakeName && (
            <span className="text-muted-foreground text-xs">{franchise.MakeName}</span>
          )}
        </div>

        {franchise.RenewalCount !== undefined && franchise.RenewalCount > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <RefreshCw className="flex-shrink-0 w-3 h-3" />
            <span>Renewed {franchise.RenewalCount} time(s)</span>
          </div>
        )}

        {isExpiring && (
          <div className="bg-orange-50 p-2 border-orange-500 border-l-4 rounded text-orange-700 text-xs">
            Expiring within 90 days!
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default FranchiseCard;