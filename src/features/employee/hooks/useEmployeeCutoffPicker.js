import { useEffect, useMemo, useRef, useState } from "react";
import { buildCutoffOptions } from "../../../lib/dtr";

export function useEmployeeCutoffPicker() {
  const cutoffPickerRef = useRef(null);
  const cutoffSearchInputRef = useRef(null);
  const cutoffOptionRefs = useRef([]);
  const cutoffOptions = useMemo(() => buildCutoffOptions(new Date(), 48), []);
  const [cutoff, setCutoff] = useState(() => cutoffOptions[0]);
  const [cutoffPickerOpen, setCutoffPickerOpen] = useState(false);
  const [cutoffSearch, setCutoffSearch] = useState("");
  const [activeCutoffIndex, setActiveCutoffIndex] = useState(0);

  const orderedCutoffOptions = useMemo(() => [...cutoffOptions].reverse(), [cutoffOptions]);

  const filteredCutoffOptions = useMemo(() => {
    const query = cutoffSearch.trim().toLowerCase();
    if (!query) return orderedCutoffOptions;
    return orderedCutoffOptions.filter((item) => item.toLowerCase().includes(query));
  }, [orderedCutoffOptions, cutoffSearch]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (cutoffPickerRef.current && !cutoffPickerRef.current.contains(event.target)) {
        setCutoffPickerOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setCutoffPickerOpen(false);
      }
    }

    if (cutoffPickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [cutoffPickerOpen]);

  useEffect(() => {
    if (cutoffPickerOpen) {
      window.setTimeout(() => {
        cutoffSearchInputRef.current?.focus();
      }, 0);
    } else {
      setCutoffSearch("");
    }
  }, [cutoffPickerOpen]);

  useEffect(() => {
    const selectedIndex = filteredCutoffOptions.findIndex((item) => item === cutoff);
    setActiveCutoffIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [cutoff, filteredCutoffOptions]);

  useEffect(() => {
    const activeButton = cutoffOptionRefs.current[activeCutoffIndex];
    if (cutoffPickerOpen && activeButton) {
      activeButton.scrollIntoView({ block: "nearest" });
    }
  }, [activeCutoffIndex, cutoffPickerOpen]);

  function handleCutoffSearchKeyDown(event) {
    if (!filteredCutoffOptions.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveCutoffIndex((current) => (current + 1) % filteredCutoffOptions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveCutoffIndex((current) => (current - 1 + filteredCutoffOptions.length) % filteredCutoffOptions.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const nextValue = filteredCutoffOptions[activeCutoffIndex];
      if (nextValue) {
        setCutoff(nextValue);
        setCutoffPickerOpen(false);
      }
    }
  }

  return {
    activeCutoffIndex,
    cutoff,
    cutoffOptionRefs,
    cutoffPickerOpen,
    cutoffPickerRef,
    cutoffSearch,
    cutoffSearchInputRef,
    filteredCutoffOptions,
    handleCutoffSearchKeyDown,
    setActiveCutoffIndex,
    setCutoff,
    setCutoffPickerOpen,
    setCutoffSearch,
  };
}
