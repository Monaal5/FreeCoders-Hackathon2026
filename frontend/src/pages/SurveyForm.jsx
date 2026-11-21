import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient, isMockMode } from '../api/client';
import { formatKW } from '../utils/formatters';
import {
  ArrowLeft,
  Camera,
  Upload,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Phone,
  MapPin,
  HardHat,
  Sun
} from 'lucide-react';

export default function SurveyForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Technical survey fields
  const [formData, setFormData] = useState({
    recommended_capacity_kw: 3.0,
    roof_type_confirmed: 'Flat RCC Concrete',
    shading_analysis: 'Zero shading between 9am and 4pm. Direct solar exposure.',
    structure_type: 'Elevated GI Structure (1.5m clearance)',
    cable_run_meters: 25,
    inverter_location: 'Near Ground Floor Main Meter Box',
    technician_remarks: '',
  });

  // Photo upload list (base64 or remote URL strings).
  // Live mode starts empty: only real photos picked here are uploaded to the backend.
  const [photos, setPhotos] = useState(() =>
    isMockMode()
      ? [
          'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=800&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1508873696983-2df5293cb395?w=800&auto=format&fit=crop&q=80',
        ]
      : []
  );

  useEffect(() => {
    const fetchSurveyData = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get('/api/surveys/my');
        if (res.success) {
          const match = (res.data || []).find((s) => s.id === Number(id));
          if (match) {
            setSurvey(match);
            if (match.recommended_capacity_kw) {
              setFormData({
                recommended_capacity_kw: match.recommended_capacity_kw,
                roof_type_confirmed: match.roof_type_confirmed || 'Flat RCC Concrete',
                shading_analysis: match.shading_analysis || '',
                structure_type: match.structure_type || 'Elevated GI Structure',
                cable_run_meters: match.cable_run_meters || 25,
                inverter_location: match.inverter_location || '',
                technician_remarks: match.technician_remarks || '',
              });
              if (match.photos && match.photos.length > 0) {
                setPhotos(match.photos);
              }
            } else if (match.lead?.suggested_kw) {
              setFormData((prev) => ({
                ...prev,
                recommended_capacity_kw: match.lead.suggested_kw,
              }));
            }
          } else {
            setError('Survey record not found');
          }
        }
      } catch (e) {
        setError('Error fetching survey details');
      } finally {
        setLoading(false);
      }
    };
    fetchSurveyData();
  }, [id]);

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos((prev) => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (idx) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (photos.length === 0) {
      alert('Please attach at least one photo of the roof / meter box for admin validation.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        ...formData,
        photos,
      };

      const res = await apiClient.patch(`/api/surveys/${id}/submit`, payload);
      if (res.success) {
        alert('Survey submitted successfully! Lead has advanced to SURVEY_SUBMITTED for Admin review.');
        navigate('/surveys');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to submit survey');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-slate-400">Loading survey worksheet...</div>;
  }

  const isReadonly = survey?.status === 'APPROVED';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Back button & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/surveys')}
          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Technical Site Feasibility Survey
          </h1>
          <p className="text-xs text-slate-500">
            Survey #{id} • Status: <span className="font-semibold text-purple-700">{survey?.status}</span>
          </p>
        </div>
      </div>

      {/* Customer Site Header Card */}
      {survey?.lead && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-slate-400 font-semibold uppercase">Customer & Site</div>
              <h2 className="text-lg font-bold text-slate-900">{survey.lead.customer_name}</h2>
              <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {survey.lead.address}, {survey.lead.city} - {survey.lead.pincode}
              </p>
            </div>
            <a
              href={`tel:${survey.lead.phone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-xs"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call</span>
            </a>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Survey Submission Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <HardHat className="w-4 h-4 text-purple-600" />
            Field Engineering Measurements
          </h3>
          <p className="text-xs text-slate-400">
            Verify structural viability and solar irradiance parameters.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Recommended Solar Capacity (kW) *
            </label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="100"
              required
              disabled={isReadonly}
              value={formData.recommended_capacity_kw}
              onChange={(e) => setFormData({ ...formData, recommended_capacity_kw: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Confirmed Roof Construction *
            </label>
            <select
              value={formData.roof_type_confirmed}
              disabled={isReadonly}
              onChange={(e) => setFormData({ ...formData, roof_type_confirmed: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="Flat RCC Concrete">Flat RCC Concrete</option>
              <option value="Sloped Metal Sheet (Standing Seam)">Sloped Metal Sheet (Standing Seam)</option>
              <option value="Tiled / Mangalore Roof">Tiled / Mangalore Roof</option>
              <option value="Ground Mount Available">Ground Mount Available</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Mounting Structure Recommendation *
            </label>
            <select
              value={formData.structure_type}
              disabled={isReadonly}
              onChange={(e) => setFormData({ ...formData, structure_type: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="Elevated GI Structure (1.5m clearance)">Elevated GI Structure (1.5m clearance)</option>
              <option value="Standard Low-Tilt Structure (15°)">Standard Low-Tilt Structure (15°)</option>
              <option value="Aluminum Rail Clamps (Direct to Sheet)">Aluminum Rail Clamps (Direct to Sheet)</option>
              <option value="Custom Elevated High Rise Frame">Custom Elevated High Rise Frame</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Estimated Cable Run to Inverter (Meters) *
            </label>
            <input
              type="number"
              required
              min="5"
              max="200"
              disabled={isReadonly}
              value={formData.cable_run_meters}
              onChange={(e) => setFormData({ ...formData, cable_run_meters: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Shading & Azimuth Analysis *
            </label>
            <input
              type="text"
              required
              disabled={isReadonly}
              value={formData.shading_analysis}
              onChange={(e) => setFormData({ ...formData, shading_analysis: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g. Unshaded south exposure from 9:00 AM to 4:30 PM. Minor parapet shadow in winter."
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Proposed Inverter & Net Meter Location *
            </label>
            <input
              type="text"
              required
              disabled={isReadonly}
              value={formData.inverter_location}
              onChange={(e) => setFormData({ ...formData, inverter_location: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g. Sheltered terrace wall near staircase landing with good airflow."
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Field Technician Remarks & Structural Safety Notes
            </label>
            <textarea
              rows={3}
              disabled={isReadonly}
              value={formData.technician_remarks}
              onChange={(e) => setFormData({ ...formData, technician_remarks: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
              placeholder="e.g. Roof is structurally strong with no water seepage. ACDB can be mounted alongside inverter."
            />
          </div>
        </div>

        {/* Multi-Photo Upload Section (Multer / backend/uploads contract) */}
        <div className="border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-indigo-600" />
                Site Photos & Visual Evidence ({photos.length})
              </div>
              <p className="text-[11px] text-slate-400">
                Attach roof views, meter box, and surroundings.
              </p>
            </div>

            {!isReadonly && (
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold cursor-pointer transition border border-indigo-200">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Photos</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photos.map((src, idx) => (
              <div
                key={idx}
                className="relative group aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-2xs"
              >
                <img
                  src={src}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                {!isReadonly && (
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition opacity-80 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.2 rounded">
                  Photo {idx + 1}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        {!isReadonly && (
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-sm shadow-lg shadow-purple-600/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? 'Submitting Survey...' : 'Submit Survey for Admin Approval →'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
