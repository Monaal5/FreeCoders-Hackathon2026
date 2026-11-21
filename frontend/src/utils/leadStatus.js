// Lead Status State Machine definition according to specification:
// NEW → QUALIFIED → SURVEY_SCHEDULED → SURVEY_SUBMITTED → SURVEY_APPROVED → QUOTED → WON
//                                        └─ survey rejected → back to QUALIFIED
// any open status → LOST

export const LEAD_STATUS = {
  NEW: 'NEW',
  QUALIFIED: 'QUALIFIED',
  SURVEY_SCHEDULED: 'SURVEY_SCHEDULED',
  SURVEY_SUBMITTED: 'SURVEY_SUBMITTED',
  SURVEY_APPROVED: 'SURVEY_APPROVED',
  QUOTED: 'QUOTED',
  WON: 'WON',
  LOST: 'LOST',
};

export const ALLOWED_TRANSITIONS = {
  [LEAD_STATUS.NEW]: [LEAD_STATUS.QUALIFIED, LEAD_STATUS.LOST],
  [LEAD_STATUS.QUALIFIED]: [LEAD_STATUS.SURVEY_SCHEDULED, LEAD_STATUS.LOST],
  [LEAD_STATUS.SURVEY_SCHEDULED]: [LEAD_STATUS.SURVEY_SUBMITTED, LEAD_STATUS.LOST],
  [LEAD_STATUS.SURVEY_SUBMITTED]: [LEAD_STATUS.SURVEY_APPROVED, LEAD_STATUS.QUALIFIED, LEAD_STATUS.LOST],
  [LEAD_STATUS.SURVEY_APPROVED]: [LEAD_STATUS.QUOTED, LEAD_STATUS.LOST],
  [LEAD_STATUS.QUOTED]: [LEAD_STATUS.WON, LEAD_STATUS.LOST],
  [LEAD_STATUS.WON]: [],
  [LEAD_STATUS.LOST]: [],
};

export function canTransition(currentStatus, nextStatus) {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

export const STATUS_CONFIG = {
  [LEAD_STATUS.NEW]: {
    label: 'New Lead',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    description: 'Enquiry received, awaiting qualification',
  },
  [LEAD_STATUS.QUALIFIED]: {
    label: 'Qualified',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
    description: 'Capacity estimated, ready for technical survey',
  },
  [LEAD_STATUS.SURVEY_SCHEDULED]: {
    label: 'Survey Scheduled',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
    description: 'Technician assigned, site visit pending',
  },
  [LEAD_STATUS.SURVEY_SUBMITTED]: {
    label: 'Survey Submitted',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    description: 'Site survey completed, awaiting admin review',
  },
  [LEAD_STATUS.SURVEY_APPROVED]: {
    label: 'Survey Approved',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    description: 'Technical approval granted, ready for quotation',
  },
  [LEAD_STATUS.QUOTED]: {
    label: 'Quoted',
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    dot: 'bg-cyan-500',
    description: 'Quotation with BOM generated and shared',
  },
  [LEAD_STATUS.WON]: {
    label: 'Closed Won',
    color: 'bg-green-100 text-green-800 border-green-300 font-semibold',
    dot: 'bg-green-600',
    description: 'Quote accepted by customer',
  },
  [LEAD_STATUS.LOST]: {
    label: 'Closed Lost',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    description: 'Lead marked as lost/unviable',
  },
};
