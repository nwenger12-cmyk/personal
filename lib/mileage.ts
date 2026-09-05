import { toUtcMs } from './dates';
import type { IsoDate } from './dates';
import type { Entity, MileageTrip } from './types';

/**
 * The mileage deduction.
 *
 * The standard mileage rate is per mile driven for business, and the rate is
 * set by the IRS and changes every year -- so it is a setting rather than a
 * constant here, and it needs confirming before filing. The log matters as
 * much as the total: the substantiation rules want the date, the miles and the
 * business purpose recorded at the time, and a mileage claim without that is
 * the classic audit loss. That is why `purpose` is a field and not a nicety.
 *
 * You take the standard rate OR actual vehicle costs, never both. Anything
 * logged here is the standard-rate route, so a card-and-truck expense for fuel
 * and this log are alternatives, not additions.
 */

export function tripDeductionCents(trip: MileageTrip, rateCents: number): number {
  return Math.round(trip.miles * rateCents);
}

export function tripsForYear(trips: MileageTrip[], year: number): MileageTrip[] {
  return trips
    .filter((trip) => Number(trip.date.slice(0, 4)) === year)
    .sort((a, b) => toUtcMs(b.date) - toUtcMs(a.date));
}

export type MileageSummary = {
  entityId: string;
  entityName: string;
  miles: number;
  deductionCents: number;
  tripCount: number;
  /** Trips with no business purpose recorded -- the substantiation gap. */
  missingPurpose: number;
};

export function mileageByEntity(
  trips: MileageTrip[],
  entities: Entity[],
  year: number,
  rateCents: number,
): MileageSummary[] {
  const inYear = tripsForYear(trips, year);
  return entities
    .map((entity): MileageSummary => {
      const mine = inYear.filter((t) => t.entityId === entity.id);
      return {
        entityId: entity.id,
        entityName: entity.name,
        miles: mine.reduce((sum, t) => sum + t.miles, 0),
        // Personal driving is not deductible, same rule as personal expenses.
        deductionCents:
          entity.kind === 'personal'
            ? 0
            : mine.reduce((sum, t) => sum + tripDeductionCents(t, rateCents), 0),
        tripCount: mine.length,
        missingPurpose: mine.filter((t) => t.purpose.trim() === '').length,
      };
    })
    .filter((s) => s.tripCount > 0);
}

export function totalMileageDeductionCents(
  trips: MileageTrip[],
  entities: Entity[],
  year: number,
  rateCents: number,
): number {
  return mileageByEntity(trips, entities, year, rateCents).reduce(
    (sum, s) => sum + s.deductionCents,
    0,
  );
}

export function blankTrip(entityId: string, date: IsoDate): MileageTrip {
  return { id: '', date, miles: 0, purpose: '', route: '', entityId };
}
