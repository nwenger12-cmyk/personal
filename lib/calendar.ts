import { addDays, today, toUtcMs } from './dates';
import type { IsoDate } from './dates';
import { activeBonuses } from './bonuses';
import { bonusEligibility } from './eligibility';
import { upcomingFees } from './fees';
import { expiringPerks, nextPerkDeadline, periodLabel, periodKey } from './perks';
import { formatCents } from './money';
import type { AppData } from './types';

/**
 * Everything with a date, as a calendar file.
 *
 * This is the honest answer to "can it remind me". Push notifications need a
 * server, an account and a device token; a .ics file needs none of those and
 * lands in the calendar you already look at every morning. Import it once a
 * quarter, or after any import that moves a date.
 *
 * Events are all-day and carry a one-day alarm, which is the right shape for
 * "an annual fee posts on the 12th" -- there is no time of day to be precise
 * about.
 */

export type CalendarEvent = {
  uid: string;
  date: IsoDate;
  title: string;
  description: string;
};

function stamp(iso: IsoDate): string {
  return iso.replace(/-/g, '');
}

/** Escapes the characters that would otherwise break an ICS line. */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** ICS lines are capped at 75 octets and continue with a leading space. */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 72) {
    parts.push(` ${rest.slice(0, 72)}`);
    rest = rest.slice(72);
  }
  if (rest.length > 0) parts.push(` ${rest}`);
  return parts.join('\r\n');
}

export function buildCalendarEvents(
  data: AppData,
  now: IsoDate = today(),
  horizonDays = 400,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const horizon = toUtcMs(addDays(now, horizonDays));

  for (const fee of upcomingFees(data.cards, data.settings.feeReviewLeadDays, 24, now)) {
    if (toUtcMs(fee.date) > horizon) continue;
    const reviewBy = addDays(fee.date, -data.settings.feeReviewLeadDays);
    events.push({
      uid: `fee-${fee.cardId}-${fee.date}`,
      date: fee.date,
      title: `${fee.cardLabel} — ${formatCents(fee.amountCents)} annual fee`,
      description: `Year ${fee.anniversaryNumber}. Decide keep, downgrade or cancel before this posts.`,
    });
    // The decision date is the one that is actionable, so it gets its own entry.
    if (toUtcMs(reviewBy) >= toUtcMs(now)) {
      events.push({
        uid: `fee-review-${fee.cardId}-${fee.date}`,
        date: reviewBy,
        title: `Review ${fee.cardLabel} before its fee posts`,
        description: `${formatCents(fee.amountCents)} posts around ${fee.date}.`,
      });
    }
  }

  for (const tracked of activeBonuses(data.cards, data.settings.bonusWarnDays, now, data.expenses)) {
    if (tracked.outlook.windowClosed) continue;
    if (toUtcMs(tracked.outlook.deadline) > horizon) continue;
    events.push({
      uid: `bonus-${tracked.card.id}`,
      date: tracked.outlook.deadline,
      title: `${tracked.label} — bonus spend deadline`,
      description:
        tracked.outlook.remainingCents === 0
          ? 'Requirement met. Mark it earned.'
          : `${formatCents(tracked.outlook.remainingCents)} of spend still needed.`,
    });
  }

  for (const status of expiringPerks(data.cards, 3650, now)) {
    if (status.used) continue;
    const date = nextPerkDeadline(status.perk, now);
    if (toUtcMs(date) > horizon) continue;
    events.push({
      uid: `perk-${status.card.id}-${status.perk.id}-${periodKey(status.perk.period, now)}`,
      date,
      title: `Use ${status.perk.label} — ${status.cardLabel}`,
      description: `${formatCents(status.valueCents)} for ${periodLabel(
        status.perk.period,
        status.key,
      )}. Unused credit does not roll over.`,
    });
  }

  for (const status of bonusEligibility(data.cards, now)) {
    if (!status.eligibleFrom || status.eligible) continue;
    if (toUtcMs(status.eligibleFrom) > horizon) continue;
    events.push({
      uid: `eligible-${status.rule.id}`,
      date: status.eligibleFrom,
      title: `Bonus-eligible again: ${status.rule.label}`,
      description: status.rule.note,
    });
  }

  return events.sort((a, b) => toUtcMs(a.date) - toUtcMs(b.date));
}

export function toIcs(events: CalendarEvent[], now: Date = new Date()): string {
  const created = `${now.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Card Hub//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Card Hub',
  ];

  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}@card-hub.local`,
      `DTSTAMP:${created}`,
      `DTSTART;VALUE=DATE:${stamp(event.date)}`,
      // An all-day event's DTEND is exclusive, so it is the following day.
      `DTEND;VALUE=DATE:${stamp(addDays(event.date, 1))}`,
      fold(`SUMMARY:${escapeText(event.title)}`),
      fold(`DESCRIPTION:${escapeText(event.description)}`),
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      fold(`DESCRIPTION:${escapeText(event.title)}`),
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  // RFC 5545 requires CRLF.
  return `${lines.join('\r\n')}\r\n`;
}
