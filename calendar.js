(function () {
  "use strict";

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fullDayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function toISODate(date) {
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join("-");
  }

  function fromISODate(value) {
    if (!value) return null;
    const parts = value.split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function isSameDay(first, second) {
    return toISODate(first) === toISODate(second);
  }

  function addDays(date, amount) {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  }

  function startOfWeek(date) {
    return addDays(date, -date.getDay());
  }

  function formatDisplayDate(value, options) {
    const date = typeof value === "string" ? fromISODate(value) : value;
    if (!date) return "No date";
    return date.toLocaleDateString(undefined, options || {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function formatLongDate(value) {
    const date = typeof value === "string" ? fromISODate(value) : value;
    if (!date) return "Select a day";
    return `${fullDayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}`;
  }

  function getWeekDates(date) {
    const first = startOfWeek(date);
    return Array.from({ length: 7 }, (_, index) => addDays(first, index));
  }

  function getMonthMatrix(year, month) {
    const firstOfMonth = new Date(year, month, 1);
    const firstCell = addDays(firstOfMonth, -firstOfMonth.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(firstCell, index);
      return {
        date,
        iso: toISODate(date),
        inMonth: date.getMonth() === month
      };
    });
  }

  window.NoteCalendar = {
    dayNames,
    monthNames,
    toISODate,
    fromISODate,
    isSameDay,
    addDays,
    formatDisplayDate,
    formatLongDate,
    getWeekDates,
    getMonthMatrix
  };
})();
