import { memo } from "react";
import { Edit, Trash2 } from "lucide-react";
import { Make } from "../../types/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Button } from "../ui/button";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../ui/badge";

interface MakeTableRowProps {
  make: Make;
  onEdit: (make: Make) => void;
  onDelete: (make: Make) => void;
}

const MakeTableRow = memo(({ make, onEdit, onDelete }: MakeTableRowProps) => {
  const { user } = useAuth();
  return (
    <TableRow key={make.id}>
      <TableCell className="font-medium">{make.Name}</TableCell>
      <TableCell>{make.Description}</TableCell>
      <TableCell>
        <Badge variant={make.IsActive ? "default" : "outline"} className={make.IsActive ? "bg-green-600" : ""}>
          {make.IsActive ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          {user && (user.UserType === 'Admin' || user.UserType === 'Editor') && (
            <Button variant="outline" size="sm" className="p-0 w-8 h-8" onClick={() => onEdit(make)}>
              <Edit className="w-4 h-4" />
            </Button>
          )}
          {user && user.UserType === 'Admin' && (
            <Button
              variant="outline"
              size="sm"
              className="hover:bg-red-50 p-0 w-8 h-8 text-red-600 hover:text-red-700"
              onClick={() => onDelete(make)}
            ><Trash2 className="w-4 h-4" /></Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});

interface MakeTableProps {
  makes: Make[];
  onEdit: (m: Make) => void;
  onDelete: (m: Make) => void;
}

const MakeTable = memo(({ makes, onEdit, onDelete }: MakeTableProps) => {
  return (
    <div className="border rounded-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[140px]">Status</TableHead>
            <TableHead className="w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {makes.map((make) => (
            <MakeTableRow
              key={make.id}
              make={make}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
});

export default MakeTable;