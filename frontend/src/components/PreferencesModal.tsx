// PreferencesModal.tsx
import React, { useEffect, useState } from "react";
import styles from "../styles.json";
import { cardBacks, renderCardBack, renderCardImage, suitMap } from "../common";
import { Suit } from "../types";

const styleNames = styles.map((s) => s.name);

interface PreferencesModalProps {
  playerId: string;
  isOpen: boolean;
  onClose: () => void;
  onCardStyleChange?: (style: string) => void;
  onBackStyleChange?: (index: number) => void;
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  playerId,
  isOpen,
  onClose,
  onCardStyleChange,
  onBackStyleChange,
}) => {
  const [selectedStyle, setSelectedStyle] = useState<string>(styleNames[0]);
  const [selectedBack, setSelectedBack] = useState<number>(0);

  useEffect(() => {
    if (playerId) {
      const saved = localStorage.getItem('cardStyle');
      if (saved && styleNames.includes(saved)) {
        setSelectedStyle(saved);
      }
      const savedBack = localStorage.getItem('cardBack');
      if (savedBack && !isNaN(Number(savedBack))) {
        setSelectedBack(Number(savedBack));
      }
    }
  }, [playerId, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedStyle(value);
    localStorage.setItem('cardStyle', value);
    if (onCardStyleChange) onCardStyleChange(value);
  };

  const handleBackClick = (idx: number) => {
    setSelectedBack(idx);
    localStorage.setItem('cardBack', String(idx));
    if (onBackStyleChange) onBackStyleChange(idx);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-lg p-2 sm:p-4 md:p-6 min-w-0 w-full max-w-full sm:max-w-xs md:max-w-lg lg:max-w-2xl overflow-x-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Preferences</h2>
        <label className="flex items-center gap-2 mb-4">
          <span>Card style:</span>
          <select
            value={selectedStyle}
            onChange={handleChange}
            className="border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500"
          >
            {styleNames.map((style) => (
              style !== 'backs' && <option key={style} value={style}>
                {style.charAt(0).toUpperCase() + style.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap justify-center gap-2 mb-4 overflow-x-auto">
          {Object.keys(suitMap).map((suit) =>
            React.cloneElement(
              renderCardImage(
                { number: 1, suit: suit as Suit },
                selectedStyle,
                "min-h-[125px] h-[125px] w-auto md:h-40 lg:h-56 object-contain rounded shadow"
              ),
              { key: suit }
            )
          )}
        </div>
        <span>Card back:</span>
        <div className="flex flex-wrap justify-center gap-2 mb-4 overflow-x-auto">
          {cardBacks.map((c, idx) =>
            <div
              key={c.number}
              onClick={() => handleBackClick(idx)}
              className="cursor-pointer rounded"
              style={{
                display: "inline-block",
                filter: selectedBack === idx ? "none" : "grayscale(100%)"
              }}
            >
              {React.cloneElement(
                renderCardBack(
                  idx,
                  "min-h-[125px] h-[125px] w-auto md:h-40 lg:h-56 object-contain rounded shadow"
                ),
                { draggable: false }
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
