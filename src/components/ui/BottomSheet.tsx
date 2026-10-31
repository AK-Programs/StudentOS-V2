import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-white/10 rounded-t-[2.5rem] z-[201] overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="p-4 flex flex-col items-center">
              <div className="w-12 h-1.5 bg-white/10 rounded-full mb-4" />
              <h3 className="text-sm font-black uppercase text-slate-400 tracking-wider w-full text-center">
                {title}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6 pt-0">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
