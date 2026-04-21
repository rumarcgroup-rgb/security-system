import EmployeeSubmitDtrSection from "./EmployeeSubmitDtrSection";
import EmployeePortalHighlightsSection from "./EmployeePortalHighlightsSection";

export default function EmployeeSubmitDtrView({
  activeCutoffIndex,
  cutoff,
  cutoffOptionRefs,
  cutoffPickerOpen,
  cutoffPickerRef,
  cutoffSearch,
  cutoffSearchInputRef,
  dashboardVariant,
  employeeNote,
  file,
  filteredCutoffOptions,
  handleCutoffSearchKeyDown,
  setActiveCutoffIndex,
  setCutoff,
  setCutoffPickerOpen,
  setCutoffSearch,
  setEmployeeNote,
  setFile,
  submitDtr,
  submitting,
}) {
  return (
    <main className="employee-dashboard__content employee-dashboard__stack-lg">
      <div className="employee-dashboard__page-header">
        <h2 className="employee-dashboard__section-title">Submit DTR</h2>
        <p className="app-copy-sm">Choose your cutoff, attach the final DTR image, and send it for admin review.</p>
      </div>

      <div className="app-info-panel">
        What happens next: your DTR appears instantly in the admin and supervisor queues. You will see Pending Review until it is approved or returned with remarks.
      </div>

      <EmployeePortalHighlightsSection dashboardVariant={dashboardVariant} />

      <EmployeeSubmitDtrSection
        activeCutoffIndex={activeCutoffIndex}
        cutoff={cutoff}
        cutoffOptionRefs={cutoffOptionRefs}
        cutoffPickerOpen={cutoffPickerOpen}
        cutoffPickerRef={cutoffPickerRef}
        cutoffSearch={cutoffSearch}
        cutoffSearchInputRef={cutoffSearchInputRef}
        dashboardVariant={dashboardVariant}
        employeeNote={employeeNote}
        file={file}
        filteredCutoffOptions={filteredCutoffOptions}
        handleCutoffSearchKeyDown={handleCutoffSearchKeyDown}
        setActiveCutoffIndex={setActiveCutoffIndex}
        setCutoff={setCutoff}
        setCutoffPickerOpen={setCutoffPickerOpen}
        setCutoffSearch={setCutoffSearch}
        setEmployeeNote={setEmployeeNote}
        setFile={setFile}
        submitDtr={submitDtr}
        submitting={submitting}
      />
    </main>
  );
}
