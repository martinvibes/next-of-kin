"use client";

import { useEffect, useState } from "react";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Rolling digits. Each digit is a 0–9 strip that slides to its value, so a
 * number counts into place on mount and rolls again whenever it changes.
 * Screen readers get the plain value.
 */
export function Odometer({ value, className = "" }: { value: string; className?: string }) {
  const [shown, setShown] = useState(() => value.replace(/\d/g, "0"));
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);

  const chars = shown.split("");
  return (
    <span className={`odo ${className}`} role="img" aria-label={value}>
      {chars.map((c, i) => {
        const key = chars.length - i;
        if (!/\d/.test(c))
          return (
            <span key={`s${key}`} aria-hidden="true">
              {c}
            </span>
          );
        return (
          <span key={`d${key}`} className="odo-col" aria-hidden="true">
            <span className="odo-strip" style={{ transform: `translateY(-${Number(c)}em)`, transitionDelay: `${i * 70}ms` }}>
              {DIGITS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
