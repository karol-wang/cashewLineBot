import dayjs, { ConfigType, Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isoWeek from 'dayjs/plugin/isoWeek';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(isoWeek);

export const APP_TIMEZONE = 'Asia/Taipei';

/** 將指定時間點轉換為系統時區；未指定時使用現在時間。 */
export const datetime = (value?: ConfigType): Dayjs => dayjs(value).tz(APP_TIMEZONE);

/**
 * 以指定時間點在系統時區中的年份解析 MMDD，避免跨年時使用到伺服器年份。
 */
export const parseMonthDay = (value: string, referenceTime?: ConfigType): string | undefined => {
  const year = datetime(referenceTime).year();
  const parsed = dayjs(`${year}${value}`, 'YYYYMMDD', true);

  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
};

export type DateTimeInput = ConfigType;

export default datetime;
