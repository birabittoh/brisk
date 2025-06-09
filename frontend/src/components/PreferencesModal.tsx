// PreferencesModal.tsx
import React, { useEffect, useState } from "react";
import styles from "../styles.json";

const styleNames = styles.map((s) => s.name);

interface PreferencesModalProps {
  playerId: string;
  isOpen: boolean;
  onClose: () => void;
  onCardStyleChange?: (style: string) => void;
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  playerId,
  isOpen,
  onClose,
  onCardStyleChange,
}) => {
  const [selectedStyle, setSelectedStyle] = useState<string>(styleNames[0]);

  useEffect(() => {
    if (playerId) {
      const saved = localStorage.getItem('cardStyle');
      if (saved && styleNames.includes(saved)) {
        setSelectedStyle(saved);
      }
    }
  }, [playerId, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedStyle(value);
    localStorage.setItem('cardStyle', value);
    if (onCardStyleChange) onCardStyleChange(value);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          padding: 24,
          borderRadius: 8,
          minWidth: 300,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Preferences</h2>
        <label>
          Favorite Card Style:
          <select
            value={selectedStyle}
            onChange={handleChange}
            style={{ marginLeft: 8 }}
          >
            {styleNames.map((style) => (
              <option key={style} value={style}>
                {style.charAt(0).toUpperCase() + style.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <div style={{ marginTop: 24, textAlign: "right" }}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
