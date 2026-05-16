export const AD_FREQUENCY = 8;

const PERIOD = AD_FREQUENCY + 1;

export function isAdRow(rowIndex: number): boolean {
  return (rowIndex + 1) % PERIOD === 0;
}

export function dataIndexForRow(rowIndex: number): number {
  const adsAtOrBefore = Math.floor((rowIndex + 1) / PERIOD);
  const adsBefore = isAdRow(rowIndex) ? adsAtOrBefore - 1 : adsAtOrBefore;
  return rowIndex - adsBefore;
}

export function adIndexForRow(rowIndex: number): number {
  return Math.floor((rowIndex + 1) / PERIOD);
}

export function totalRowsWithAds(
  contentLength: number,
  hasNextPage: boolean,
): number {
  const contentRows = contentLength + Math.floor(contentLength / AD_FREQUENCY);
  return hasNextPage ? contentRows + 1 : contentRows;
}
