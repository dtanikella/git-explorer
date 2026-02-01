// Date helper utilities for git treemap feature
import { TimeRangePreset, TimeRangeConfig } from '../git/types';

const PRESET_LABELS: Record<TimeRangePreset, string> = {
  '2w': 'Last 2 weeks',
  '1m': 'Last Month',
  '3m': 'Last Quarter',
  '6m': 'Last 6 Months',
  '1y': 'Last Year',
};

export function createTimeRangeConfig(preset: TimeRangePreset): TimeRangeConfig {
  const endDate = new Date();
  const startDate = new Date();
  switch (preset) {
    case '2w': startDate.setDate(endDate.getDate() - 14); break;
    case '1m': startDate.setMonth(endDate.getMonth() - 1); break;
    case '3m': startDate.setMonth(endDate.getMonth() - 3); break;
    case '6m': startDate.setMonth(endDate.getMonth() - 6); break;
    case '1y': startDate.setFullYear(endDate.getFullYear() - 1); break;
  }
  const midpoint = new Date((startDate.getTime() + endDate.getTime()) / 2);
  return {
    startDate,
    endDate,
    midpoint,
    label: PRESET_LABELS[preset],
    preset,
  };
}
