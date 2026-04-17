import { Camera, ChevronDown, ImageUp, Search } from "lucide-react";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";

export default function EmployeeSubmitDtrSection({
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
    <Card>
      <h3 className="employee-dashboard__subsection-title employee-dashboard__subsection-title--with-margin">{dashboardVariant.submitTitle}</h3>
      <div className="employee-dashboard__stack-md">
        <div className="employee-card-panel employee-card-panel--warning employee-dashboard__info-banner">{dashboardVariant.submitCopy}</div>

        <div className="employee-dashboard__cutoff-picker" ref={cutoffPickerRef}>
          <span className="app-field-label">Select Cutoff Date</span>
          <button
            type="button"
            className={`employee-dashboard__cutoff-trigger${cutoffPickerOpen ? " employee-dashboard__cutoff-trigger--open" : ""}`}
            onClick={() => setCutoffPickerOpen((value) => !value)}
          >
            <span>{cutoff}</span>
            <ChevronDown size={18} className={`employee-dashboard__cutoff-chevron${cutoffPickerOpen ? " employee-dashboard__cutoff-chevron--open" : ""}`} />
          </button>

          {cutoffPickerOpen ? (
            <div className="employee-dashboard__cutoff-menu">
              <div className="employee-dashboard__cutoff-search">
                <Search size={16} className="employee-dashboard__cutoff-search-icon" />
                <input
                  ref={cutoffSearchInputRef}
                  type="text"
                  className="employee-dashboard__cutoff-search-input"
                  placeholder="Search cutoff or date"
                  value={cutoffSearch}
                  onChange={(e) => setCutoffSearch(e.target.value)}
                  onKeyDown={handleCutoffSearchKeyDown}
                />
              </div>

              <div className="employee-dashboard__cutoff-options">
                {filteredCutoffOptions.map((item, index) => {
                  const isRecent = !cutoffSearch.trim() && index < 3;

                  return (
                    <button
                      key={item}
                      ref={(element) => {
                        cutoffOptionRefs.current[index] = element;
                      }}
                      type="button"
                      className={`employee-dashboard__cutoff-option${cutoff === item ? " employee-dashboard__cutoff-option--active" : ""}${activeCutoffIndex === index ? " employee-dashboard__cutoff-option--highlighted" : ""}`}
                      onClick={() => {
                        setCutoff(item);
                        setCutoffPickerOpen(false);
                        setCutoffSearch("");
                      }}
                      onMouseEnter={() => setActiveCutoffIndex(index)}
                    >
                      <span>{item}</span>
                      {isRecent ? <span className="employee-dashboard__cutoff-recent">Recent</span> : null}
                    </button>
                  );
                })}
                {filteredCutoffOptions.length === 0 ? <p className="employee-dashboard__cutoff-empty">No cutoff dates match your search.</p> : null}
              </div>
            </div>
          ) : null}
        </div>

        <label className="app-field-block employee-dashboard__textarea-label">
          <span className="app-field-label">Note for Admin</span>
          <textarea
            className="app-textarea"
            placeholder="Optional note about this DTR submission"
            value={employeeNote}
            onChange={(e) => setEmployeeNote(e.target.value)}
          />
        </label>

        <label className="employee-dashboard__upload-card">
          <div className="employee-dashboard__upload-icons">
            <Camera size={18} />
            <ImageUp size={18} />
          </div>
          <p className="app-copy-sm">{file ? file.name : "Tap to upload DTR image"}</p>
          <input
            type="file"
            accept="image/*"
            className="employee-dashboard__hidden-input"
            onChange={(e) => setFile(e.target.files?.[0])}
          />
        </label>

        <Button className="employee-dashboard__btn-full" loading={submitting} onClick={submitDtr}>
          Submit DTR
        </Button>
      </div>
    </Card>
  );
}
