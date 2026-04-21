import { useState } from "react";
import "./EmployeeDashboard.css";
import EmployeeDocumentsView from "./components/EmployeeDocumentsView";
import EmployeeDashboardMain from "./components/EmployeeDashboardMain";
import EmployeeMessagesView from "./components/EmployeeMessagesView";
import EmployeeDashboardModals from "./components/EmployeeDashboardModals";
import EmployeeDashboardShell from "./components/EmployeeDashboardShell";
import EmployeeSubmitDtrView from "./components/EmployeeSubmitDtrView";
import EmployeeDtrReviewModal from "./components/EmployeeDtrReviewModal";
import { useEmployeeDashboard } from "./useEmployeeDashboard";

export default function EmployeeDashboard({ user, profile, refreshProfile }) {
  const dashboard = useEmployeeDashboard({ user, profile, refreshProfile });
  const [activeView, setActiveView] = useState("dashboard");
  const [recentSubmissionsFocusRequestKey, setRecentSubmissionsFocusRequestKey] = useState(0);

  function openDocument(document) {
    dashboard.setReplacementFile(null);
    dashboard.setActiveDocument(document);
  }

  function handleSubmitDtrShortcut() {
    setActiveView("submit-dtr");
  }

  function handleOpenRecentSubmissions() {
    setActiveView("dashboard");
    setRecentSubmissionsFocusRequestKey((current) => current + 1);
  }

  function handleOpenMessagesView() {
    setActiveView("messages");
  }

  function handleReviewProfileSetup() {
    const incompleteSetupItems = dashboard.profileCompletenessSummary.checks.filter((item) => !item.done);
    const needsDocumentReview = incompleteSetupItems.some((item) => item.id === "documents" || item.id === "signature");
    const canRequestProfileEdit = incompleteSetupItems.some((item) => item.id === "personal" || item.id === "government");

    dashboard.setMoreOpen(false);

    if (needsDocumentReview) {
      setActiveView("documents");
      return;
    }

    if (canRequestProfileEdit) {
      dashboard.openEditProfileModal();
      return;
    }

    setActiveView("dashboard");
  }

  function handleStatusMessageAction(message) {
    dashboard.markStatusMessageRead(message.id);

    if (message.actionTarget === "documents") {
      setActiveView("documents");
      return;
    }

    if (message.actionTarget === "submissions") {
      handleOpenRecentSubmissions();
      return;
    }

    if (message.actionTarget === "profile-edit") {
      dashboard.openEditProfileModal();
      return;
    }

    if (message.actionTarget === "profile-request") {
      dashboard.setMoreOpen(true);
    }
  }

  return (
    <div
      className={`employee-dashboard employee-dashboard--${dashboard.dashboardVariant.key}`}
      style={{
        "--employee-theme-primary": dashboard.dashboardVariant.theme.primary,
        "--employee-theme-primary-dark": dashboard.dashboardVariant.theme.primaryDark,
        "--employee-theme-soft": dashboard.dashboardVariant.theme.soft,
        "--employee-theme-tint": dashboard.dashboardVariant.theme.tint,
        "--employee-theme-glow": dashboard.dashboardVariant.theme.glow,
      }}
    >
      <EmployeeDashboardShell
        activeView={activeView}
        dashboardVariant={dashboard.dashboardVariant}
        moreNeedsAttention={
          dashboard.profileCompletenessSummary.percent < 100 ||
          dashboard.profileChangeRequest?.status === "Rejected"
        }
        unreadMessagesCount={dashboard.unreadMessagesCount}
        onOpenMessages={handleOpenMessagesView}
        onOpenMore={() => dashboard.setMoreOpen(true)}
        onOpenNotifications={dashboard.markNotificationsSeenAndOpen}
        onShortcutSubmitDtr={handleSubmitDtrShortcut}
        onShowDashboard={() => setActiveView("dashboard")}
        onShowDocuments={() => setActiveView("documents")}
        unreadNotificationCount={dashboard.unreadNotificationCount}
      >
        {activeView === "documents" ? (
          <EmployeeDocumentsView
            actions={dashboard.actions}
            dashboardVariant={dashboard.dashboardVariant}
            documents={dashboard.documents}
            documentsLoading={dashboard.documentsLoading}
            onOpenDocument={openDocument}
            onPendingDtrAction={handleOpenRecentSubmissions}
          />
        ) : activeView === "submit-dtr" ? (
          <EmployeeSubmitDtrView
            activeCutoffIndex={dashboard.activeCutoffIndex}
            cutoff={dashboard.cutoff}
            cutoffOptionRefs={dashboard.cutoffOptionRefs}
            cutoffPickerOpen={dashboard.cutoffPickerOpen}
            cutoffPickerRef={dashboard.cutoffPickerRef}
            cutoffSearch={dashboard.cutoffSearch}
            cutoffSearchInputRef={dashboard.cutoffSearchInputRef}
            dashboardVariant={dashboard.dashboardVariant}
            employeeNote={dashboard.employeeNote}
            file={dashboard.file}
            filteredCutoffOptions={dashboard.filteredCutoffOptions}
            handleCutoffSearchKeyDown={dashboard.handleCutoffSearchKeyDown}
            setActiveCutoffIndex={dashboard.setActiveCutoffIndex}
            setCutoff={dashboard.setCutoff}
            setCutoffPickerOpen={dashboard.setCutoffPickerOpen}
            setCutoffSearch={dashboard.setCutoffSearch}
            setEmployeeNote={dashboard.setEmployeeNote}
            setFile={dashboard.setFile}
            submitDtr={dashboard.submitDtr}
            submitting={dashboard.submitting}
          />
        ) : activeView === "messages" ? (
          <EmployeeMessagesView
            assignment={dashboard.assignment}
            chatInbox={dashboard.chatInbox}
            currentUserId={user.id}
            onMarkAllStatusMessagesRead={dashboard.markAllStatusMessagesRead}
            onStatusMessageAction={handleStatusMessageAction}
            onStatusMessageOpen={dashboard.markStatusMessageRead}
            statusMessages={dashboard.statusMessages}
            unreadStatusMessagesCount={dashboard.unreadStatusMessagesCount}
          />
        ) : (
          <EmployeeDashboardMain
            adminFeedback={dashboard.adminFeedback}
            assignment={dashboard.assignment}
            dashboardVariant={dashboard.dashboardVariant}
            person={dashboard.person}
            profileCompletenessSummary={dashboard.profileCompletenessSummary}
            submissions={dashboard.submissions}
            dtrReviewLoadingId={dashboard.dtrReviewLoadingId}
            onOpenDtrReview={dashboard.openDtrReview}
            recentSubmissionsFocusRequestKey={recentSubmissionsFocusRequestKey}
            summary={dashboard.summary}
          />
        )}
      </EmployeeDashboardShell>

      <EmployeeDashboardModals
        GENDER_OPTIONS={dashboard.GENDER_OPTIONS}
        CIVIL_STATUS_OPTIONS={dashboard.CIVIL_STATUS_OPTIONS}
        activeDocument={dashboard.activeDocument}
        activeProfileRequestAvatar={dashboard.activeProfileRequestAvatar}
        clearSignaturePad={dashboard.clearSignaturePad}
        closeActiveDocument={dashboard.closeActiveDocument}
        dashboardVariant={dashboard.dashboardVariant}
        drawSignatureStroke={dashboard.drawSignatureStroke}
        editProfileForm={dashboard.editProfileForm}
        editProfileImageFile={dashboard.editProfileImageFile}
        editProfileOpen={dashboard.editProfileOpen}
        endSignatureStroke={dashboard.endSignatureStroke}
        handleLogout={dashboard.handleLogout}
        hasSignatureDrawing={dashboard.hasSignatureDrawing}
        loggingOut={dashboard.loggingOut}
        moreOpen={dashboard.moreOpen}
        notifications={dashboard.notifications}
        notificationsOpen={dashboard.notificationsOpen}
        openEditProfileModal={dashboard.openEditProfileModal}
        person={dashboard.person}
        profileChangeRequest={dashboard.profileChangeRequest}
        profileCompletenessSummary={dashboard.profileCompletenessSummary}
        profileRequestLoading={dashboard.profileRequestLoading}
        profileRow={dashboard.profileRow}
        refreshing={dashboard.refreshing}
        refreshDashboard={dashboard.refreshDashboard}
        onReviewProfileSetup={handleReviewProfileSetup}
        replacementFile={dashboard.replacementFile}
        setEditProfileForm={dashboard.setEditProfileForm}
        setEditProfileImageFile={dashboard.setEditProfileImageFile}
        setEditProfileOpen={dashboard.setEditProfileOpen}
        setMoreOpen={dashboard.setMoreOpen}
        setNotificationsOpen={dashboard.setNotificationsOpen}
        setReplacementFile={dashboard.setReplacementFile}
        signatureCanvasRef={dashboard.signatureCanvasRef}
        startSignatureStroke={dashboard.startSignatureStroke}
        submitProfileChangeRequest={dashboard.submitProfileChangeRequest}
        submittingProfileRequest={dashboard.submittingProfileRequest}
        summary={dashboard.summary}
        uploadingRequirement={dashboard.uploadingRequirement}
        uploadRequirement={dashboard.uploadRequirement}
      />

      <EmployeeDtrReviewModal
        currentUserId={user.id}
        file={dashboard.dtrReuploadFile}
        note={dashboard.dtrReuploadNote}
        onChangeFile={dashboard.setDtrReuploadFile}
        onChangeNote={dashboard.setDtrReuploadNote}
        onClose={dashboard.closeDtrReview}
        onSubmitReplacement={dashboard.reuploadDtrSubmission}
        reuploading={dashboard.reuploadingDtr}
        submission={dashboard.activeDtrReview}
      />
    </div>
  );
}
