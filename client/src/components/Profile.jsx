import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Camera, User, Mail, Phone, Shield, Save, CheckCircle } from 'lucide-react';

const Profile = ({ user, onUpdate }) => {
    const [formData, setFormData] = useState({
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || '',
        profilePicture: user.profilePicture || ''
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, profilePicture: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/profile/update`, {
                ...formData,
                username: user.username
            });
            if (res.data.success) {
                setMessage({ type: 'success', text: 'Profile updated successfully!' });
                onUpdate({ ...user, ...formData });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row gap-8">
                {/* Left: Avatar & Identity Card */}
                <div className="w-full md:w-1/3 space-y-6">
                    <div className="glass-card p-8 text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-50"></div>
                        
                        <div className="relative inline-block">
                            <div className="w-32 h-32 rounded-full border-4 border-white/20 shadow-2xl overflow-hidden mx-auto bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                {formData.profilePicture ? (
                                    <img src={formData.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={48} className="text-gray-400" />
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 p-2 bg-primary-500 text-white rounded-full shadow-lg cursor-pointer hover:scale-110 active:scale-95 transition-all">
                                <Camera size={18} />
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                            </label>
                        </div>

                        <h3 className="text-2xl font-black dark:text-white mt-6 tracking-tighter uppercase">{user.username}</h3>
                        <div className="flex items-center justify-center space-x-2 mt-2">
                            <Shield size={14} className="text-primary-500" />
                            <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest bg-primary-500/10 px-3 py-1 rounded-full border border-primary-500/20">
                                {user.role === 'admin' ? 'Authority Account' : 'Citizen Platform'}
                            </span>
                        </div>
                    </div>

                    <div className="glass-card p-6 border-l-4 border-emerald-500 bg-emerald-500/5">
                        <div className="flex items-center space-x-3 text-emerald-600 dark:text-emerald-400 mb-2">
                            <CheckCircle size={18} />
                            <p className="text-xs font-black uppercase tracking-widest">Security Status</p>
                        </div>
                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase leading-relaxed tracking-wider">
                            Your identity is verified via {user.role === 'admin' ? 'Government SSO' : 'Citizen Registration'}. Last login from recorded IP.
                        </p>
                    </div>
                </div>

                {/* Right: Personal Information Form */}
                <div className="flex-1">
                    <div className="glass-card p-10">
                        <div className="mb-8">
                            <h3 className="text-2xl font-black dark:text-white tracking-tighter uppercase mb-2">Account Profile</h3>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Update your contact details and representative information</p>
                        </div>

                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2 col-span-2">
                                <label className="text-[10px] font-black dark:text-gray-400 uppercase tracking-widest ml-1">Legal Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-primary-500/20 outline-none transition-all dark:text-white font-bold"
                                        placeholder="Enter your registered name"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black dark:text-gray-400 uppercase tracking-widest ml-1">Official Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-primary-500/20 outline-none transition-all dark:text-white font-bold"
                                        placeholder="name@organization.gov"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black dark:text-gray-400 uppercase tracking-widest ml-1">Emergency Contact Link</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-primary-500/20 outline-none transition-all dark:text-white font-bold"
                                        placeholder="+1 (xxx) xxx-xxxx"
                                    />
                                </div>
                            </div>

                            {message && (
                                <div className={`col-span-2 p-4 rounded-xl flex items-center space-x-3 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                    <CheckCircle size={18} />
                                    <span className="text-xs font-black uppercase tracking-widest">{message.text}</span>
                                </div>
                            )}

                            <div className="col-span-2 pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-primary-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-primary-500/25 hover:shadow-primary-500/40 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    <Save size={18} />
                                    <span>{loading ? 'Committing Changes...' : 'Save Profile Authority'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
