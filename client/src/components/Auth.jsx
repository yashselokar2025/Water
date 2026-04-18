import React, { useState, useEffect } from 'react';
import { Lock, User, RefreshCcw, ShieldCheck, UserPlus, LogIn } from 'lucide-react';
import axios from 'axios';

const Auth = ({ onLogin }) => {
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('citizen');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [pipelineId, setPipelineId] = useState('');
    const [pipelines, setPipelines] = useState([]);
    const [captchaAns, setCaptchaAns] = useState('');
    const [captcha, setCaptcha] = useState({ q: '', a: 0 });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const generateCaptcha = () => {
        const num1 = Math.floor(Math.random() * 10) + 1;
        const num2 = Math.floor(Math.random() * 10) + 1;
        setCaptcha({ q: `${num1} + ${num2}`, a: num1 + num2 });
        setCaptchaAns('');
    };

    useEffect(() => {
        generateCaptcha();
        fetchPipelines();
    }, []);

    const fetchPipelines = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/pipelines`);
            setPipelines(res.data);
        } catch (err) { console.error(err); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (parseInt(captchaAns) !== captcha.a) {
            setError('Incorrect CAPTCHA answer. Try again.');
            generateCaptcha();
            return;
        }

        try {
            if (isRegister) {
                if (!phone) {
                    setError('Phone number is required for emergency alerts.');
                    return;
                }
                await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/register`, {
                    username, password, role, fullName, email, phone, pipelineId
                });
                setSuccess('Registration successful! Please login.');
                setIsRegister(false);
                setPassword('');
                generateCaptcha();
            } else {
                const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/login`, {
                    username,
                    password,
                    captchaAnswer: captchaAns,
                    captchaQuestion: captcha.q
                });
                onLogin(res.data);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Authentication failed');
            generateCaptcha();
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 font-sans overflow-hidden">
            {/* Background Video Layer */}
            <video 
                autoPlay 
                muted 
                loop 
                playsInline 
                className="absolute top-0 left-0 w-full h-full object-cover z-0"
            >
                <source src="/login-bg.mp4" type="video/mp4" />
                Your browser does not support the video tag.
            </video>

            {/* Premium Dark Overlay */}
            <div className="absolute top-0 left-0 w-full h-full bg-black/40 dark:bg-black/60 backdrop-blur-[2px] z-10" />

            <div className="relative z-20 max-w-md w-full glass-card p-10 space-y-8 animate-in zoom-in-95 duration-500 border border-white/20">
                <div className="text-center">
                    <div className="mx-auto h-16 w-16 bg-primary-500 text-white rounded-2xl flex items-center justify-center shadow-xl mb-4 transform rotate-3 hover:rotate-0 transition-transform">
                        {isRegister ? <UserPlus size={32} /> : <ShieldCheck size={32} />}
                    </div>
                    <h2 className="text-3xl font-black dark:text-white tracking-tight">SmartWater AI</h2>
                    <p className="text-sm text-gray-500 mt-2 uppercase tracking-widest font-bold text-[10px]">
                        {isRegister ? 'Create Secure Account' : 'Gateway Authorization'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {(error || success) && (
                        <div className={`p-4 rounded-xl text-xs font-bold uppercase tracking-wider text-center border ${error ? 'bg-red-50 border-red-100 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' : 'bg-green-50 border-green-100 text-green-600 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'}`}>
                            {error || success}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400">
                                <User size={18} />
                            </span>
                            <input
                                required
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary-500 transition-all dark:text-white"
                                placeholder="Username"
                            />
                        </div>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400">
                                <Lock size={18} />
                            </span>
                            <input
                                required
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary-500 transition-all dark:text-white"
                                placeholder="Password"
                            />
                        </div>
                        {isRegister && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Full Name</label>
                                    <input required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500 transition-all dark:text-white text-sm" placeholder="John Doe" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Phone (SMS Alerts)</label>
                                        <input required value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500 transition-all dark:text-white text-sm" placeholder="+1234567890" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Email (Optional)</label>
                                        <input value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500 transition-all dark:text-white text-sm" placeholder="john@example.com" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Access Role</label>
                                        <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500 transition-all dark:text-white text-sm appearance-none">
                                            <option value="citizen">Citizen</option>
                                            <option value="admin">Government</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Linked Pipeline</label>
                                        <select value={pipelineId} onChange={e => setPipelineId(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500 transition-all dark:text-white text-sm appearance-none">
                                            <option value="">None / Select</option>
                                            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-2xl space-y-4 border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest leading-relaxed">Identity Verification</label>
                            <button type="button" onClick={generateCaptcha} className="text-primary-500 hover:rotate-180 transition-transform duration-500">
                                <RefreshCcw size={16} />
                            </button>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="text-xl font-black dark:text-white bg-white dark:bg-gray-700 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 shadow-inner">
                                {captcha.q}
                            </div>
                            <input
                                required
                                value={captchaAns}
                                onChange={e => setCaptchaAns(e.target.value)}
                                className="flex-1 bg-white dark:bg-gray-700 border-2 border-gray-100 dark:border-gray-600 rounded-xl py-3 px-4 focus:border-primary-500 focus:outline-none dark:text-white"
                                placeholder="Value"
                            />
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary-500/30 transition-all transform active:scale-[0.98] flex items-center justify-center space-x-2">
                        {isRegister ? <UserPlus size={20} /> : <LogIn size={20} />}
                        <span>{isRegister ? 'Create Account' : 'Authorize Access'}</span>
                    </button>
                </form>

                <div className="text-center pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button
                        onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess(''); }}
                        className="text-sm font-bold text-primary-500 hover:text-primary-600 transition-colors"
                    >
                        {isRegister ? 'Already have credentials? Log In' : 'New Authority/Citizen? Register here'}
                    </button>
                    <div className="mt-4 text-[9px] text-gray-400 uppercase font-black tracking-[0.2em] opacity-40">
                        Secured by Antigravity Protocol
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Auth;
