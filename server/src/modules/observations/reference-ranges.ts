// Demo thresholds for illustrating the pipeline. Not clinical guidance.

export interface Range {
  label: string;
  unit: string;
  low: number;
  high: number;
  criticalLow?: number;
  criticalHigh?: number;
}

export type Severity = 'info' | 'warning' | 'critical';
export type Flag = 'normal' | 'low' | 'high' | 'critically low' | 'critically high';

export const VITAL_SIGNS = {
  spo2: { label: 'SpO2', unit: '%', low: 94, high: 100, criticalLow: 90 },
  heartRate: { label: 'Heart rate', unit: 'bpm', low: 50, high: 110, criticalLow: 40, criticalHigh: 130 },
  respiratoryRate: { label: 'Resp. rate', unit: '/min', low: 12, high: 20, criticalLow: 8, criticalHigh: 25 },
  temperature: { label: 'Temperature', unit: '°C', low: 36, high: 38, criticalLow: 35, criticalHigh: 39.5 },
  systolicBp: { label: 'Systolic BP', unit: 'mmHg', low: 100, high: 160, criticalLow: 90, criticalHigh: 200 },
} as const satisfies Record<string, Range>;

export const LAB_TESTS = {
  potassium: { label: 'Potassium', unit: 'mmol/L', low: 3.5, high: 5.0, criticalLow: 2.5, criticalHigh: 6.0 },
  sodium: { label: 'Sodium', unit: 'mmol/L', low: 135, high: 145, criticalLow: 120, criticalHigh: 160 },
  glucose: { label: 'Glucose', unit: 'mmol/L', low: 3.9, high: 7.8, criticalLow: 2.8, criticalHigh: 22 },
  hemoglobin: { label: 'Haemoglobin', unit: 'g/dL', low: 12, high: 17, criticalLow: 7, criticalHigh: 20 },
  creatinine: { label: 'Creatinine', unit: 'µmol/L', low: 60, high: 110, criticalHigh: 350 },
} as const satisfies Record<string, Range>;

export type VitalSign = keyof typeof VITAL_SIGNS;
export type LabTest = keyof typeof LAB_TESTS;

/** One rule for every measurement: critical bounds first, then the normal range. */
export function assess(value: number, range: Range): { flag: Flag; severity: Severity } {
  if (range.criticalLow !== undefined && value < range.criticalLow) return { flag: 'critically low', severity: 'critical' };
  if (range.criticalHigh !== undefined && value > range.criticalHigh) return { flag: 'critically high', severity: 'critical' };
  if (value < range.low) return { flag: 'low', severity: 'warning' };
  if (value > range.high) return { flag: 'high', severity: 'warning' };
  return { flag: 'normal', severity: 'info' };
}

const RANK: Record<Severity, number> = { info: 0, warning: 1, critical: 2 };

export function worstSeverity(severities: Severity[]): Severity {
  return severities.reduce<Severity>((worst, s) => (RANK[s] > RANK[worst] ? s : worst), 'info');
}

export function formatReading(value: number, range: Range, flag: Flag) {
  const reading = `${value} ${range.unit}`;
  return flag === 'normal' ? reading : `${reading} (${flag})`;
}
