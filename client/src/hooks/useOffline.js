import { useState, useEffect } from 'react';
import axios from 'axios';

const useOffline = (fetchDataCallback) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);
    const [lastSyncTime, setLastSyncTime] = useState(localStorage.getItem('last_sync_time') || null);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            syncOfflineData();
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial sync check
        updatePendingCount();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const updatePendingCount = () => {
        const complaints = JSON.parse(localStorage.getItem('offline_complaints') || '[]');
        const alerts = JSON.parse(localStorage.getItem('offline_alerts') || '[]');
        setPendingSyncCount(complaints.length + alerts.length);
    };

    const syncOfflineData = async () => {
        let complaints = JSON.parse(localStorage.getItem('offline_complaints') || '[]');
        const alerts = JSON.parse(localStorage.getItem('offline_alerts') || '[]');

        if (complaints.length === 0 && alerts.length === 0) return;

        console.log(`Syncing ${complaints.length} complaints and ${alerts.length} alerts...`);

        try {
            // Sync Complaints individually to ensure we clear only successfully synced ones
            const remainingComplaints = [];
            for (const complaint of complaints) {
                try {
                    await axios.post('http://localhost:5000/api/complaint/add', complaint);
                } catch (e) {
                    console.error("Individual complaint sync failed:", e);
                    remainingComplaints.push(complaint);
                }
            }
            localStorage.setItem('offline_complaints', JSON.stringify(remainingComplaints));

            // Sync Alerts (If backend support exists, otherwise just clear)
            localStorage.setItem('offline_alerts', '[]');

            updatePendingCount();
            if (fetchDataCallback) fetchDataCallback();

            setLastSyncTime(new Date().toISOString());
            localStorage.setItem('last_sync_time', new Date().toISOString());
        } catch (err) {
            console.error("Sync batch failed:", err);
        }
    };

    const bufferComplaint = (complaint) => {
        const complaints = JSON.parse(localStorage.getItem('offline_complaints') || '[]');
        const updatedComplaints = [...complaints, { ...complaint, offline: true, timestamp: new Date().toISOString() }];
        localStorage.setItem('offline_complaints', JSON.stringify(updatedComplaints));
        updatePendingCount();
    };

    return {
        isOnline,
        pendingSyncCount,
        lastSyncTime,
        bufferComplaint,
        syncOfflineData
    };
};

export default useOffline;
