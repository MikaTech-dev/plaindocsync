import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

interface AlertContextType {
    showAlert: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
    showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState<'success' | 'error' | 'info' | 'confirm'>('info');
    const [onConfirmCb, setOnConfirmCb] = useState<(() => void) | null>(null);

    const showAlert = (newTitle: string, newMessage: string = '', newType: 'success' | 'error' | 'info' = 'info') => {
        setTitle(newTitle);
        setMessage(newMessage);
        setType(newType);
        setOnConfirmCb(null);
        setOpen(true);
    };

    const showConfirm = (newTitle: string, newMessage: string, onConfirm: () => void) => {
        setTitle(newTitle);
        setMessage(newMessage);
        setType('confirm');
        setOnConfirmCb(() => onConfirm);
        setOpen(true);
    };

    const handleConfirm = () => {
        if (onConfirmCb) onConfirmCb();
        setOpen(false);
    };

    return (
        <AlertContext.Provider value={{ showAlert, showConfirm }}>
            {children}

            {open && (
                <div className="fixed inset-0 bg-black/50 z-100 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
                        <div className="mb-4">
                            {type === 'success' && <CheckCircle className="text-green-500" size={48} />}
                            {type === 'error' && <AlertCircle className="text-red-500" size={48} />}
                            {type === 'info' && <Info className="text-blue-500" size={48} />}
                            {type === 'confirm' && <AlertCircle className="text-orange-500" size={48} />}
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                        {message && <p className="text-gray-600 mb-6">{message}</p>}

                        {type === 'confirm' ? (
                            <div className="flex gap-3 w-full mt-4">
                                <button
                                    onClick={handleConfirm}
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors"
                                >
                                    Confirm
                                </button>
                                <button
                                    onClick={() => setOpen(false)}
                                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-bold transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setOpen(false)}
                                className="w-full px-4 py-2 mt-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-bold transition-colors"
                            >
                                Okay
                            </button>
                        )}
                    </div>
                </div>
            )}
        </AlertContext.Provider>
    );
}

export const useAlert = () => {
    const context = useContext(AlertContext);
    if (!context) throw new Error("useAlert must be used within AlertProvider");
    return context;
};
