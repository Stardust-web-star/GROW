import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface FeederComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  id?: string;
}

export const FeederCombobox: React.FC<FeederComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Ketik nama penyulang...',
  className = '',
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultId = useId();
  const inputId = id || defaultId;
  const datalistId = `${inputId}-datalist`;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectOption = (feederName: string) => {
    onChange(feederName);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={inputId}
          list={datalistId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full bg-slate-800 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 rounded-xl px-3 py-2 pr-9 text-white font-medium text-xs placeholder:text-slate-500 transition-all outline-none"
        />

        {/* Dropdown Toggle Button - click only */}
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
          }}
          title={isOpen ? 'Tutup daftar pilihan' : 'Pilih dari daftar penyulang'}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-700/50 transition-colors cursor-pointer"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-amber-400' : ''}`}
          />
        </button>

        {/* Native HTML5 datalist for subtle browser suggestions */}
        <datalist id={datalistId}>
          {options.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      </div>

      {/* Floating Dropdown List - only shown when explicitly toggled via the chevron button */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 text-xs divide-y divide-slate-800/60 animate-in fade-in zoom-in-95 duration-100">
          {options.map((opt) => {
            const isSelected = opt.toLowerCase() === (value || '').toLowerCase();
            return (
              <button
                key={opt}
                type="button"
                onClick={() => handleSelectOption(opt)}
                className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="truncate">{opt}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
