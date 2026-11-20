"use client";

import { useState } from "react";

const weekdays = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const monthLabel = new Intl.DateTimeFormat("en-GB",{month:"long",year:"numeric",timeZone:"UTC"});
const dayLabel = new Intl.DateTimeFormat("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"});
const dateKey = (date: Date) => date.toISOString().slice(0,10);
const atDate = (key: string) => new Date(key + "T12:00:00Z");
type Change = { action: "memberAvailability"; unavailable: string[]; available: string[] };

export function AvailabilityCalendar({today, savedDates, save}: {
  today: string;
  savedDates: string[];
  save?: (change: Change) => Promise<unknown>;
}) {
  const currentMonth = today.slice(0,7);
  const [selectedMonth,setSelectedMonth] = useState(currentMonth);
  const [changes,setChanges] = useState<Record<string,boolean>>({});
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState("");
  const saved = new Set(savedDates);
  const month = selectedMonth < currentMonth ? currentMonth : selectedMonth;
  const first = atDate(month + "-01");
  const offset = (first.getUTCDay() + 6) % 7;
  const end = new Date(first);
  end.setUTCMonth(end.getUTCMonth() + 1,0);
  const pending = Object.entries(changes).filter(([date,value]) => date >= today && value !== saved.has(date));

  const moveMonth = (direction: number) => {
    const next = new Date(first);
    next.setUTCMonth(next.getUTCMonth() + direction);
    setSelectedMonth(dateKey(next).slice(0,7));
  };
  const toggle = (date: string) => {
    setMessage("");
    setChanges(previous => ({...previous,[date]:!(previous[date] ?? saved.has(date))}));
  };
  const saveDates = async () => {
    if (!save) return;
    setSaving(true);
    setMessage("");
    try {
      if (await save({
        action:"memberAvailability",
        unavailable:pending.filter(([,value]) => value).map(([date]) => date),
        available:pending.filter(([,value]) => !value).map(([date]) => date),
      })) {
        setChanges({});
        setMessage("Your unavailable dates have been saved.");
      }
    } finally {
      setSaving(false);
    }
  };

  return <section className="availability-calendar">
    <h3>My unavailability</h3>
    <p>{save ? "Mark the dates you can’t play. Team managers will see “Not Available” when selecting for those dates." : "Sign in with your own member account to save unavailable dates."}</p>
    <div className="card calendar-card">
      <div className="calendar-month">
        <button type="button" className="button secondary" disabled={month === currentMonth} aria-label="Previous month" onClick={() => moveMonth(-1)}>‹</button>
        <h4 aria-live="polite">{monthLabel.format(first)}</h4>
        <button type="button" className="button secondary" disabled={month === "9999-12"} aria-label="Next month" onClick={() => moveMonth(1)}>›</button>
      </div>
      <div className="calendar-days">
        {weekdays.map(day => <span className="calendar-weekday" key={day}>{day}</span>)}
        {Array.from({length:offset},(_,index) => <span key={`empty-${index}`} aria-hidden="true"/>)}
        {Array.from({length:end.getUTCDate()},(_,index) => {
          const day = new Date(first);
          day.setUTCDate(index + 1);
          const date = dateKey(day);
          return <button type="button" key={date} disabled={!save || date < today || saving}
            aria-label={dayLabel.format(day)} aria-current={date === today ? "date" : undefined}
            aria-pressed={changes[date] ?? saved.has(date)} onClick={() => toggle(date)}>{index + 1}</button>;
        })}
      </div>
      <div className="buttons">
        <button type="button" className="button" disabled={saving || !pending.length} onClick={() => void saveDates()}>{saving ? "Saving dates…" : "Save unavailable dates"}</button>
      </div>
      {message && <p role="status">{message}</p>}
    </div>
  </section>;
}
