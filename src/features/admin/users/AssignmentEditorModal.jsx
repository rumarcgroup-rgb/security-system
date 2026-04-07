import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import Select from "../../../components/ui/Select";

export default function AssignmentEditorModal({
  assignmentProfile,
  assignmentForm,
  assignmentBranchOptions,
  areaOptions,
  isSupervisorAssignment,
  positionOptions,
  savingAssignment,
  onClose,
  onSave,
  onChange,
}) {
  return (
    <Modal
      open={Boolean(assignmentProfile)}
      onClose={onClose}
      title={assignmentProfile ? `Edit Assignment for ${assignmentProfile.full_name || "Employee"}` : "Edit Assignment"}
    >
      <div className="app-modal-stack">
        <div className="app-empty-box">
          {isSupervisorAssignment
            ? "Update the supervisor's assigned area here. Supervisor accounts are area-scoped, so branch selection is not needed."
            : "Update the employee's assigned location and job description here. This saves directly to their live profile."}
        </div>

        <Select label="Assigned Location" value={assignmentForm.location} onChange={(e) => onChange("location", e.target.value)}>
          <option value="">Select area</option>
          {areaOptions.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </Select>

        {isSupervisorAssignment ? null : (
          <Select label="Branch" value={assignmentForm.branch} onChange={(e) => onChange("branch", e.target.value)}>
            {assignmentBranchOptions.length === 0 ? <option value="">No branches for this area</option> : null}
            {assignmentBranchOptions.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </Select>
        )}

        {isSupervisorAssignment ? null : (
          <Select label="Position" value={assignmentForm.position} onChange={(e) => onChange("position", e.target.value)}>
            <option value="">Select position</option>
            {positionOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        )}

        <div className="app-modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={savingAssignment}>
            Cancel
          </Button>
          <Button loading={savingAssignment} onClick={onSave}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
