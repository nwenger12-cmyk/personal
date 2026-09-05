'use client';

import { useState } from 'react';
import { formatDate, today } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { mileageByEntity, tripDeductionCents, tripsForYear } from '@/lib/mileage';
import { newId } from '@/lib/storage';
import type { Entity, MileageTrip } from '@/lib/types';
import { Badge, Button, Field, Note, Panel, PanelHeader, Select, TextInput } from './ui';

/**
 * The mileage log.
 *
 * `purpose` is a required-feeling field on purpose: the substantiation rules
 * want the business purpose recorded at the time, and a mileage claim without
 * one is the classic audit loss. Trips missing it are flagged rather than
 * silently totalled.
 */
export function MileageLog({
  trips,
  entities,
  year,
  rateCents,
  onAdd,
  onRemove,
}: {
  trips: MileageTrip[];
  entities: Entity[];
  year: number;
  rateCents: number;
  onAdd: (trip: MileageTrip) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState<MileageTrip>({
    id: '',
    date: today(),
    miles: 0,
    purpose: '',
    route: '',
    entityId: entities[0]?.id ?? '',
  });
  const [milesDraft, setMilesDraft] = useState('');

  const inYear = tripsForYear(trips, year);
  const byEntity = mileageByEntity(trips, entities, year, rateCents);
  const totalDeduction = byEntity.reduce((sum, s) => sum + s.deductionCents, 0);
  const missingPurpose = byEntity.reduce((sum, s) => sum + s.missingPurpose, 0);
  const miles = Number(milesDraft.replace(/[^\d.]/g, ''));
  const canAdd = Number.isFinite(miles) && miles > 0 && draft.entityId !== '';

  return (
    <Panel className="space-y-5">
      <PanelHeader
        title={`Mileage · ${year}`}
        description="Business miles at the standard rate. You take this or actual vehicle costs — never both."
        action={
          <span className="text-right">
            <span className="block font-mono text-xl font-semibold text-text">
              {formatCents(totalDeduction)}
            </span>
            <span className="block font-mono text-xs text-dim">
              {byEntity.reduce((s, e) => s + e.miles, 0).toLocaleString('en-US')} mi at{' '}
              {(rateCents / 100).toFixed(2)}¢
            </span>
          </span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
        <Field label="Date">
          <TextInput
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          />
        </Field>
        <Field label="Miles">
          <TextInput
            mono
            inputMode="decimal"
            value={milesDraft}
            onChange={(e) => setMilesDraft(e.target.value)}
            placeholder="214"
          />
        </Field>
        <Field label="Business purpose">
          <TextInput
            value={draft.purpose}
            onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}
            placeholder="Location scout — Moab shoot"
          />
        </Field>
        <Field label="Entity">
          <Select
            value={draft.entityId}
            onChange={(e) => setDraft({ ...draft, entityId: e.target.value })}
          >
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="pb-1">
          <Button
            variant="primary"
            size="sm"
            disabled={!canAdd}
            onClick={() => {
              onAdd({ ...draft, id: newId(), miles });
              setMilesDraft('');
              setDraft({ ...draft, purpose: '', route: '' });
            }}
          >
            Log trip
          </Button>
        </div>
      </div>

      {missingPurpose > 0 ? (
        <Note>
          {missingPurpose} {missingPurpose === 1 ? 'trip has' : 'trips have'} no business
          purpose recorded. The substantiation rules want date, miles and purpose — a
          mileage claim without them is the usual reason one gets disallowed.
        </Note>
      ) : null}

      {inYear.length === 0 ? (
        <p className="text-sm text-dim">No trips logged for {year}.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {inYear.map((trip) => {
            const entity = entities.find((e) => e.id === trip.entityId);
            return (
              <li
                key={trip.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-dim">{formatDate(trip.date)}</span>
                    <span className="text-sm text-text">
                      {trip.purpose || 'No purpose recorded'}
                    </span>
                    {trip.purpose.trim() === '' ? <Badge tone="warn">Needs purpose</Badge> : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-dim">
                    {entity?.name ?? 'Unassigned'}
                    {trip.route ? ` · ${trip.route}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm text-text">
                    {trip.miles.toLocaleString('en-US')} mi
                  </span>
                  <span className="font-mono text-xs text-dim">
                    {entity?.kind === 'personal'
                      ? '--'
                      : formatCents(tripDeductionCents(trip, rateCents))}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => onRemove(trip.id)}>
                    Remove
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
