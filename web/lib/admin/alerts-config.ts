export const ALERT_THRESHOLDS = {
  push: {
    failureCountWarn: 5,
    failureCountCritical: 20,
    failureRateWarn: 0.2,
    failureRateCritical: 0.5,
    unavailableCountWarn: 5,
    unavailableCountCritical: 15,
    zeroSubscriptionsWarnHours: 24,
  },
  throttle: {
    warnCountLastHour: 40,
    criticalCountLast15m: 25,
  },
  dataQuality: {
    missingPhotosWarn: 25,
    missingCountryCodeInfo: 50,
    missingDepositCurrencyInfo: 25,
    missingSizeInfo: 25,
    missingListingTypeInfo: 50,
  },
} as const;

export const ALERT_WINDOWS = {
  last15mMs: 15 * 60 * 1000,
  lastHourMs: 60 * 60 * 1000,
  last24hMs: 24 * 60 * 60 * 1000,
};
