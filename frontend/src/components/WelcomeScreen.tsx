import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { 
  FileText, 
  Users, 
  TrendingUp, 
  ArrowRight, 
  User, 
  Eye, 
  EyeOff,
  Car,
  MapPin,
  CheckCircle,
  BarChart3
} from 'lucide-react';

import SB from '../assets/images/sb.png';
import LGU from '../assets/images/lgu.png';
import VMO from '../assets/images/vmo.jpg';
import TRIC from '../assets/images/tricycle-less.png';

import { useAuth } from '../context/AuthContext';
import * as api from '../api/api.js';
import { appName } from '../lib/utils.js';
import { motion } from 'framer-motion';
import FastSBLogo from './ui/fast-sb-path-new.js';

export default function WelcomeScreen() {
  const { login, showAuth, setShowAuth, loginData, setLoginData } = useAuth();
  const [error, setError] = useState('');
  const userIdInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [welcomStats,setWelcomStats] = useState({
    active_franchises: 0,
    routes_covered: 0,
    vehicle_makes: 0,
    compliance_rate: 0,
  });
  
  const handleLoadStats = async () => {
    setIsLoading(true);

    try {
      const { data } = await api.get(`/api/welcome-stats`, { track: true, requestKey: 'fetch_welcom_stats' });
      setWelcomStats(data.stats);
    } catch (err) {
      const errMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || (err as Error).message || 'An unknown error occurred.';
      console.log(errMsg);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if(error){
      const tm = setTimeout(() => {
        setError('');
      },5000);

      return () => {
        clearTimeout(tm);
      }
    }
  },[error]);

  useEffect(() => {
    handleLoadStats();
  }, []);

  useEffect(() => {
    if (showAuth) {
      setTimeout(() => {
        if(!loginData.UserID){
          userIdInputRef.current?.focus();
        }else{
          passwordInputRef.current?.focus();
        }
      }, 100); // Small delay to ensure the element is rendered
    }
  }, [showAuth]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try{
      await login(loginData.UserID,loginData.Password);
    }catch(err){
      const errorMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || (err as Error).message || 'An unknown login error occurred.';
      toast.error(errorMessage);
      setLoginData(prev => ({ ...prev, Password: '' }));
    }finally{
      setIsLoading(false);
    }
  }

  // const sentence = {
  //   hidden: { opacity: 1 },
  //   visible: {
  //     opacity: 1,
  //     transition: { staggerChildren: 0.1, delayChildren: 0 },
  //   },
  // };

  // const letterVar = {
  //   hidden: { opacity: 0, y: 20, scale: 0.5},
  //   visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 3, repeat: Infinity, repeatType: "reverse", ease: easeInOut } },
  // };

  if (showAuth) {
    return (
      <div className="flex justify-center items-center bg-gradient-to-br from-[#008ea2] to-[#007a8b] p-4 sm:p-6 min-h-screen">
        <div className="flex flex-col space-y-4 w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="mb-2 font-bold text-white text-3xl">Franchise Management</h1>
            <p className="text-blue-100 text-lg">Sangguniang Bayan ng Santa Cruz, Davao del Sur</p>
          </div>

          <motion.div
            initial={{
              scale: 0,
            }}
            animate={{
              scale: 1,
              x: 0,
              y: 0,
            }}
            transition={{
              duration: 0.25,
              delay: 0,
              type: "spring",
            }}>
            <Card className="relative bg-white/95 shadow-2xl backdrop-blur-sm">
              {/* <p className="block top-3 left-4 absolute font-bold text-gray-700 text-sm">v{appVersion}</p> */}
              <div className="top-3 left-2 absolute flex justify-center items-start gap-x-2">
                <img src={LGU} alt="LGU" className="shadow-lg rounded-full w-[32px]" />
                <img src={SB} alt="LGU" className="shadow-sm w-[37px]" />
                <img src={VMO} alt="LGU" className="shadow-lg w-[32px]" />
              </div>

              <CardHeader className="space-y-2 pb-4">
                <div className="flex justify-center items-center gap-3">
                  <div className="flex justify-center items-center gap-x-0 bg-[#007a8b] p-4 rounded-full w-24 h-24">
                    <FastSBLogo/>
                    {/* <img src={Lgu} className="shadow-sm rounded-full w-20" alt="LGU" />
                    <img src={Logo} className="shadow-sm rounded-full w-24" alt="SB" /> */}
                  </div>
                </div>
                <CardTitle className="font-bold text-gray-800 text-2xl text-center sm:text-start">Welcome Back</CardTitle>
                <CardDescription className="text-gray-600 text-base text-center sm:text-start">
                  Sign in to access the franchise management portal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="userid" className="font-medium text-gray-700">User ID</Label>
                    <div className="relative">
                      <User className="top-3 left-3 absolute w-5 h-5 text-gray-400" />
                      <Input
                        ref={userIdInputRef}
                        id="userid"
                        type="text"
                        placeholder="Enter your User ID"
                        className="pl-10 border-gray-300 focus:border-[#008ea2] focus:ring-[#008ea2] h-11"
                        value={loginData.UserID}
                        onChange={(e) => setLoginData(prev => ({ ...prev, UserID: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password" className="font-medium text-gray-700">Password</Label>
                    <div className="relative">
                      <div className="top-3 left-3 absolute w-5 h-5 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      </div>
                      <Input
                        ref={passwordInputRef}
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        className="pl-10 border-gray-300 focus:border-[#008ea2] focus:ring-[#008ea2] h-11"
                        value={loginData.Password}
                        onChange={(e) => setLoginData(prev => ({ ...prev, Password: e.target.value }))}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="top-3 right-3 absolute text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive" className="bg-red-50 border-red-200">
                      <AlertDescription className="text-red-800">{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button 
                    type="submit"
                    className="bg-[#008ea2] hover:bg-[#2d6fd9] shadow-md !my-4 w-full h-11 font-semibold text-white text-base hover:scale-[1.02] transition-all" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <span className="mr-2 border-2 border-white/30 border-t-white rounded-full w-4 h-4 animate-spin"></span>
                        Signing in...
                      </div>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="mt-6 text-center">
              <button
                onClick={() => setShowAuth(false)}
                className="px-4 py-2 text-blue-100 hover:text-white text-base transition-colors"
              >
                ← Back to Home
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      transition={{
        duration: 0.25,
        delay: 0,
        type: "tween",
      }} className="bg-gradient-to-br from-[#008ea2] to-[#007a8b] min-h-screen">
        
      {/* Header */}
      <header className="top-0 z-50 sticky bg-[#007a8b] backdrop-blur-sm px-6 py-5">
        <div className="flex sm:flex-row flex-col justify-start sm:justify-between items-start sm:items-center mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <div className="flex justify-center items-center w-12 h-12">
              <div className="max-w-12 max-h-12">
                <FastSBLogo/>
              </div>
              {/* <img src={Logo} alt="Logo" className="min-w-16 min-h-16" /> */}
            </div>
            <div className="text-white">
              <div className="font-bold text-xl leading-tight">{ appName }</div>
              <div className="text-blue-100 text-sm">Santa Cruz, Davao del Sur</div>
            </div>
          </div>
          <Button
            onClick={() => setShowAuth(true)}
            variant="outline"
            size="lg"
            className="bg-transparent hover:bg-white mx-auto sm:mx-0 mt-4 sm:mt-0 px-6 py-2 border-2 border-white font-semibold text-white hover:text-[#008ea2] hover:scale-105 transition-all"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative px-4 sm:px-6 pt-8 pb-16">
        <motion.div 
          className="mx-auto max-w-7xl"
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5, type:"tween" }}
        >
          <div className="space-y-4 text-white text-center">
            {/* <div className="flex justify-center items-start gap-x-2">
              <img src={LGU} alt="LGU" className="shadow-lg rounded-full w-[90px]" />
              <img src={SB} alt="LGU" className="shadow-sm w-[95px]" />
              <img src={VMO} alt="LGU" className="shadow-lg w-[80px]" />
            </div> */}
            <div className="relative flex justify-center items-center gap-x-1">
              <motion.div
                initial={{x: '-100vw'}}
                animate={{x:0}}
                transition={{type: "spring", duration: 0.75, ease: "linear"}}
              className="flex justify-center items-center gap-x-0 -mt-6 w-full max-w-2xl">
                <FastSBLogo/>
                <img src={TRIC} alt="Tricycle" className="hidden sm:block top-1/2 left-1/2 absolute opacity-75 shadow-sm w-[340px] max-w-[340px] -translate-y-[30%] translate-x-1/2"/>
              </motion.div>
              {/* <img src={TRIC} alt="Tricycle" className="opacity-50 mt-20 -ml-20 w-30 max-w-30"/> */}


              {/* <motion.img
                animate={{
                  opacity: [0.7,1],
                }}
                transition={{
                  duration: 0.5,
                }}
              src={Lgu} className="shadow-sm rounded-full w-[130px]" alt="LGU" />
              <motion.img
                animate={{
                  opacity: [0.7,1],
                }}
                transition={{
                  duration: 0.5,
                }}
              src={Logo} className="shadow-sm rounded-full w-40" alt="SB" /> */}
            </div>
            <motion.div
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              transition={{ delay: 0.75 }}

              className='space-y-0'>
              <h2 className="pt-4 font-semibold text-blue-50 text-2xl sm:text-3xl md:text-4xl italic">Franchise Application and System Tracking</h2>
              <p className="text-2xl">(Sangguniang Bayan)</p>
            </motion.div>
            <div className="flex sm:flex-row flex-col justify-center items-center gap-4 pt-4">
              <Button
                onClick={() => setShowAuth(true)}
                size="lg"
                className="bg-white hover:bg-blue-50 shadow-xl px-8 py-6 font-semibold text-[#008ea2] text-lg hover:scale-105 transition-all"
              >
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              {/* <Button
                variant="outline"
                size="lg"
                className="bg-transparent hover:bg-white px-8 py-6 border-2 border-white font-semibold text-white hover:text-[#008ea2] text-lg hover:scale-105 transition-all"
              >
                Learn More
              </Button> */}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Stats Section */}
      <motion.div 
        className="bg-white/10 backdrop-blur-sm py-12"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true,  }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <div className="mx-auto px-6 max-w-7xl">
          <motion.div 
            className="gap-8 grid grid-cols-2 md:grid-cols-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.2 } }}
            viewport={{ once: true,  }}>
            <div className="flex flex-col justify-center items-center text-center">
              <div className="mb-2 font-bold text-white text-4xl">{new Intl.NumberFormat('en-US').format(welcomStats?.active_franchises || 0)}+</div>
              <div className="text-blue-100">Active Franchises</div>
            </div>
            <div className="flex flex-col justify-center items-center text-center">
              <div className="mb-2 font-bold text-white text-4xl">{welcomStats?.routes_covered || 0}</div>
              <div className="text-blue-100">Routes Covered</div>
            </div>
            <div className="flex flex-col justify-center items-center text-center">
              <div className="mb-2 font-bold text-white text-4xl">{welcomStats?.vehicle_makes || 0}</div>
              <div className="text-blue-100">Vehicle Brands</div>
            </div>
            <div className="flex flex-col justify-center items-center text-center">
              <div className="mb-2 font-bold text-white text-4xl">{welcomStats?.compliance_rate || 0}%</div>
              <div className="text-blue-100">Compliance Rate</div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Features Section */}
      <motion.div 
        className="bg-white py-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        transition={{ staggerChildren: 0.1 }}
      >
        <div className="mx-auto px-6 max-w-7xl"
        >
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-bold text-gray-900 text-3xl md:text-4xl">
              Comprehensive Franchise Management Tools
            </h2>
            <p className="mx-auto max-w-2xl text-gray-600 text-lg">
              A comprehensive digital platform for managing tricycle franchises, tracking renewals, and monitoring route assignments in Santa Cruz, Davao del Sur.
            </p>
          </div>

          <motion.div 
            className="gap-8 grid md:grid-cols-2 lg:grid-cols-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            transition={{ staggerChildren: 0.2 }}
          >
            <motion.div 
              className="bg-gradient-to-br from-blue-50 to-white shadow-lg hover:shadow-xl p-8 border border-blue-100 rounded-xl hover:scale-105 transition-all"
              variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25, type: "spring" } } }}
            >
              <div className="flex justify-center items-center bg-[#008ea2] shadow-md mb-4 rounded-full w-14 h-14">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <h3 className="mb-3 font-bold text-gray-900 text-xl">Franchise Records</h3>
              <p className="text-gray-600">
                Complete digital records of all franchise applications, approvals, and renewals.
              </p>
            </motion.div>

            <motion.div 
              className="bg-gradient-to-br from-green-50 to-white shadow-lg hover:shadow-xl p-8 border border-green-100 rounded-xl hover:scale-105 transition-all"
              variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25, type: "spring" } } }}
            >
              <div className="flex justify-center items-center bg-green-600 shadow-md mb-4 rounded-full w-14 h-14">
                <MapPin className="w-7 h-7 text-white" />
              </div>
              <h3 className="mb-3 font-bold text-gray-900 text-xl">Route Management</h3>
              <p className="text-gray-600">
                Track and manage all tricycle routes with real-time franchise assignments.
              </p>
            </motion.div>

            <motion.div 
              className="bg-gradient-to-br from-purple-50 to-white shadow-lg hover:shadow-xl p-8 border border-purple-100 rounded-xl hover:scale-105 transition-all"
              variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25, type: "spring" } } }}
            >
              <div className="flex justify-center items-center bg-purple-600 shadow-md mb-4 rounded-full w-14 h-14">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              <h3 className="mb-3 font-bold text-gray-900 text-xl">Renewal Tracking</h3>
              <p className="text-gray-600">
                Automated alerts and tracking for franchise renewals and expirations.
              </p>
            </motion.div>

            <motion.div 
              className="bg-gradient-to-br from-orange-50 to-white shadow-lg hover:shadow-xl p-8 border border-orange-100 rounded-xl hover:scale-105 transition-all"
              variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25, type: "spring" } } }}
            >
              <div className="flex justify-center items-center bg-orange-600 shadow-md mb-4 rounded-full w-14 h-14">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <h3 className="mb-3 font-bold text-gray-900 text-xl">Analytics & Reports</h3>
              <p className="text-gray-600">
                Comprehensive statistics and reports for informed decision-making.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* Benefits Section */}
      <motion.div 
        className="bg-gray-50 py-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        variants={{ hidden: { opacity: 0, y: 0 }, visible: { opacity: 1, y: 0 } }}
      >
        <div className="mx-auto px-6 max-w-7xl">
          <motion.div className="items-center gap-12 grid lg:grid-cols-2">
            <div className="space-y-6">
              <h2 className="font-bold text-gray-900 text-3xl md:text-4xl">
                Streamlined Franchise Operations
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed">
                Our system helps the Sangguniang Bayan of Santa Cruz efficiently manage tricycle 
                franchises, ensuring compliance, tracking renewals, and maintaining organized records.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-shrink-0 justify-center items-center bg-blue-100 mt-1 rounded-full w-6 h-6">
                    <CheckCircle className="w-4 h-4 text-[#008ea2]" />
                  </div>
                  <div>
                    <h4 className="mb-1 font-semibold text-gray-900">Digital Record Keeping</h4>
                    <p className="text-gray-600">Eliminate paper records with secure digital storage</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="flex flex-shrink-0 justify-center items-center bg-blue-100 mt-1 rounded-full w-6 h-6">
                    <CheckCircle className="w-4 h-4 text-[#008ea2]" />
                  </div>
                  <div>
                    <h4 className="mb-1 font-semibold text-gray-900">Automated Notifications</h4>
                    <p className="text-gray-600">Never miss renewal deadlines with smart alerts</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="flex flex-shrink-0 justify-center items-center bg-blue-100 mt-1 rounded-full w-6 h-6">
                    <CheckCircle className="w-4 h-4 text-[#008ea2]" />
                  </div>
                  <div>
                    <h4 className="mb-1 font-semibold text-gray-900">Real-time Analytics</h4>
                    <p className="text-gray-600">Make data-driven decisions with comprehensive reports</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-blue-100 to-white shadow-2xl p-8 border-2 border-blue-200 rounded-2xl 007a8bblue-50">
                <div className="space-y-6">
                  <div className="flex items-center gap-4 bg-white shadow-md p-4 rounded-xl">
                    <div className="flex justify-center items-center bg-blue-100 rounded-lg w-12 h-12">
                      <Car className="w-6 h-6 text-[#008ea2]" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Vehicle Tracking</div>
                      <div className="text-gray-600 text-sm">Monitor all registered vehicles</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 bg-white shadow-md p-4 rounded-xl">
                    <div className="flex justify-center items-center bg-green-100 rounded-lg w-12 h-12">
                      <Users className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Owner Management</div>
                      <div className="text-gray-600 text-sm">Complete operator information</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 bg-white shadow-md p-4 rounded-xl">
                    <div className="flex justify-center items-center bg-purple-100 rounded-lg w-12 h-12">
                      <TrendingUp className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Status Monitoring</div>
                      <div className="text-gray-600 text-sm">Track franchise status in real-time</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Call to Action */}
      <motion.div 
        className="bg-gradient-to-br from-[#008ea2] to-[#007a8b] py-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true,  }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        variants={{ hidden: { opacity: 0, y: 50 }, visible: { opacity: 1, y: 0 } }}
      >
        <motion.div className="mx-auto px-6 max-w-4xl text-white text-center">
          <h2 className="mb-4 font-bold text-3xl md:text-4xl">
            Ready to Access the Franchise Management?
          </h2>
          <p className="mb-8 text-blue-100 text-lg">
            Make franchise management more efficient and transparent for Santa Cruz, Davao del Sur.
          </p>
          <Button
            onClick={() => setShowAuth(true)}
            size="lg"
            className="bg-white hover:bg-blue-50 shadow-xl px-8 py-6 font-semibold text-[#008ea2] text-lg hover:scale-105 transition-all"
          >
            Access System
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </motion.div>
      </motion.div>

      {/* Footer */}
      <footer className="bg-[#007a8b] py-8 text-white/80 text-sm text-center">
        <div className="mx-auto px-6 max-w-7xl">
          <p>© {new Date().getFullYear()} Sangguniang Bayan ng Santa Cruz, Province of Davao del Sur. All rights reserved.</p>
          <p className="mt-2">Franchise Management & Tracker System</p>
        </div>
      </footer>
    </motion.div>
  );
}