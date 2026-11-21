// Executable DESIGN SPECIFICATION ONLY. Never imported by application routes.
// Not an active authorization change. Batch 2 preserves PO/Stock-In permissions.
export function proposedDecisionAllowed({ kind, initiatorId, returnInitiatorId, reviewer, pharmacistAuthorization, now = new Date() }) {
  if (!['purchase_order','stock_in','adjustment','return','restock'].includes(kind)) return false;
  if (!reviewer || reviewer.status !== 'active' || !['manager','admin'].includes(reviewer.role)) return false;
  if (['purchase_order','stock_in'].includes(kind)) return Number.isInteger(initiatorId) && Number.isInteger(reviewer.user_id);
  if (!Number.isInteger(initiatorId) || !Number.isInteger(reviewer.user_id) || initiatorId === reviewer.user_id) return false;
  if (kind !== 'restock') return true;
  if (!Number.isInteger(returnInitiatorId) || returnInitiatorId === reviewer.user_id) return false;
  const authorization = pharmacistAuthorization;
  return Boolean(authorization && authorization.user_id === reviewer.user_id && !authorization.revoked_at
    && Number.isFinite(Date.parse(authorization.verified_at)) && Number.isFinite(Date.parse(authorization.expires_at))
    && Date.parse(authorization.verified_at) <= now.valueOf() && Date.parse(authorization.expires_at) > now.valueOf());
}
