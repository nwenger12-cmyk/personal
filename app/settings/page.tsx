'use client';

import { useRef, useState } from 'react';
import { useData } from '@/components/DataProvider';
import { EntitySettings } from '@/components/EntitySettings';
import { Button, Checkbox, Field, Note, Panel, PanelHeader, Select, TextInput } from '@/components/ui';
import { formatCpp, parseIntegerInput } from '@/lib/money';
import { PROGRAMS, centsPerPoint, valuationKey } from '@/lib/programs';
import { sampleData } from '@/lib/sample';
import { exportJson, importJson } from '@/lib/storage';
import type { ThemePreference } from '@/lib/types';

export default function SettingsPage() {
  const { data, ready, updateSettings, setValuation, replaceAll, resetAll } = useData();
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ready) return <p className="text-sm text-dim">Loading settings...</p>;

  function download() {
    const blob = new Blob([exportJson(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `card-hub-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImport(file: File) {
    setImportMessage(null);
    setImportError(null);
    file
      .text()
      .then((text) => {
        const result = importJson(text);
        if (!result.ok) {
          setImportError(result.error);
          return;
        }
        replaceAll(result.data);
        setImportMessage(
          `Loaded ${result.cardCount} ${result.cardCount === 1 ? 'card' : 'cards'}. ` +
            'This replaced what was here before.',
        );
      })
      .catch(() => setImportError('Could not read that file.'));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Settings</h1>
      </div>

      <Panel className="space-y-4">
        <PanelHeader
          title="Appearance"
          description="System follows your OS. An explicit choice sticks in this browser."
        />
        <div className="w-56">
          <Field label="Theme">
            <Select
              value={data.settings.theme}
              onChange={(e) => updateSettings({ theme: e.target.value as ThemePreference })}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel className="space-y-4">
        <PanelHeader
          title="Warning windows"
          description="How far ahead things start showing as urgent."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Flag an annual fee this many days ahead"
            hint="Long enough to call and downgrade before the charge posts. 45 days clears a statement cycle with room to spare."
          >
            <TextInput
              mono
              inputMode="numeric"
              value={String(data.settings.feeReviewLeadDays)}
              onChange={(e) => {
                const value = parseIntegerInput(e.target.value);
                if (value !== null && value > 0) updateSettings({ feeReviewLeadDays: value });
              }}
            />
          </Field>
          <Field
            label="Flag a bonus deadline this many days ahead"
            hint="Bonuses inside this window are shown as at risk regardless of pace."
          >
            <TextInput
              mono
              inputMode="numeric"
              value={String(data.settings.bonusWarnDays)}
              onChange={(e) => {
                const value = parseIntegerInput(e.target.value);
                if (value !== null && value > 0) updateSettings({ bonusWarnDays: value });
              }}
            />
          </Field>
        </div>
      </Panel>

      <EntitySettings />

      <Panel className="space-y-4">
        <PanelHeader
          title="What a point is worth"
          description="Used for the dollar values on the Points tab. Change any rate to the number you actually get; blank it to go back to the default."
        />
        <div className="space-y-5">
          {PROGRAMS.filter((p) => p.unit !== 'cash').map((program) => (
            <div key={program.id}>
              <h3 className="text-sm font-medium text-text">{program.name}</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {program.redemptions.map((redemption) => {
                  const key = valuationKey(program.id, redemption.id);
                  const override = data.valuationOverrides[key];
                  const effective = centsPerPoint(program, redemption, data.valuationOverrides);
                  return (
                    <Field
                      key={key}
                      label={redemption.label}
                      hint={
                        override === undefined
                          ? `Default ${formatCpp(redemption.centsPerPoint)}${
                              redemption.fixed ? ' (published rate)' : ' (estimate)'
                            }`
                          : `Overridden from ${formatCpp(redemption.centsPerPoint)}`
                      }
                    >
                      <TextInput
                        mono
                        inputMode="decimal"
                        placeholder={String(redemption.centsPerPoint)}
                        value={override === undefined ? '' : String(override)}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          if (raw === '') {
                            setValuation(key, null);
                            return;
                          }
                          const value = Number(raw.replace(/[^\d.]/g, ''));
                          if (Number.isFinite(value) && value >= 0) setValuation(key, value);
                        }}
                        aria-label={`${program.name} ${redemption.label} cents per point, currently ${formatCpp(effective)}`}
                      />
                    </Field>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="space-y-4">
        <PanelHeader
          title="Your data"
          description="Everything lives in this browser under one key and is never sent anywhere. That also means clearing site data deletes it, and it does not follow you to another device -- so export a copy."
        />

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={download}>
            Export JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
              e.target.value = '';
            }}
          />
          <Button onClick={() => fileRef.current?.click()}>Import JSON</Button>
          <Button onClick={() => replaceAll(sampleData())}>Load sample data</Button>
        </div>

        {importMessage ? <Note>{importMessage}</Note> : null}
        {importError ? (
          <p className="text-sm text-danger-ink">{importError}</p>
        ) : null}

        <div className="border-t border-line pt-4">
          {confirmReset ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">
                Delete all {data.cards.length} cards and every balance? Export first if
                you want them back.
              </span>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  resetAll();
                  setConfirmReset(false);
                  setImportMessage('Cleared.');
                }}
              >
                Delete everything
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
              Clear all data
            </Button>
          )}
        </div>
      </Panel>
    </div>
  );
}
