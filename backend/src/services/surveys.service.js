const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { LEAD_STATUS, transitionLead } = require('../utils/leadStatus');
const { assertLeadAccess } = require('../utils/access');

/** QUALIFIED -> SURVEY_SCHEDULED: assign a technician + date. */
async function assignSurvey(leadId, { technicianId, scheduledDate, notes }, actor) {
  return withTransaction(async (client) => {
    await assertLeadAccess(client, leadId, actor, { lock: true }); // staff: own leads only
    const tech = await client.query(
      `SELECT id, name FROM users WHERE id = $1 AND role = 'TECHNICIAN' AND is_active`,
      [technicianId],
    );
    if (!tech.rows.length) throw AppError.badRequest('technicianId must be an active technician', { field: 'technicianId' });

    // locks the lead row and enforces QUALIFIED -> SURVEY_SCHEDULED (409 otherwise)
    const visit = new Date(scheduledDate).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
    });
    await transitionLead(
      client,
      leadId,
      LEAD_STATUS.SURVEY_SCHEDULED,
      actor.id,
      `Survey assigned to ${tech.rows[0].name} for ${visit}`,
    );

    const { rows } = await client.query(
      `INSERT INTO surveys (lead_id, technician_id, scheduled_date, assign_notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [leadId, technicianId, scheduledDate, notes, actor.id],
    );
    return { ...rows[0], technician_name: tech.rows[0].name };
  });
}

/** Technician's own surveys, with the customer details needed on site. */
async function listMySurveys(technicianId, status) {
  const { rows } = await query(
    `SELECT s.*,
            l.lead_code, l.customer_name, l.phone, l.address, l.city, l.state, l.pincode, l.property_type,
            l.monthly_bill, l.roof_type AS lead_roof_type, l.suggested_kw, l.status AS lead_status, l.qualification
       FROM surveys s
       JOIN leads l ON l.id = s.lead_id
      WHERE s.technician_id = $1
        AND ($2::survey_status IS NULL OR s.status = $2)
      ORDER BY (s.status = 'SCHEDULED') DESC, s.scheduled_date ASC, s.id DESC`,
    [technicianId, status],
  );
  return rows;
}

/** Locks a survey row (FOR UPDATE) or throws 404. */
async function lockSurvey(client, surveyId) {
  const { rows } = await client.query('SELECT * FROM surveys WHERE id = $1 FOR UPDATE', [surveyId]);
  if (!rows.length) throw AppError.notFound('Survey');
  return rows[0];
}

/** SCHEDULED -> SUBMITTED by the assigned technician (lead -> SURVEY_SUBMITTED). */
async function submitSurvey(surveyId, data, photoPaths, technician) {
  return withTransaction(async (client) => {
    const survey = await lockSurvey(client, surveyId);
    if (survey.technician_id !== technician.id) throw AppError.forbidden('This survey is assigned to another technician');
    if (survey.status !== 'SCHEDULED') {
      throw AppError.conflict(`Survey is already ${survey.status}`, 'INVALID_STATUS_TRANSITION', { current: survey.status });
    }

    const { rows } = await client.query(
      `UPDATE surveys
          SET status = 'SUBMITTED', submitted_at = now(),
              roof_type = $2, roof_area_sqft = $3, shading = $4, orientation = $5,
              sanctioned_load_kw = $6, recommended_kw = $7, latitude = $8, longitude = $9,
              technician_notes = $10, photos = $11::text[],
              structure_type = $12, cable_run_meters = $13, inverter_location = $14
        WHERE id = $1
        RETURNING *`,
      [
        surveyId, data.roofType, data.roofAreaSqft, data.shading, data.orientation,
        data.sanctionedLoadKw, data.recommendedKw, data.latitude, data.longitude,
        data.technicianNotes, photoPaths, data.structureType, data.cableRunMeters, data.inverterLocation,
      ],
    );

    await transitionLead(
      client,
      survey.lead_id,
      LEAD_STATUS.SURVEY_SUBMITTED,
      technician.id,
      `Survey submitted with ${photoPaths.length} photo(s)${data.recommendedKw ? `, recommends ${data.recommendedKw} kW` : ''}`,
    );
    return rows[0];
  });
}

/**
 * Admin review of a SUBMITTED survey.
 *  APPROVE -> survey APPROVED, lead SURVEY_APPROVED (lead.suggested_kw takes the technician's recommendation)
 *  REJECT  -> survey REJECTED, lead back to QUALIFIED (staff can schedule a new survey)
 */
async function reviewSurvey(surveyId, { decision, note }, admin) {
  return withTransaction(async (client) => {
    const survey = await lockSurvey(client, surveyId);
    if (survey.status !== 'SUBMITTED') {
      throw AppError.conflict(`Only SUBMITTED surveys can be reviewed (this one is ${survey.status})`, 'INVALID_STATUS_TRANSITION', {
        current: survey.status,
      });
    }

    const approve = decision === 'APPROVE';
    const { rows } = await client.query(
      `UPDATE surveys
          SET status = $2, reviewed_by = $3, reviewed_at = now(), review_note = $4
        WHERE id = $1
        RETURNING *`,
      [surveyId, approve ? 'APPROVED' : 'REJECTED', admin.id, note],
    );

    await transitionLead(
      client,
      survey.lead_id,
      approve ? LEAD_STATUS.SURVEY_APPROVED : LEAD_STATUS.QUALIFIED,
      admin.id,
      approve ? `Survey approved${note ? `: ${note}` : ''}` : `Survey rejected: ${note}`,
    );

    if (approve && survey.recommended_kw) {
      await client.query('UPDATE leads SET suggested_kw = $2 WHERE id = $1', [survey.lead_id, survey.recommended_kw]);
    }
    return rows[0];
  });
}

module.exports = { assignSurvey, listMySurveys, submitSurvey, reviewSurvey };
