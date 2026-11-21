import React from 'react';
import { formatDateTime } from '../utils/formatters';
import { Clock, User, CheckCircle2, ArrowRight } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function ActivityTimeline({ activities = [] }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="py-8 text-center text-slate-400 text-sm">
        No recorded activity yet.
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {activities.map((act, idx) => {
          const isLast = idx === activities.length - 1;
          return (
            <li key={act.id || idx}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex space-x-3">
                  <div>
                    <span className="h-8 w-8 rounded-full bg-amber-500/10 border border-amber-300 flex items-center justify-center text-amber-600 ring-4 ring-white">
                      <Clock className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className="font-medium text-slate-700 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {act.actor_name || 'System'}
                        {act.actor_role && (
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200">
                            {act.actor_role}
                          </span>
                        )}
                      </span>
                      <time dateTime={act.created_at}>
                        {formatDateTime(act.created_at)}
                      </time>
                    </div>

                    {act.to_status && (
                      <div className="flex items-center gap-2 mb-1.5">
                        {act.from_status && (
                          <>
                            <StatusBadge status={act.from_status} size="sm" />
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                          </>
                        )}
                        <StatusBadge status={act.to_status} size="sm" />
                      </div>
                    )}

                    <p className="text-sm text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 leading-relaxed">
                      {act.notes}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
