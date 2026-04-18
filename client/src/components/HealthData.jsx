import React, { useState, useEffect } from 'react';
import { ClipboardList, User, Phone, Thermometer, CheckCircle, Send, MapPin } from 'lucide-react';
import axios from 'axios';

const HealthData = () => {
    const [villages, setVillages] = useState([]);
    const [formData, setFormData] = useState({ name: '', contact: '', symptoms: '', village_id: '' });
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/villages`).then(res => setVillages(res.data));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/health`, formData);
            setSubmitted(true);
            setTimeout(() => setSubmitted(false), 3000);
            setFormData({ name: '', contact: '', symptoms: '', village_id: '' });
        } catch (err) { console.error(err); }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-500">
            <div className="text-center">
                <div className="h-16 w-16 bg-pink-100 dark:bg-pink-900/30 text-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ClipboardList size={32} />
                </div>
                <h2 className="text-3xl font-black dark:text-white tracking-tight">Community Health Surveillance</h2>
                <p className="text-gray-500 mt-2">Submit health updates to help AI detect potential waterborne outbreaks early.</p>
            </div>

            <form onSubmit={handleSubmit} className="glass-card p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-gray-400 tracking-widest flex items-center"><User size={14} className="mr-2" /> Full Name</label>
                        <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-700/50 border-none rounded-xl p-4 focus:ring-2 focus:ring-primary-500 dark:text-white" placeholder="John Doe" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-gray-400 tracking-widest flex items-center"><Phone size={14} className="mr-2" /> Contact</label>
                        <input required value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-700/50 border-none rounded-xl p-4 focus:ring-2 focus:ring-primary-500 dark:text-white" placeholder="+91 9876543210" />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-gray-400 tracking-widest flex items-center"><MapPin size={14} className="mr-2" /> Village / Residential Zone</label>
                    <select required value={formData.village_id} onChange={e => setFormData({ ...formData, village_id: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-700/50 border-none rounded-xl p-4 focus:ring-2 focus:ring-primary-500 dark:text-white">
                        <option value="">Select Village</option>
                        {villages.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-gray-400 tracking-widest flex items-center"><Thermometer size={14} className="mr-2" /> Reported Symptoms</label>
                    <textarea required value={formData.symptoms} onChange={e => setFormData({ ...formData, symptoms: e.target.value })} className="w-full bg-gray-50 dark:bg-gray-700/50 border-none rounded-xl p-4 focus:ring-2 focus:ring-primary-500 dark:text-white min-h-[120px]" placeholder="e.g., Diarrhea, Stomach Ache, Vomiting..." />
                </div>

                <button type="submit" className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary-500/30 transition-all flex items-center justify-center space-x-2">
                    <Send size={18} /> <span>Submit Surveillance Data</span>
                </button>
            </form>

            {submitted && (
                <div className="bg-green-500 text-white p-4 rounded-xl flex items-center justify-center animate-bounce">
                    <CheckCircle size={20} className="mr-2" /> Data sent successfully!
                </div>
            )}
        </div>
    );
};

export default HealthData;
