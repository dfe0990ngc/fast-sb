import { useState, useEffect, useMemo, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Avatar, AvatarFallback } from './ui/avatar';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Calendar as Cal,
  Plus,
  Eye,
  Car,
  MapPin,
  RefreshCw,
  XCircle,
  Loader2,
  Users
} from 'lucide-react';

import {
  getDashboardOverview
} from '../api/dashboardApi';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

export default function Dashboard() {
  
  const { available_years, setAvailableYears } = useAuth();
  const [filters, setFilters] = useState({ year: '', month: '' });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    stats: {},
    trends: [],
    status_distribution: [],
    top_routes: [],
    top_makes: [],    
    user_analytics: [],
    recent_activities: []
  });
  const [activeUserAnalytics, setActiveUserAnalytics] = useState(null);
  const navigate = useNavigate();
  const { stats, trends, status_distribution, top_routes, top_makes, user_analytics, recent_activities } = dashboardData;
  
  const statsConfig = useMemo(() => [    
      { 
        title: 'Total Franchises', 
        value: stats.total_franchises?.value || '0',
        change: `${stats.total_franchises?.change >= 0 ? '+' : ''}${stats.total_franchises?.change || 0}%`,
        trend: stats.total_franchises?.trend || 'up',
        icon: FileText 
      },
      { 
        title: 'Active Routes', 
        value: stats.active_routes?.value || '0',
        change: `${stats.active_routes?.change >= 0 ? '+' : ''}${stats.active_routes?.change || 0}%`,
        trend: stats.active_routes?.trend || 'up',
        icon: MapPin 
      },
      { 
        title: 'Renewals This Month', 
        value: stats.renewals_this_month?.value || '0',
        change: `${stats.renewals_this_month?.change >= 0 ? '+' : ''}${stats.renewals_this_month?.change || 0}%`,
        trend: stats.renewals_this_month?.trend || 'up',
        icon: RefreshCw 
      },
      { 
        title: 'Dropped Franchises', 
        value: stats.dropped_franchises?.value || '0',
        change: `${stats.dropped_franchises?.change >= 0 ? '+' : ''}${stats.dropped_franchises?.change || 0}%`,
        trend: stats.dropped_franchises?.trend || 'up',
        icon: XCircle 
      },
    ], [stats]);

  const availableYears = useMemo(() => {
    const years = [...available_years];

    if (available_years.length > 0 && !filters.year) {
      setFilters(prev => ({
        ...prev,
        year: 'all'
      }));
    }

    return years;
  }, [available_years.join('')]);


  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  // useEffect(() => {
  //   if (available_years.length > 0 && !filters.year) {
  //     setFilters(prev => ({
  //       ...prev,
  //       year: available_years[0].toString()
  //     }));
  //   }
  // }, [available_years, filters.year]);

  useEffect(() => {
    startTransition(() => {
      const fetchDashboardData = async () => {
        try {
          setError(null);
  
          const { data: ds } = await getDashboardOverview(filters);
  
          if(ds.success){
            setDashboardData({
              stats: ds?.stats || {},
              trends: ds?.trends || [],
              status_distribution: ds?.status_distribution || [],
              top_routes: ds?.top_routes || [],
              top_makes: ds?.top_makes || [],
              user_analytics: ds?.user_analytics || [], // Placeholder until user analytics are fetched
              recent_activities: ds?.recent_activities || [],
            });
            if (ds?.available_years) {
              ds.available_years.forEach((year: number) => {
                if (!available_years.includes(year)) {
                  setAvailableYears((prevYears: number[]) => [...prevYears, year]);
                }
              });
            }
          }
  
        } catch (err: any) {
          if (err.name !== 'CanceledError') {
            setError(err.message || 'An error occurred while loading dashboard');
            console.error('Dashboard fetch error:', err);
          }
        } finally {
          if (isInitialLoading) {
            setIsInitialLoading(false);
          }
        }
      };
      fetchDashboardData();
    });

  }, [filters]);
  
  if (isInitialLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 shadow-sm mx-auto p-6 border border-red-200 rounded-lg max-w-lg text-center">
        <XCircle className="mx-auto mb-4 w-12 h-12 text-red-500" />
        <h3 className="mb-2 font-semibold text-red-800 text-lg">Failed to Load Dashboard</h3>
        <p className="text-red-600">{error}</p>
        <Button 
          onClick={() => window.location.reload()} 
          className="mt-4"
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }
  
  const statusColors = {
    'New': '#10b981',
    'Renewed': '#3b82f6',
    'Renew': '#3b82f6',
    'Dropped': '#ef4444',
    'Drop': '#ef4444'
  };

  const actionBreakdownColors = {
    'added': '#10b981',
    'renewed': '#3b82f6',
    'updated': '#8b5cf6',
    'dropped': '#ef4444'
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
      className={`space-y-4 animate-fade-in transition-opacity ${isPending ? 'opacity-60' : ''}`}>
      {/* Filters */}
      <Card className="bg-white shadow-sm border-0">
        <CardContent className="flex sm:flex-row flex-col justify-end items-center gap-4 p-2 sm:p-4">
          <div className="flex justify-between items-center gap-4">
            <div className="flex sm:flex-row flex-col items-start sm:items-center gap-2">
              <Label htmlFor="year-filter" className="font-medium text-gray-600 text-sm">Year</Label>
              <Select value={filters.year} onValueChange={(value) => handleFilterChange('year', value)} disabled={isPending}>
                <SelectTrigger id="year-filter" className="w-[120px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears && availableYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex sm:flex-row flex-col items-start sm:items-center gap-2">
              <Label htmlFor="month-filter" className="font-medium text-gray-600 text-sm">Month</Label>
              <Select value={filters.month} onValueChange={(value) => handleFilterChange('month', value)} disabled={isPending}>
                <SelectTrigger id="month-filter" className="w-[150px]">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All Months</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString(), name: new Date(0, i).toLocaleString('default', { month: 'long' }) })).map(month => (
                    <SelectItem key={month.value} value={month.value}>{month.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="gap-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {statsConfig.map((stat, index) => (
          <Card 
            key={index} 
            className={`card-interactive hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-gray-50/50 border-0 shadow-sm hover:scale-105 animate-slide-in-bottom`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardHeader className="flex flex-row justify-between items-center space-y-0 pb-3">
              <CardTitle className="font-semibold text-gray-700 text-sm">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${
                stat.trend === 'up' ? 'bg-green-100' : 'bg-red-100'
              } transition-colors duration-200`}>
                <stat.icon className={`h-4 w-4 ${
                  stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 mb-2 font-bold text-transparent text-3xl">
                {stat.value}
              </div>
              <div className="flex items-center text-sm">
                {stat.trend === 'up' ? (
                  <TrendingUp className="mr-2 w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="mr-2 w-4 h-4 text-red-500" />
                )}
                <span className={`font-semibold ${
                  stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.change}
                </span>
                <span className="ml-1 text-gray-600">from last month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="gap-6 grid grid-cols-1 lg:grid-cols-3">
        {/* Franchise Trends */}
        <Card className="lg:col-span-2 shadow-lg hover:shadow-xl border-0 transition-all animate-slide-up duration-300 glass">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 font-bold text-gray-800 text-lg">
              <div className="bg-blue-100 p-2 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              Franchise Trends
            </CardTitle>
            <CardDescription className="text-gray-600">New, renewed, and dropped franchises over time</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: 'none', 
                    borderRadius: '12px', 
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="new" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  name="New"
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="renew" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  name="Renewed"
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="drop" 
                  stroke="#ef4444" 
                  strokeWidth={3}
                  name="Dropped"
                  dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2, fill: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Franchise Status Distribution */}
        <Card className="shadow-lg hover:shadow-xl border-0 transition-all animate-slide-up duration-300 glass" style={{ animationDelay: '200ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 font-bold text-gray-800 text-lg">
              <div className="bg-purple-100 p-2 rounded-lg">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              Status Distribution
            </CardTitle>
            <CardDescription className="text-gray-600">Franchises by current status</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={status_distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  dataKey="value"
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {status_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={statusColors[entry.name] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: 'none', 
                    borderRadius: '12px', 
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3 mt-6">
              {status_distribution.map((status, index) => (
                <div key={index} className="flex justify-between items-center hover:bg-gray-50 p-2 rounded-lg transition-colors duration-200">
                  <div className="flex items-center gap-3">
                    <div className="shadow-sm rounded-full w-4 h-4" style={{ backgroundColor: statusColors[status.name] || '#6b7280' }} />
                    <span className="font-medium text-gray-700 text-sm">{status.name}</span>
                  </div>
                  <span className="font-bold text-gray-900 text-sm">{status.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="shadow-lg hover:shadow-xl border-0 transition-all animate-slide-up duration-300 glass" style={{ animationDelay: '400ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 font-bold text-gray-800 text-lg">
              <div className="bg-indigo-100 p-2 rounded-lg">
                <Plus className="w-5 h-5 text-indigo-600" />
              </div>
              Quick Actions
            </CardTitle>
            <CardDescription className="text-gray-600">Frequently used admin tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-3 sm:px-6">
            <Button 
              onClick={() => navigate('/applicants', { state: { from: 'dashboard_quick_action' } })}
              className="justify-start bg-gradient-to-r from-green-50 hover:from-green-100 to-green-100 hover:to-green-200 border-green-200 w-full h-12 text-green-800 hover:scale-[1.02] transition-all duration-200" 
              variant="outline"
            >
              <div className="bg-green-200 mr-3 p-1 rounded-lg">
                <Plus className="w-4 h-4 text-green-700" />
              </div>
              New Franchise
            </Button>
            <Button 
              onClick={() => navigate('/franchises', { state: { filter: 'renew' } })}
              className="justify-start bg-gradient-to-r from-blue-50 hover:from-blue-100 to-blue-100 hover:to-blue-200 border-blue-200 w-full h-12 text-blue-800 hover:scale-[1.02] transition-all duration-200" 
              variant="outline"
            >
              <div className="bg-blue-200 mr-3 p-1 rounded-lg">
                <RefreshCw className="w-4 h-4 text-blue-700" />
              </div>
              Process Renewal
            </Button>
            <Button 
              onClick={() => navigate('/makes')}
              className="justify-start bg-gradient-to-r from-purple-50 hover:from-purple-100 to-purple-100 hover:to-purple-200 border-purple-200 w-full h-12 text-purple-800 hover:scale-[1.02] transition-all duration-200" 
              variant="outline"
            >
              <div className="bg-purple-200 mr-3 p-1 rounded-lg">
                <Car className="w-4 h-4 text-purple-700" />
              </div>
              Manage Makes
            </Button>
            <Button 
              onClick={() => navigate('/franchises')}
              className="justify-start bg-gradient-to-r from-orange-50 hover:from-orange-100 to-orange-100 hover:to-orange-200 border-orange-200 w-full h-12 text-orange-800 hover:scale-[1.02] transition-all duration-200" 
              variant="outline"
            >
              <div className="bg-orange-200 mr-3 p-1 rounded-lg">
                <MapPin className="w-4 h-4 text-orange-700" />
              </div>
              View Routes
            </Button>
            <Button 
              onClick={() => navigate('/franchises', { state: { filter: 'expiring' } })}
              className="justify-start bg-gradient-to-r from-teal-50 hover:from-teal-100 to-teal-100 hover:to-teal-200 border-teal-200 w-full h-12 text-teal-800 hover:scale-[1.02] transition-all duration-200" 
              variant="outline"
            >
              <div className="bg-teal-200 mr-3 p-1 rounded-lg">
                <Cal className="w-4 h-4 text-teal-700" />
              </div>
              Expiring Soon
            </Button>
          </CardContent>
        </Card>

        {/* Top Routes */}
        <Card className="lg:col-span-2 shadow-lg hover:shadow-xl border-0 transition-all animate-slide-up duration-300 glass" style={{ animationDelay: '600ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 font-bold text-gray-800 text-lg">
              <div className="bg-yellow-100 p-2 rounded-lg">
                <MapPin className="w-5 h-5 text-yellow-600" />
              </div>
              Top Routes by Franchise Count
            </CardTitle>
            <CardDescription className="text-gray-600">Routes with highest franchise registrations</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="space-y-4">
              {top_routes.slice(0, 4).map((route, index) => (
                <div 
                  key={index} 
                  className="flex sm:flex-row flex-col justify-start sm:justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-white to-gray-50/50 shadow-sm hover:shadow-md p-5 border-0 rounded-xl hover:scale-[1.01] transition-all animate-slide-in-stagger duration-300"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex-1 space-y-2">
                    <h4 className="font-bold text-gray-800 text-base">{route.name}</h4>
                    <div className="flex items-center gap-4 text-gray-600 text-sm">
                      <span className="flex items-center gap-1">
                        <Car className="w-4 h-4" />
                        {route.make}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {route.franchises} franchises
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 w-full sm:w-auto min-w-[120px] text-right">
                    <div className="flex justify-end items-center gap-2">
                      <span className="font-bold text-gray-800 text-sm">{route.utilization}%</span>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        route.utilization >= 90 ? 'bg-green-100 text-green-800' :
                        route.utilization >= 80 ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {route.utilization >= 90 ? 'High' :
                         route.utilization >= 80 ? 'Medium' : 'Low'}
                      </div>
                    </div>
                    <Progress 
                      value={route.utilization} 
                      className="bg-gray-200 w-full h-2"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle Makes & Recent Activities */}
      <div className="gap-6 grid grid-cols-1 lg:grid-cols-2">
        {/* Top Vehicle Makes */}
        <Card className="shadow-lg hover:shadow-xl border-0 transition-all animate-slide-up duration-300 glass" style={{ animationDelay: '700ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 font-bold text-gray-800 text-lg">
              <div className="bg-emerald-100 p-2 rounded-lg">
                <Car className="w-5 h-5 text-emerald-600" />
              </div>
              Vehicle Makes Distribution
            </CardTitle>
            <CardDescription className="text-gray-600">Most popular motorcycle brands</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {top_makes.slice(0, 5).map((make, index) => (
                <div 
                  key={index} 
                  className="space-y-2 animate-slide-in-stagger"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-800">{make.name}</span>
                    <span className="text-gray-600 text-sm">{make.count} franchises</span>
                  </div>
                  <div className="relative bg-gray-200 rounded-full w-full h-3 overflow-hidden">
                    <div 
                      className="top-0 left-0 absolute bg-gradient-to-r from-blue-500 to-blue-600 rounded-full h-full transition-all duration-500"
                      style={{ width: `${make.percentage}%` }}
                    />
                  </div>
                  <span className="font-medium text-gray-500 text-xs">{make.percentage}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="shadow-lg hover:shadow-xl border-0 transition-all animate-slide-up duration-300 glass" style={{ animationDelay: '800ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 font-bold text-gray-800 text-lg">
              <div className="bg-cyan-100 p-2 rounded-lg">
                <Cal className="w-5 h-5 text-cyan-600" />
              </div>
              Recent Activities
            </CardTitle>
            <CardDescription className="text-gray-600">Latest franchise transactions</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="space-y-4">
              {recent_activities.slice(0, 4).map((activity, index) => (
                <div 
                  key={activity.id} 
                  className="flex items-center gap-4 bg-gradient-to-r from-white to-gray-50/30 shadow-sm hover:shadow-md px-0 sm:px-4 py-2 sm:py-4 border-0 rounded-xl hover:scale-[1.01] transition-all animate-slide-in-stagger duration-300"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <Avatar className="ring-2 ring-gray-200 w-11 h-11">
                    <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-200 font-semibold text-blue-800">
                      {activity.user.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-800">{activity.user}</span>
                      <span className="text-gray-600">{activity.action}</span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs font-medium border-0 ${
                          activity.type === 'new' ? 'bg-green-100 text-green-800' :
                          activity.type === 'renew' ? 'bg-blue-100 text-blue-800' :
                          activity.type === 'drop' ? 'bg-red-100 text-red-800' :
                          'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {activity.type}
                      </Badge>
                    </div>
                    <p className="font-medium text-gray-700 text-sm">{activity.subject}</p>
                  </div>
                  <div className="space-y-2 text-right">
                    <p className="font-medium text-gray-500 text-xs">{activity.time}</p>
                    <Button 
                      onClick={() => navigate('/franchises')}
                      variant="ghost" 
                      size="sm" 
                      className="hover:bg-blue-100 rounded-lg w-8 h-8 hover:text-blue-700 transition-colors duration-200 cursor-pointer"
                      disabled={!activity.id}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Analytics */}
      {user_analytics.length > 0 && (
        <Card className="shadow-lg hover:shadow-xl border-0 transition-all animate-slide-up duration-300 glass" style={{ animationDelay: '900ms' }}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 font-bold text-gray-800 text-lg">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              User Activity Analytics
            </CardTitle>
            <CardDescription className="text-gray-600">Top user performance based on franchise actions</CardDescription>
          </CardHeader>
          <CardContent className="gap-6 grid grid-cols-1 md:grid-cols-3 px-3 sm:px-6">
            <div className="md:col-span-2">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart 
                  data={user_analytics}
                  onMouseMove={(state) => {
                    if (state.isTooltipActive) {
                      setActiveUserAnalytics(state.activePayload[0].payload);
                    }
                  }}
                  onMouseLeave={() => setActiveUserAnalytics(user_analytics[0])}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="user_name" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: 'none', 
                      borderRadius: '12px', 
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="total_actions" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    name="Total Actions"
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {activeUserAnalytics && (
              <div className="flex flex-col justify-center items-center space-y-4">
                <h4 className="font-bold text-gray-800 text-center">{activeUserAnalytics.user_name}'s Breakdown</h4>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={Object.entries(activeUserAnalytics.actions_breakdown).map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={60}
                      dataKey="value"
                      stroke="#fff"
                      strokeWidth={2}
                    >
                      {Object.keys(activeUserAnalytics.actions_breakdown).map((key, index) => (
                        <Cell key={`cell-${index}`} fill={actionBreakdownColors[key] || '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 w-full">
                  {Object.entries(activeUserAnalytics.actions_breakdown).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="rounded-full w-3 h-3" style={{ backgroundColor: actionBreakdownColors[key] }}></div>
                        <span className="font-medium text-gray-700 capitalize">{key}</span>
                      </div>
                      <span className="font-bold text-gray-800">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}