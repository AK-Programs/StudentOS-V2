/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Professional Tab & Filter Dropdown Selector
 * Replaces overflowing button strips with an elegant, responsive dropdown menu.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface TabDropdownOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  badgeColor?: string;
  description?: string;
}

interface ProfessionalTabDropdownProps {
  options: TabDropdownOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const ProfessionalTabDropdown: React.FC<ProfessionalTabDropdownProps> = ({
  options,
  selectedId,
  onSelect,
  label,
  className = '',
  size = 'md',
  fullWidth = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.id === selectedId) || options[0];

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const sizeClasses = {
    sm: 'py-2 px-3 text-xs',
    md: 'py-2.5 px-4 text-xs sm:text-sm',
    lg: 'py-3.5 px-5 text-sm sm:text-base'
  }[size];

  return (
    <div 
      ref={dropdownRef} 
      className={`relative inline-block ${fullWidth ? 'w-full' : 'min-w-[220px] max-w-sm'} ${className}`}
    >
      {label && (
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
          {label}
        </label>
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full bg-slate-900/90 hover:bg-slate-800/90 active:scale-[0.99] border border-white/10 hover:border-indigo-500/40 rounded-xl sm:rounded-2xl transition-all duration-200 flex items-center justify-between gap-3 text-left shadow-lg backdrop-blur-md cursor-pointer select-none group focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${sizeClasses}`}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectedOption?.icon && (
            <span className="shrink-0 text-indigo-400 flex items-center justify-center">
              {selectedOption.icon}
            </span>
          )}
          <span className="font-bold text-white tracking-wide truncate">
            {selectedOption?.label}
          </span>
          {selectedOption?.badge !== undefined && selectedOption.badge !== '' && (
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 font-extrabold ${selectedOption.badgeColor || 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'}`}>
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown 
          className={`w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-indigo-400' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute z-50 mt-1.5 w-full bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl py-1.5 overflow-hidden animate-fadeIn focus:outline-none divide-y divide-white/5 max-h-[340px] overflow-y-auto scrollbar-thin"
          style={{ minWidth: '100%' }}
        >
          {options.map((opt) => {
            const isSelected = opt.id === selectedId;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelect(opt.id);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer text-xs sm:text-sm ${
                  isSelected 
                    ? 'bg-indigo-600/15 text-white font-bold' 
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {opt.icon && (
                    <span className={`shrink-0 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`}>
                      {opt.icon}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`truncate ${isSelected ? 'text-white font-black' : 'text-slate-200 font-semibold'}`}>
                      {opt.label}
                    </p>
                    {opt.description && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {opt.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {opt.badge !== undefined && opt.badge !== '' && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${opt.badgeColor || 'bg-slate-800 text-slate-300 border border-white/5'}`}>
                      {opt.badge}
                    </span>
                  )}
                  {isSelected && (
                    <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
