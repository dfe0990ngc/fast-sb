import { memo } from "react";
import { Edit, Trash2, Eye } from "lucide-react";
import { Applicant } from "../../types/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Button } from "../ui/button";
import { useAuth } from "../../context/AuthContext";

interface ApplicantTableRowProps {
  applicant: Applicant;
  onView: (a: Applicant) => void;
  onEdit: (a: Applicant) => void;
  onDelete: (a: Applicant) => void;
};

const ApplicantTableRow = memo(({ applicant, onView, onEdit, onDelete }: ApplicantTableRowProps) => {
  const { user } = useAuth();
  const canEdit = user && (user.UserType === 'Admin' || user.UserType === 'Editor');
  const canDelete = user && user.UserType === 'Admin';

  return (
    <TableRow key={applicant.id}>
      <TableCell className="font-medium">{applicant.LastName}, {applicant.FirstName} {applicant.MiddleName || ''}</TableCell>
      <TableCell>{applicant.Address}</TableCell>
      <TableCell>{applicant.ContactNo || 'N/A'}</TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="p-0 w-8 h-8" onClick={() => onView(applicant)}><Eye className="w-4 h-4" /></Button>
          {canEdit && (
            <Button variant="outline" size="sm" className="p-0 w-8 h-8" onClick={() => onEdit(applicant)}><Edit className="w-4 h-4" /></Button>
          )}
          {canDelete && (
            <Button 
              variant="outline" 
              size="sm" 
              className="hover:bg-red-50 p-0 w-8 h-8 text-red-600 hover:text-red-700" 
              onClick={() => onDelete(applicant)}
              title="Delete applicant"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});

interface ApplicantTableProps {
  applicants: Applicant[];
  onView: (a: Applicant) => void;
  onEdit: (a: Applicant) => void;
  onDelete: (a: Applicant) => void;
}

const ApplicantTable = memo(({ applicants, onView, onEdit, onDelete }: ApplicantTableProps) => {
  return (
    <div className="border rounded-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Contact No.</TableHead>
            <TableHead className="w-[140px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applicants.map((applicant) => (
            <ApplicantTableRow
              key={applicant.id}
              applicant={applicant}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
});

export default ApplicantTable;