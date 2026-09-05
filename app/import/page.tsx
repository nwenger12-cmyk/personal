'use client';

import Link from 'next/link';
import { useData } from '@/components/DataProvider';
import { ImportCenter } from '@/components/ImportCenter';
import { Button, EmptyState, Note } from '@/components/ui';

export default function ImportPage() {
  const { data, ready } = useData();

  if (!ready) return <p className="text-sm text-dim">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Import</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          The whole monthly job in one step. Statements feed spending, bonus
          progress, and annual fee records at the same time, because all three
          are read off the same transactions.
        </p>
      </div>

      {data.cards.length === 0 ? (
        <EmptyState
          title="Add a card first"
          description="Files are matched to cards by account number, and bonus progress and annual fees need to know which card a transaction belongs to."
          action={
            <Link href="/cards">
              <Button variant="primary">Go to cards</Button>
            </Link>
          }
        />
      ) : (
        <>
          <ImportCenter />
          <Note>
            Statement CSVs are the closest thing to a connection that does not
            involve handing over a card login. Aggregators can read transactions
            but not fee schedules, bonus terms, or points balances; the services
            that show points balances do it by signing in as you. So this is the
            one manual step, and everything else follows from it — the only
            figure that still has to be typed is a points balance.
          </Note>
        </>
      )}
    </div>
  );
}
