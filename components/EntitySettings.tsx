'use client';

import { useState } from 'react';
import { useData } from './DataProvider';
import { Badge, Button, Field, Note, Panel, PanelHeader, Select, TextInput } from './ui';
import { getCategory } from '@/lib/categories';
import { CATEGORY_GROUP_LABELS, categoriesByGroup } from '@/lib/categories';
import { newId } from '@/lib/storage';
import { blankEntity } from '@/lib/storage';
import type { Entity } from '@/lib/types';

/**
 * Entities and merchant rules, both edited in place.
 *
 * Entities are the reason the tax summary is usable with more than one
 * business, so they are user-defined rather than a fixed list -- name them
 * after whatever actually files a return.
 */
export function EntitySettings() {
  const { data, upsertEntity, removeEntity, addRule, removeRule, updateSettings } = useData();
  const [draft, setDraft] = useState<Entity | null>(null);
  const [ruleMatch, setRuleMatch] = useState('');
  const [ruleCategory, setRuleCategory] = useState('software');
  const [ruleEntity, setRuleEntity] = useState('');

  return (
    <>
      <Panel className="space-y-4">
        <PanelHeader
          title="Entities"
          description="What expenses get attributed to. Each business files its own Schedule C, so each gets its own set of totals; personal is kept separate and never folded into a business return."
          action={
            draft ? undefined : (
              <Button size="sm" onClick={() => setDraft(blankEntity())}>
                Add entity
              </Button>
            )
          }
        />

        <ul className="divide-y divide-line border-y border-line">
          {data.entities.map((entity) => (
            <li key={entity.id} className="py-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
                <Field label="Name">
                  <TextInput
                    value={entity.name}
                    onChange={(e) => upsertEntity({ ...entity, name: e.target.value })}
                  />
                </Field>
                <Field label="Type">
                  <Select
                    value={entity.kind}
                    onChange={(e) =>
                      upsertEntity({
                        ...entity,
                        kind: e.target.value as Entity['kind'],
                      })
                    }
                  >
                    <option value="business">Business</option>
                    <option value="personal">Personal</option>
                  </Select>
                </Field>
                <div className="flex items-center gap-2 pb-1">
                  {data.settings.defaultEntityId === entity.id ? (
                    <Badge tone="accent">Default</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateSettings({ defaultEntityId: entity.id })}
                    >
                      Make default
                    </Button>
                  )}
                  {data.entities.length > 1 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeEntity(entity.id)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="mt-2">
                <Field label="Notes" hint="EIN, which form it files on, anything the summary should carry.">
                  <TextInput
                    value={entity.notes}
                    onChange={(e) => upsertEntity({ ...entity, notes: e.target.value })}
                    placeholder="Sole proprietor — Schedule C"
                  />
                </Field>
              </div>
            </li>
          ))}
        </ul>

        {data.entities.length > 1 ? (
          <Note>
            Removing an entity moves its expenses to the first remaining entity
            rather than deleting them.
          </Note>
        ) : null}

        {draft ? (
          <div className="space-y-3 rounded-xl border border-line bg-surface-2 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <TextInput
                  autoFocus
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Second business"
                />
              </Field>
              <Field label="Type">
                <Select
                  value={draft.kind}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value as Entity['kind'] })}
                >
                  <option value="business">Business</option>
                  <option value="personal">Personal</option>
                </Select>
              </Field>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={!draft.name.trim()}
                onClick={() => {
                  upsertEntity({ ...draft, name: draft.name.trim() });
                  setDraft(null);
                }}
              >
                Add entity
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel className="space-y-4">
        <PanelHeader
          title="Merchant rules"
          description="A substring of the merchant text files an imported transaction automatically. Yours are tried before the built-in set, newest first, so a rule here overrides a shipped one for the same merchant."
        />

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:items-end">
          <Field label="When the merchant contains">
            <TextInput
              value={ruleMatch}
              onChange={(e) => setRuleMatch(e.target.value)}
              placeholder="lowes"
            />
          </Field>
          <Field label="File it as">
            <Select value={ruleCategory} onChange={(e) => setRuleCategory(e.target.value)}>
              {categoriesByGroup().map(({ group, categories }) => (
                <optgroup key={group} label={CATEGORY_GROUP_LABELS[group]}>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Entity" hint="Optional.">
            <Select value={ruleEntity} onChange={(e) => setRuleEntity(e.target.value)}>
              <option value="">Leave as imported</option>
              {data.entities.map((entity) => (
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
              disabled={!ruleMatch.trim()}
              onClick={() => {
                addRule({
                  id: newId(),
                  match: ruleMatch.trim(),
                  categoryId: ruleCategory,
                  entityId: ruleEntity || null,
                  deductiblePercent: null,
                  builtIn: false,
                });
                setRuleMatch('');
                setRuleEntity('');
              }}
            >
              Add rule
            </Button>
          </div>
        </div>

        {data.categorizationRules.length === 0 ? (
          <p className="text-sm text-dim">
            No rules of your own yet. The built-in set already covers Adobe, AWS,
            Cloudflare, B&amp;H, Lensrentals, the airlines and the usual
            subscriptions.
          </p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {data.categorizationRules
              .slice()
              .reverse()
              .map((rule) => (
                <li
                  key={rule.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5"
                >
                  <span className="min-w-0 text-sm">
                    <span className="font-mono text-text">{rule.match}</span>
                    <span className="text-dim"> → </span>
                    <span className="text-muted">
                      {getCategory(rule.categoryId)?.label ?? 'Unknown'}
                    </span>
                    {rule.entityId ? (
                      <span className="text-dim">
                        {' '}
                        · {data.entities.find((e) => e.id === rule.entityId)?.name ?? '—'}
                      </span>
                    ) : null}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => removeRule(rule.id)}>
                    Remove
                  </Button>
                </li>
              ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
