import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Save, Eye, EyeOff, Loader2, LogOut } from 'lucide-react';
import * as api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface UserProfile {
  UserID: string;
  FirstName: string;
  LastName: string;
  UserType: string;
  CreatedAt: string;
  UpdatedAt: string;
  LastLogin: string;
  CreatedByName: string;
  UpdatedByName: string;
}

export default function Profile() {
  const { setUser, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [passwordData, setPasswordData] = useState({
    OldPassword: '',
    Password: '',
    PasswordConfirmation: '',
  });
  const [showPassword, setShowPassword] = useState({ old: false, new: false, confirm: false });
  const [loading, setLoading] = useState({ profile: true, update: false, password: false });
  const [error, setError] = useState({ profile: '', password: '' });

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(prev => ({ ...prev, profile: true }));
      try {
        const { data } = await api.get('/api/my-profile');
        if (data.success) {
          setProfile(data.user);
        }
      } catch (err: any) {
        const message = err?.response?.data?.message || 'Failed to load profile.';
        toast.error(message);
      } finally {
        setLoading(prev => ({ ...prev, profile: false }));
      }
    };

    fetchProfile();
  }, []);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile) return;
    const { name, value } = e.target;
    setProfile({ ...profile, [name]: value });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData({ ...passwordData, [name]: value });
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(prev => ({ ...prev, update: true }));
    try {
      const { data } = await api.put('/api/my-profile', {
        FirstName: profile.FirstName,
        LastName: profile.LastName,
      });
      if (data.success) {
        toast.success('Profile updated successfully!');
        const updatedUser = data.user;
        setProfile(updatedUser);
        setUser(updatedUser); // Update context
        localStorage.setItem('user', JSON.stringify(data.user));
      }
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update profile.';
      toast.error(message);
    } finally {
      setLoading(prev => ({ ...prev, update: false }));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError({ ...error, password: '' });

    if (passwordData.Password !== passwordData.PasswordConfirmation) {
      setError({ ...error, password: 'New passwords do not match.' });
      return;
    }

    setLoading(prev => ({ ...prev, password: true }));
    try {
      const { data } = await api.post('/api/auth/change-password', passwordData);
      if (data.success) {
        const toastId = toast.loading('You have successfully changed your password. Please relogin again...');
        setPasswordData({ OldPassword: '', Password: '', PasswordConfirmation: '' });

        setTimeout(() => {
          toast.dismiss(toastId);
          logout();
        }, 3000);
      } else {
        // If API returns success: false, show the error
        const message = data.message || 'Failed to change password.';
        setError({ ...error, password: message });
        toast.error(message);
      }
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to change password.';
      setError({ ...error, password: message });
      toast.error(message);
    } finally {
      setLoading(prev => ({ ...prev, password: false }));
    }
  };

  if (loading.profile) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-[#008ea2] animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Could not load user profile.</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'MMM d, yyyy, h:mm a');
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1
      }}
      transition={{
        delay: 0.1,
        duration: 0.25,
        type: 'tween',
      }}
      className="space-y-4 p-0 sm:p-4">
      <div className="flex justify-between items-start sm:items-center">
        <div>
          {/* <h1 className="font-bold text-lg">My Profile</h1> */}
          <p className="text-muted-foreground">Manage your personal information and password.</p>
        </div>
        <Button variant="destructive" onClick={logout}>
          <LogOut className="mr-2 w-4 h-4" />
          <span>Logout</span>
        </Button>
      </div>

      <div className="gap-6 grid md:grid-cols-2">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>View and update your personal details.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="gap-4 grid sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="FirstName">First Name</Label>
                  <Input id="FirstName" name="FirstName" value={profile.FirstName} onChange={handleProfileChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="LastName">Last Name</Label>
                  <Input id="LastName" name="LastName" value={profile.LastName} onChange={handleProfileChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="UserID">User ID</Label>
                <Input id="UserID" value={profile.UserID} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="UserType">User Type</Label>
                <Input id="UserType" value={profile.UserType} disabled />
              </div>
              <div className="mt-4 pt-4 border-t">
                <p className="text-muted-foreground text-sm">Last Login: {formatDate(profile.LastLogin)}</p>
                <p className="text-muted-foreground text-sm">Profile Created: {formatDate(profile.CreatedAt)} by {profile.CreatedByName || 'System'}</p>
                <p className="text-muted-foreground text-sm">Last Updated: {formatDate(profile.UpdatedAt)} by {profile.UpdatedByName || 'System'}</p>
              </div>
              <Button type="submit" disabled={loading.update} className="bg-[#008ea2] hover:bg-[#007a8b] w-full sm:w-auto">
                {loading.update ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Save className="mr-2 w-4 h-4" />}
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your password for security.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="OldPassword">Old Password</Label>
                <div className="relative">
                  <Input id="OldPassword" name="OldPassword" type={showPassword.old ? 'text' : 'password'} value={passwordData.OldPassword} onChange={handlePasswordChange} required />
                  <button type="button" onClick={() => setShowPassword(p => ({...p, old: !p.old}))} className="right-0 absolute inset-y-0 flex items-center pr-3 text-gray-400">
                    {showPassword.old ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="Password">New Password</Label>
                 <div className="relative">
                  <Input id="Password" name="Password" type={showPassword.new ? 'text' : 'password'} value={passwordData.Password} onChange={handlePasswordChange} required />
                  <button type="button" onClick={() => setShowPassword(p => ({...p, new: !p.new}))} className="right-0 absolute inset-y-0 flex items-center pr-3 text-gray-400">
                    {showPassword.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="PasswordConfirmation">Confirm New Password</Label>
                 <div className="relative">
                  <Input id="PasswordConfirmation" name="PasswordConfirmation" type={showPassword.confirm ? 'text' : 'password'} value={passwordData.PasswordConfirmation} onChange={handlePasswordChange} required />
                  <button type="button" onClick={() => setShowPassword(p => ({...p, confirm: !p.confirm}))} className="right-0 absolute inset-y-0 flex items-center pr-3 text-gray-400">
                    {showPassword.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              {error.password && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertDescription className="text-red-800">{error.password}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={loading.password || !passwordData.Password || passwordData.Password !== passwordData.PasswordConfirmation} className="w-full sm:w-auto">
                {loading.password ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Lock className="mr-2 w-4 h-4" />}
                Change Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}