import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, AlertTriangle, Settings, TrendingUp, Clock, ChevronDown, ChevronUp, X } from 'lucide-react';

// LocalStorage key
const STORAGE_KEY = 'pto-calculator-state';

// Load state from localStorage
const loadState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
  return null;
};

// Save state to localStorage
const saveState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
};

export default function PTOCalculator() {
  // Load initial state from localStorage or use defaults
  const savedState = loadState();

  const [config, setConfig] = useState(savedState?.config || {
    startingPTO: 23.51,
    startDate: '2026-01-09',
    accrualAmount: 11.08,
    accrualCadence: 'biweekly',
    firstAccrualDate: '2026-01-23',
  });

  const [showSettings, setShowSettings] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showBalanceDatePicker, setShowBalanceDatePicker] = useState(false);
  const [balanceViewDate, setBalanceViewDate] = useState(new Date().toISOString().split('T')[0]);
  const [balanceDateMonth, setBalanceDateMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState(savedState?.selectedDates || []);
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 0, 1));
  const [timelineMonths, setTimelineMonths] = useState(savedState?.timelineMonths || 6);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    saveState({ config, selectedDates, timelineMonths });
  }, [config, selectedDates, timelineMonths]);

  // Colors
  const COLORS = {
    workLowBalance: '#e5e7eb',      // Cool grey (< 40 hrs)
    workHighBalance: '#9ca898',      // Muted sage (>= 40 hrs)
    pto: '#52525b',                  // Zinc/charcoal for PTO
    holiday: '#93c5fd',              // Light blue for holidays
    balanceLine: '#4f46e5',          // Indigo for balance line
  };

  // Calculate holidays for a given year range
  const getHolidays = useMemo(() => {
    const holidays = new Map();

    // Helper to adjust weekend holidays to Friday
    const adjustForWeekend = (date) => {
      const day = date.getDay();
      if (day === 0) { // Sunday -> previous Friday
        date.setDate(date.getDate() - 2);
      } else if (day === 6) { // Saturday -> previous Friday
        date.setDate(date.getDate() - 1);
      }
      return date;
    };

    // Get nth weekday of month (for floating holidays)
    const getNthWeekday = (year, month, weekday, n) => {
      const date = new Date(year, month, 1);
      let count = 0;
      while (count < n) {
        if (date.getDay() === weekday) {
          count++;
          if (count === n) break;
        }
        date.setDate(date.getDate() + 1);
      }
      return date;
    };

    // Get last weekday of month
    const getLastWeekday = (year, month, weekday) => {
      const date = new Date(year, month + 1, 0); // Last day of month
      while (date.getDay() !== weekday) {
        date.setDate(date.getDate() - 1);
      }
      return date;
    };

    // Calculate holidays for years 2025-2028
    for (let year = 2025; year <= 2028; year++) {
      // New Year's Day - January 1
      const newYears = adjustForWeekend(new Date(year, 0, 1));
      holidays.set(newYears.toISOString().split('T')[0], "New Year's Day");

      // MLK Jr Day - 3rd Monday of January
      const mlk = getNthWeekday(year, 0, 1, 3);
      holidays.set(mlk.toISOString().split('T')[0], 'MLK Jr Day');

      // Memorial Day - Last Monday of May
      const memorial = getLastWeekday(year, 4, 1);
      holidays.set(memorial.toISOString().split('T')[0], 'Memorial Day');

      // Independence Day - July 4
      const july4 = adjustForWeekend(new Date(year, 6, 4));
      holidays.set(july4.toISOString().split('T')[0], 'Independence Day');

      // Labor Day - 1st Monday of September
      const labor = getNthWeekday(year, 8, 1, 1);
      holidays.set(labor.toISOString().split('T')[0], 'Labor Day');

      // Thanksgiving - 4th Thursday of November
      const thanksgiving = getNthWeekday(year, 10, 4, 4);
      holidays.set(thanksgiving.toISOString().split('T')[0], 'Thanksgiving');

      // Christmas Day - December 25
      const christmas = adjustForWeekend(new Date(year, 11, 25));
      holidays.set(christmas.toISOString().split('T')[0], 'Christmas Day');
    }

    return holidays;
  }, []);

  // Check if a date is a holiday
  const isHoliday = (dateStr) => getHolidays.has(dateStr);
  const getHolidayName = (dateStr) => getHolidays.get(dateStr);

  // Get all dates that use PTO (selected dates + holidays)
  const getAllPTODates = useMemo(() => {
    const allDates = new Set(selectedDates);

    // Add holidays within the timeline range
    const startDate = new Date(config.startDate + 'T12:00:00');
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 12); // Look ahead 12 months for holidays

    getHolidays.forEach((name, dateStr) => {
      const holidayDate = new Date(dateStr + 'T12:00:00');
      if (holidayDate >= startDate && holidayDate <= endDate) {
        allDates.add(dateStr);
      }
    });

    return [...allDates].sort();
  }, [selectedDates, getHolidays, config.startDate]);

  const getAccrualDates = (startDate, endDate) => {
    const dates = [];
    let current = new Date(config.firstAccrualDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');

    while (current <= end) {
      if (current >= new Date(startDate + 'T12:00:00')) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 14);
    }
    return dates;
  };

  const getPTOBalanceAtDate = (targetDate) => {
    const target = new Date(targetDate + 'T12:00:00');
    const start = new Date(config.startDate + 'T12:00:00');

    if (target < start) return config.startingPTO;

    const accrualDates = getAccrualDates(config.startDate, targetDate);
    const totalAccrued = config.startingPTO + (accrualDates.length * config.accrualAmount);

    // Count all PTO used (selected dates + holidays)
    const usedPTO = getAllPTODates
      .filter(d => new Date(d + 'T12:00:00') <= target)
      .length * 8;

    return totalAccrued - usedPTO;
  };

  const wouldExceedBalance = (date) => {
    const dateObj = new Date(date + 'T12:00:00');
    const dayBefore = new Date(dateObj);
    dayBefore.setDate(dayBefore.getDate() - 1);

    let balance = getPTOBalanceAtDate(dayBefore.toISOString().split('T')[0]);

    const accrualDates = getAccrualDates(config.startDate, date);
    const hasAccrualOnDate = accrualDates.some(d =>
      d.toDateString() === dateObj.toDateString()
    );
    if (hasAccrualOnDate) {
      balance += config.accrualAmount;
    }

    if (selectedDates.includes(date) || isHoliday(date)) {
      balance += 8;
    }

    return balance < 8;
  };

  const toggleDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];

    // Don't allow toggling holidays - they're mandatory
    if (isHoliday(dateStr)) return;

    if (selectedDates.includes(dateStr)) {
      setSelectedDates(selectedDates.filter(d => d !== dateStr));
    } else {
      setSelectedDates([...selectedDates, dateStr].sort());
    }
  };

  const getCalendarDays = (monthDate) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();

    const days = [];

    for (let i = 0; i < startPadding; i++) {
      const date = new Date(year, month, -startPadding + i + 1);
      days.push({ date, isCurrentMonth: false });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      days.push({ date, isCurrentMonth: true });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false });
    }

    return days;
  };

  // Chart dimensions
  const chartHeight = 200;
  const padding = 20;

  // Calculate timeline date range (complete months)
  const timelineRange = useMemo(() => {
    const configDate = new Date(config.startDate + 'T12:00:00');
    // Start from the 1st of the config date's month
    const startDate = new Date(configDate.getFullYear(), configDate.getMonth(), 1);
    // End at the last day of the final month
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + timelineMonths, 0);
    return { startDate, endDate };
  }, [config.startDate, timelineMonths]);

  // Generate background segments and balance line data
  const { backgroundSegments, balancePoints, maxBalance, thresholdDates } = useMemo(() => {
    const { startDate, endDate } = timelineRange;
    const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);

    const accrualDates = getAccrualDates(config.startDate, endDate.toISOString().split('T')[0]);
    const sortedPTO = [...getAllPTODates].sort();

    // Track balance changes by date
    const balanceChanges = new Map();
    accrualDates.forEach(d => {
      const key = d.toISOString().split('T')[0];
      balanceChanges.set(key, (balanceChanges.get(key) || 0) + config.accrualAmount);
    });
    sortedPTO.forEach(d => {
      balanceChanges.set(d, (balanceChanges.get(d) || 0) - 8);
    });

    // Build balance points for the line
    const startDateStr = startDate.toISOString().split('T')[0];
    const configDateStr = config.startDate;

    // Calculate starting balance at the beginning of the timeline
    const startingBalance = getPTOBalanceAtDate(startDateStr);

    const allEventDates = [...new Set([
      startDateStr,
      ...accrualDates.map(d => d.toISOString().split('T')[0]),
      ...sortedPTO
    ])].filter(d => d >= startDateStr).sort();

    let balance = startingBalance;
    let maxBal = balance;
    const balancePoints = [{ date: startDateStr, balance, position: 0 }];

    allEventDates.forEach(dateStr => {
      if (dateStr === startDateStr) return;
      const change = balanceChanges.get(dateStr) || 0;
      balance += change;
      maxBal = Math.max(maxBal, balance);

      const dateObj = new Date(dateStr + 'T12:00:00');
      if (dateObj <= endDate) {
        const daysFromStart = (dateObj - startDate) / (1000 * 60 * 60 * 24);
        const position = (daysFromStart / totalDays) * 100;
        balancePoints.push({ date: dateStr, balance: Math.round(balance * 100) / 100, position });
      }
    });

    // Add end point if needed
    const endDateStr = endDate.toISOString().split('T')[0];
    if (balancePoints[balancePoints.length - 1]?.date !== endDateStr) {
      balancePoints.push({ date: endDateStr, balance, position: 100 });
    }

    // Helper function to check if a weekend day should be treated as PTO
    // (only if both adjacent Friday AND Monday are PTO)
    const isWeekendPTO = (dateObj) => {
      const day = dateObj.getDay();
      if (day === 6) { // Saturday
        const friday = new Date(dateObj);
        friday.setDate(friday.getDate() - 1);
        const monday = new Date(dateObj);
        monday.setDate(monday.getDate() + 2);
        const fridayStr = friday.toISOString().split('T')[0];
        const mondayStr = monday.toISOString().split('T')[0];
        return sortedPTO.includes(fridayStr) && sortedPTO.includes(mondayStr);
      } else if (day === 0) { // Sunday
        const friday = new Date(dateObj);
        friday.setDate(friday.getDate() - 2);
        const monday = new Date(dateObj);
        monday.setDate(monday.getDate() + 1);
        const fridayStr = friday.toISOString().split('T')[0];
        const mondayStr = monday.toISOString().split('T')[0];
        return sortedPTO.includes(fridayStr) && sortedPTO.includes(mondayStr);
      }
      return false;
    };

    // Build background segments (full height, behind the line)
    const segments = [];
    const thresholdDates = []; // Track dates when we cross into 40+ hours
    let currentDate = new Date(startDate);
    let segmentStart = new Date(startDate);
    let currentType = sortedPTO.includes(startDateStr) ? 'pto' : 'work';
    let currentBalance = startingBalance;
    let currentHasHighBalance = currentBalance >= 40;

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const day = currentDate.getDay();
      const isWeekend = day === 0 || day === 6;

      // Determine if this day is PTO
      // Weekdays: check if in PTO list
      // Weekends: only PTO if both adjacent Friday and Monday are PTO
      const isPTO = isWeekend ? isWeekendPTO(currentDate) : sortedPTO.includes(dateStr);

      const change = balanceChanges.get(dateStr) || 0;
      const prevBalance = currentBalance;
      if (change !== 0) currentBalance += change;

      const hasHighBalance = currentBalance >= 40;
      const crossedIntoHighBalance = !currentHasHighBalance && hasHighBalance && prevBalance < 40 && currentBalance >= 40;

      const newType = isPTO ? 'pto' : 'work';
      const balanceChanged = newType === 'work' && hasHighBalance !== currentHasHighBalance;

      if (newType !== currentType || balanceChanged) {
        // Close the previous segment
        if (segmentStart < currentDate) {
          const segStartDays = (segmentStart - startDate) / (1000 * 60 * 60 * 24);
          const segEndDays = (currentDate - startDate) / (1000 * 60 * 60 * 24);
          segments.push({
            type: currentType,
            highBalance: currentType === 'work' ? currentHasHighBalance : false,
            left: (segStartDays / totalDays) * 100,
            width: ((segEndDays - segStartDays) / totalDays) * 100
          });
        }

        // Track when we cross into 40+ hours (only on weekdays)
        if (crossedIntoHighBalance && newType === 'work' && !isWeekend) {
          const daysFromStart = (currentDate - startDate) / (1000 * 60 * 60 * 24);
          thresholdDates.push({
            date: new Date(currentDate),
            position: (daysFromStart / totalDays) * 100
          });
        }

        segmentStart = new Date(currentDate);
        currentType = newType;
        currentHasHighBalance = hasHighBalance;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Close final segment
    if (segmentStart < endDate) {
      const segStartDays = (segmentStart - startDate) / (1000 * 60 * 60 * 24);
      const segEndDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
      segments.push({
        type: currentType,
        highBalance: currentType === 'work' ? currentHasHighBalance : false,
        left: (segStartDays / totalDays) * 100,
        width: ((segEndDays - segStartDays) / totalDays) * 100
      });
    }

    return { backgroundSegments: segments, balancePoints, maxBalance: maxBal, thresholdDates };
  }, [config, getAllPTODates, timelineRange]);

  // Month markers
  const monthMarkers = useMemo(() => {
    const markers = [];
    const { startDate, endDate } = timelineRange;
    const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);

    let current = new Date(startDate);

    while (current <= endDate) {
      const daysFromStart = (current - startDate) / (1000 * 60 * 60 * 24);
      const position = (daysFromStart / totalDays) * 100;
      markers.push({
        position,
        label: current.toLocaleDateString('en-US', { month: 'short' })
      });
      current.setMonth(current.getMonth() + 1);
    }

    return markers;
  }, [timelineRange]);

  // Y-axis scale - range from -16 to maxBalance + 10
  const minBalance = -16;
  const yRange = (maxBalance + 10) - minBalance;
  const yScale = (chartHeight - padding * 2) / yRange;

  // Convert balance value to Y coordinate
  const balanceToY = (balance) => chartHeight - padding - ((balance - minBalance) * yScale);

  // Generate SVG path for balance line (smooth curve)
  const balancePath = useMemo(() => {
    if (balancePoints.length < 2) return '';

    // Simple smooth line connecting all points
    let path = '';
    balancePoints.forEach((point, i) => {
      const x = point.position;
      const y = balanceToY(point.balance);

      if (i === 0) {
        path = `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    });

    return path;
  }, [balancePoints, yScale]);

  // Y-axis labels
  const yAxisLabels = useMemo(() => {
    const labels = [];
    const step = maxBalance > 80 ? 40 : 20;
    for (let i = 0; i <= maxBalance + 10; i += step) {
      labels.push(i);
    }
    return labels;
  }, [maxBalance]);

  // Balance at the selected view date
  const viewDateBalance = getPTOBalanceAtDate(balanceViewDate);
  const isViewingToday = balanceViewDate === new Date().toISOString().split('T')[0];

  const formatMonth = (date) => date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const formatShortDate = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const isWeekend = (date) => date.getDay() === 0 || date.getDay() === 6;
  const isAccrualDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const accrualDates = getAccrualDates(config.startDate, dateStr);
    return accrualDates.some(d => d.toDateString() === date.toDateString());
  };
  const isSelected = (date) => selectedDates.includes(date.toISOString().split('T')[0]);
  const isPast = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <Clock className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">PTO Calculator</h1>
                <p className="text-gray-500">Plan your time off with confidence</p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-3 rounded-xl transition-colors ${showSettings ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {showSettings && (
            <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Starting PTO (hours)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.startingPTO}
                  onChange={(e) => setConfig({ ...config, startingPTO: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">As of Date</label>
                <input
                  type="date"
                  value={config.startDate}
                  onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Accrual Amount (hours)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.accrualAmount}
                  onChange={(e) => setConfig({ ...config, accrualAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Accrual Date</label>
                <input
                  type="date"
                  value={config.firstAccrualDate}
                  onChange={(e) => setConfig({ ...config, firstAccrualDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Current Balance with Date Picker */}
        <div className="bg-white rounded-xl shadow-lg p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">
                  Balance {isViewingToday ? 'Today' : `on ${formatShortDate(balanceViewDate)}`}
                </p>
                <p className="text-2xl font-bold text-gray-800">{viewDateBalance.toFixed(2)} hrs</p>
              </div>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowBalanceDatePicker(!showBalanceDatePicker)}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                <span>{isViewingToday ? 'Today' : formatShortDate(balanceViewDate)}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showBalanceDatePicker && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50 w-72">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={() => setBalanceDateMonth(new Date(balanceDateMonth.getFullYear(), balanceDateMonth.getMonth() - 1))}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      ←
                    </button>
                    <span className="text-sm font-medium">{formatMonth(balanceDateMonth)}</span>
                    <button
                      onClick={() => setBalanceDateMonth(new Date(balanceDateMonth.getFullYear(), balanceDateMonth.getMonth() + 1))}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      →
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                      <div key={i} className="text-center text-xs font-medium text-gray-400 py-1">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {getCalendarDays(balanceDateMonth).map(({ date, isCurrentMonth }, index) => {
                      const dateStr = date.toISOString().split('T')[0];
                      const isSelectedDate = dateStr === balanceViewDate;
                      const isToday = dateStr === new Date().toISOString().split('T')[0];

                      return (
                        <button
                          key={index}
                          onClick={() => {
                            setBalanceViewDate(dateStr);
                            setShowBalanceDatePicker(false);
                          }}
                          className={`
                            p-1.5 text-xs rounded transition-all
                            ${!isCurrentMonth ? 'text-gray-300' : 'hover:bg-gray-100'}
                            ${isSelectedDate ? 'bg-indigo-600 text-white hover:bg-indigo-700' : ''}
                            ${isToday && !isSelectedDate ? 'ring-1 ring-indigo-400' : ''}
                          `}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
                    <button
                      onClick={() => {
                        setBalanceViewDate(new Date().toISOString().split('T')[0]);
                        setShowBalanceDatePicker(false);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Reset to Today
                    </button>
                    <button
                      onClick={() => setShowBalanceDatePicker(false)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Unified Timeline Chart */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">PTO Timeline & Balance</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTimelineMonths(6)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${timelineMonths === 6 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                6 months
              </button>
              <button
                onClick={() => setTimelineMonths(12)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${timelineMonths === 12 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                12 months
              </button>
            </div>
          </div>

          <div className="relative">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 w-10 flex flex-col justify-between text-xs text-gray-500" style={{ height: chartHeight }}>
              {[...yAxisLabels].reverse().map((label) => (
                <span key={label} style={{ position: 'absolute', top: balanceToY(label) - 6 }}>
                  {label}h
                </span>
              ))}
            </div>

            {/* Chart area */}
            <div className="ml-12 relative">
              {/* Month labels above chart */}
              <div className="relative h-6 mb-1">
                {monthMarkers.map((marker, i) => (
                  <div
                    key={i}
                    className="absolute text-xs text-gray-500 transform -translate-x-1/2"
                    style={{ left: marker.position + '%' }}
                  >
                    {marker.label}
                  </div>
                ))}
              </div>

              {/* Main chart container */}
              <div className="relative rounded-lg overflow-hidden" style={{ height: chartHeight }}>
                {/* Background segments (full height) */}
                {backgroundSegments.map((segment, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0"
                    style={{
                      left: segment.left + '%',
                      width: Math.max(segment.width, 0.3) + '%',
                      backgroundColor: segment.type === 'pto'
                        ? COLORS.pto
                        : segment.highBalance
                          ? COLORS.workHighBalance
                          : COLORS.workLowBalance
                    }}
                  />
                ))}

                {/* Month divider lines */}
                {monthMarkers.map((marker, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-px"
                    style={{
                      left: marker.position + '%',
                      backgroundImage: 'linear-gradient(to bottom, #9ca3af 2px, transparent 2px)',
                      backgroundSize: '1px 6px'
                    }}
                  />
                ))}

                {/* SVG overlay for balance line */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 100 ${chartHeight}`}
                  preserveAspectRatio="none"
                >
                  {/* Balance line */}
                  <path
                    d={balancePath}
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>

                {/* 40+ hour threshold date labels */}
                {thresholdDates.map((threshold, i) => (
                  <div
                    key={i}
                    className="absolute bottom-1 text-white font-bold"
                    style={{ left: threshold.position + '%', fontSize: '10px' }}
                  >
                    {(threshold.date.getMonth() + 1).toString().padStart(2, '0')}/{threshold.date.getDate().toString().padStart(2, '0')}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.workLowBalance }} />
                  <span className="text-gray-600">Working (&lt;40 hrs available)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.workHighBalance }} />
                  <span className="text-gray-600">Working (40+ hrs - full week available)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.pto }} />
                  <span className="text-gray-600">PTO / Holiday</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 rounded bg-gray-400 border border-gray-300" />
                  <span className="text-gray-600">Balance (hours)</span>
                </div>
              </div>
            </div>
          </div>

          {balancePoints.some(p => p.balance < 0) && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              <span>Warning: Your planned PTO would result in a negative balance at some point.</span>
            </div>
          )}
        </div>

        {/* Collapsible Calendar */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <span className="font-medium text-gray-800">Select PTO Days</span>
            </div>
            {showCalendar ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showCalendar && (
            <div className="p-6 pt-0 border-t border-gray-100">
              <div className="flex items-center justify-between mb-6 mt-4">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ←
                </button>
                <h2 className="text-lg font-semibold text-gray-800">{formatMonth(currentMonth)}</h2>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  →
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {getCalendarDays(currentMonth).map(({ date, isCurrentMonth }, index) => {
                  const dateStr = date.toISOString().split('T')[0];
                  const selected = isSelected(date);
                  const weekend = isWeekend(date);
                  const accrual = isAccrualDate(date);
                  const past = isPast(date);
                  const exceeds = !selected && !isHoliday(dateStr) && wouldExceedBalance(dateStr);
                  const holiday = isHoliday(dateStr);
                  const holidayName = getHolidayName(dateStr);

                  return (
                    <button
                      key={index}
                      onClick={() => !weekend && !past && isCurrentMonth && !holiday && toggleDate(date)}
                      disabled={weekend || past || !isCurrentMonth || holiday}
                      title={holiday ? holidayName : undefined}
                      className={`
                        relative p-2 h-12 rounded-lg text-sm font-medium transition-all
                        ${!isCurrentMonth ? 'text-gray-300' : ''}
                        ${isCurrentMonth && !weekend && !past && !holiday ? 'hover:bg-gray-100' : ''}
                        ${weekend ? 'bg-gray-50 text-gray-400' : ''}
                        ${past && isCurrentMonth && !holiday ? 'text-gray-400' : ''}
                        ${selected ? 'bg-indigo-600 text-white hover:bg-indigo-700' : ''}
                        ${selected && exceeds ? 'bg-red-500 hover:bg-red-600' : ''}
                        ${!selected && exceeds && isCurrentMonth && !past && !weekend ? 'ring-2 ring-red-300' : ''}
                        ${accrual && isCurrentMonth && !selected && !holiday ? 'bg-green-50 ring-2 ring-green-400' : ''}
                        ${holiday && isCurrentMonth ? 'bg-blue-100 text-blue-700 cursor-default' : ''}
                      `}
                    >
                      {date.getDate()}
                      {accrual && isCurrentMonth && !holiday && (
                        <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${selected ? 'bg-white' : 'bg-green-500'}`} />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-50 ring-2 ring-green-400" />
                  <span className="text-gray-600">Accrual day (+{config.accrualAmount} hrs)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-indigo-600" />
                  <span className="text-gray-600">Selected PTO</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-100" />
                  <span className="text-gray-600">Mandatory Holiday</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded ring-2 ring-red-300" />
                  <span className="text-gray-600">Would exceed balance</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Days Planned */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-800">Days Planned</p>
              <p className="text-sm text-gray-500">{selectedDates.length} days ({selectedDates.length * 8} hours) + holidays</p>
            </div>
          </div>

          {selectedDates.length === 0 ? (
            <p className="text-gray-500 text-sm">No additional PTO days selected. Mandatory holidays are already accounted for.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedDates.map(dateStr => {
                const date = new Date(dateStr + 'T12:00:00');
                const balanceAfter = getPTOBalanceAtDate(dateStr);
                const isNegative = balanceAfter < 0;

                return (
                  <div
                    key={dateStr}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${isNegative ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}
                  >
                    {isNegative && <AlertTriangle className="w-3 h-3" />}
                    <span>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <button
                      onClick={() => setSelectedDates(selectedDates.filter(d => d !== dateStr))}
                      className="hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
