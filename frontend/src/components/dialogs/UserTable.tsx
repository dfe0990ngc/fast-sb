import { memo } from "react";
import { Edit, Trash2 } from "lucide-react";
import { User } from "../../types/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { formatDate } from "../../lib/utils";
import { useAuth } from "../../context/AuthContext";

interface UserTableRowProps {
  user: User;
  onEdit: (u: User) => void;
  onDelete: (u: User) => void;
};

const UserTableRow = memo(({ user, onEdit, onDelete }: UserTableRowProps) => {
  const { user: loggedInUser } = useAuth();

  return (
    <TableRow key={user.UserID}>
      <TableCell className="font-medium">{user.FirstName} {user.LastName}</TableCell>
      <TableCell>{user.UserID}</TableCell>
      <TableCell><Badge variant="outline">{user.UserType}</Badge></TableCell>
      <TableCell>{user.LastLogin ? formatDate(user.LastLogin) : 'Never'}</TableCell>
      <TableCell>
        <div className="flex gap-1">
          {loggedInUser && loggedInUser.UserType === 'Admin' && (
            <>
              <Button variant="outline" size="sm" className="p-0 w-8 h-8" onClick={() => onEdit(user)}><Edit className="w-4 h-4" /></Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="hover:bg-red-50 disabled:opacity-50 p-0 w-8 h-8 text-red-600 hover:text-red-700 disabled:cursor-not-allowed" 
                onClick={() => onDelete(user)}
                disabled={loggedInUser.UserID === user.UserID}
                title={loggedInUser.UserID === user.UserID ? "You cannot delete your own account." : "Delete user"}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});

interface UserTableProps {
  users: User[];
  onEdit: (u: User) => void;
  onDelete: (u: User) => void;
}

const UserTable = memo(({ users, onEdit, onDelete }: UserTableProps) => {
  return (
    <div className="border rounded-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Last Login</TableHead>
            <TableHead className="w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <UserTableRow
              key={user.UserID}
              user={user}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
});

export default UserTable;